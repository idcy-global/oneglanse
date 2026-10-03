import { execFileSync } from "node:child_process";
import { NotFoundError, PermissionError } from "@oneglanse/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const container = `oneglanse-tenant-test-${process.pid}-${Date.now()}`;
const password = "tenant-test-password";
const databaseName = "oneglanse_tenant_test";

function docker(...args: string[]): string {
	return execFileSync("docker", args, {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	}).trim();
}

async function waitForDatabase(pool: {
	query: (sql: string) => Promise<unknown>;
}): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			await pool.query("SELECT 1");
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	throw new Error("Test PostgreSQL did not become ready");
}

type Database = typeof import("@oneglanse/db");
type Authorization = typeof import("../../src/workspace/authorization.js");

let databaseModule: Database;
let authorization: Authorization;
let startedContainer = false;

beforeAll(async () => {
	docker(
		"run",
		"-d",
		"--rm",
		"--name",
		container,
		"-e",
		`POSTGRES_PASSWORD=${password}`,
		"-e",
		`POSTGRES_DB=${databaseName}`,
		"-p",
		"127.0.0.1::5432",
		"postgres:16",
	);
	startedContainer = true;

	const mappedPort = docker("port", container, "5432/tcp").split(":").at(-1);
	if (!mappedPort) throw new Error("Missing PostgreSQL port");

	process.env.NODE_ENV = "test";
	process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${mappedPort}/${databaseName}`;

	databaseModule = await import("@oneglanse/db");
	await waitForDatabase(databaseModule.pool);

	await databaseModule.pool.query(`
		CREATE TABLE member (
			id text PRIMARY KEY,
			organization_id text NOT NULL,
			user_id text NOT NULL,
			role text NOT NULL DEFAULT 'member',
			created_at timestamp NOT NULL DEFAULT now()
		);

		CREATE TABLE workspaces (
			id varchar(256) PRIMARY KEY,
			name varchar(256) NOT NULL,
			slug varchar(256) NOT NULL,
			domain varchar(256) NOT NULL,
			tenant_id varchar(256) NOT NULL,
			schedule varchar(64),
			enabled_providers text[],
			selected_prompt_ids text[],
			created_at timestamp NOT NULL DEFAULT now(),
			deleted_at timestamp
		);

		CREATE TABLE workspace_members (
			id uuid PRIMARY KEY,
			workspace_id text NOT NULL,
			user_id text NOT NULL,
			role text NOT NULL DEFAULT 'member',
			created_at timestamp NOT NULL DEFAULT now(),
			deleted_at timestamp
		);
	`);

	authorization = await import("../../src/workspace/authorization.js");
}, 120_000);

beforeEach(async () => {
	await databaseModule.pool.query(
		"TRUNCATE TABLE workspace_members, workspaces, member",
	);

	await databaseModule.pool.query(`
		INSERT INTO member (id, organization_id, user_id, role) VALUES
			('ma', 'org-a', 'user-a', 'owner'),
			('mab', 'org-b', 'user-a', 'member'),
			('mb', 'org-b', 'user-b', 'owner');

		INSERT INTO workspaces
			(id, name, slug, domain, tenant_id, created_at)
		VALUES
			('workspace-a', 'Brand A', 'brand-a', 'a.example', 'org-a', now()),
			('workspace-b', 'Brand B', 'brand-b', 'b.example', 'org-b', now());

		INSERT INTO workspace_members
			(id, workspace_id, user_id, role)
		VALUES
			('00000000-0000-0000-0000-000000000001', 'workspace-a', 'user-a', 'owner'),
			('00000000-0000-0000-0000-000000000002', 'workspace-b', 'user-a', 'member'),
			('00000000-0000-0000-0000-000000000003', 'workspace-b', 'user-b', 'owner');
	`);
});

afterAll(async () => {
	if (databaseModule) await databaseModule.pool.end();
	if (startedContainer) {
		try {
			docker("rm", "-f", container);
		} catch {
			// Best-effort cleanup.
		}
	}
});

describe("commercial SaaS tenant boundary", () => {
	it("allows access inside the active organization", async () => {
		const result = await authorization.requireWorkspaceAccess({
			workspaceId: "workspace-a",
			organizationId: "org-a",
			userId: "user-a",
		});

		expect(result.workspace.id).toBe("workspace-a");
	});

	it("blocks another org workspace even when user belongs to both orgs and both workspaces", async () => {
		await expect(
			authorization.requireWorkspaceAccess({
				workspaceId: "workspace-b",
				organizationId: "org-a",
				userId: "user-a",
			}),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("blocks a user who is not an organization member", async () => {
		await expect(
			authorization.requireOrganizationMembership({
				organizationId: "org-a",
				userId: "user-b",
			}),
		).rejects.toBeInstanceOf(PermissionError);
	});
});

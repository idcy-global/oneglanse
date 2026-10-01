import "server-only";

import { auth } from "@lib/auth/auth";
import type { Workspace } from "@oneglanse/db";
import { getWorkspacesForUser } from "@oneglanse/services";
import { headers } from "next/headers";

export async function getWorkspace(): Promise<Workspace | null> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) return null;

	const sessionWithOrg = session.session as typeof session.session & {
		activeOrganizationId?: string | null;
	};
	const organizationId = sessionWithOrg.activeOrganizationId ?? null;

	if (!organizationId) return null;

	const workspaces = await getWorkspacesForUser({
		tenantId: organizationId,
		userId: session.user.id,
	});

	if (workspaces.length === 0) return null;

	return [...workspaces].sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	)[0] ?? null;
}

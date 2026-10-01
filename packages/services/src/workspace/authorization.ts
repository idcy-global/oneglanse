import { db } from "@oneglanse/db";
import type { Member, Workspace, WorkspaceMember } from "@oneglanse/db";
import {
	NotFoundError,
	PermissionError,
	ValidationError,
} from "@oneglanse/errors";

export async function requireOrganizationMembership(args: {
	organizationId: string;
	userId: string;
}): Promise<Member> {
	const { organizationId, userId } = args;

	if (!organizationId?.trim()) {
		throw new ValidationError("Organization ID is undefined.");
	}
	if (!userId?.trim()) {
		throw new ValidationError("User ID is undefined.");
	}

	const membership = await db.query.member.findFirst({
		where: (m, { and, eq }) =>
			and(eq(m.organizationId, organizationId), eq(m.userId, userId)),
	});

	if (!membership) {
		throw new PermissionError("Organization access denied.");
	}

	return membership;
}

export async function requireWorkspaceAccess(args: {
	workspaceId: string;
	organizationId: string;
	userId: string;
}): Promise<{
	workspace: Workspace;
	organizationMembership: Member;
	workspaceMembership: WorkspaceMember;
}> {
	const { workspaceId, organizationId, userId } = args;

	if (!workspaceId?.trim()) {
		throw new ValidationError("Workspace ID is undefined.");
	}

	const organizationMembership = await requireOrganizationMembership({
		organizationId,
		userId,
	});

	const workspace = await db.query.workspaces.findFirst({
		where: (w, { and, eq, isNull }) =>
			and(
				eq(w.id, workspaceId),
				eq(w.tenantId, organizationId),
				isNull(w.deletedAt),
			),
	});

	if (!workspace) {
		throw new NotFoundError("Workspace");
	}

	const workspaceMembership = await db.query.workspaceMembers.findFirst({
		where: (wm, { and, eq, isNull }) =>
			and(
				eq(wm.workspaceId, workspaceId),
				eq(wm.userId, userId),
				isNull(wm.deletedAt),
			),
	});

	if (!workspaceMembership) {
		throw new PermissionError("Workspace access denied.");
	}

	return {
		workspace,
		organizationMembership,
		workspaceMembership,
	};
}

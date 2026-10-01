import "server-only";

import { schema } from "@oneglanse/db";
import { AuthError, ValidationError } from "@oneglanse/errors";
import { requireWorkspaceAccess } from "@oneglanse/services";
import { t } from "../trpc";

export const validWorkspace = t.middleware(async ({ ctx, input, next }) => {
	const session = ctx.session;
	const user = session?.user;

	if (!user) {
		throw new AuthError("User Id is undefined.");
	}

	const parsed = schema.workspaceInput.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError("Workspace ID is missing or undefined.");
	}

	const sessionWithOrg = session.session as typeof session.session & {
		activeOrganizationId?: string | null;
	};
	const organizationId = sessionWithOrg.activeOrganizationId ?? null;

	if (!organizationId) {
		throw new AuthError("Active organization is required.");
	}

	const { workspaceId } = parsed.data;
	const access = await requireWorkspaceAccess({
		workspaceId,
		organizationId,
		userId: user.id,
	});

	return next({
		ctx: {
			...ctx,
			user,
			workspaceId,
			workspace: access.workspace,
			membership: access.workspaceMembership,
			organizationId,
			organizationMembership: access.organizationMembership,
		},
	});
});

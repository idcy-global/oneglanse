import "server-only";

import { AuthError } from "@oneglanse/errors";
import { requireOrganizationMembership } from "@oneglanse/services";
import { t } from "../trpc";

export const validOrganization = t.middleware(async ({ ctx, next }) => {
	const session = ctx.session;
	const user = session?.user;

	if (!user) {
		throw new AuthError("User Id is undefined.");
	}

	const sessionWithOrg = session.session as typeof session.session & {
		activeOrganizationId?: string | null;
	};
	const organizationId = sessionWithOrg.activeOrganizationId ?? null;

	if (!organizationId) {
		throw new AuthError("Active organization is required.");
	}

	const organizationMembership = await requireOrganizationMembership({
		organizationId,
		userId: user.id,
	});

	return next({
		ctx: {
			...ctx,
			user,
			organizationId,
			organizationMembership,
		},
	});
});

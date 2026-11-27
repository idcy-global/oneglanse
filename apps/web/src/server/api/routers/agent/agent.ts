import { NotFoundError } from "@oneglanse/errors";
import {
	cancelProviderRun,
	getJobGroupProgressForWorkspace,
	waitForRedis,
} from "@oneglanse/services";
import { PROVIDER_LIST } from "@oneglanse/types";
import { z } from "zod";
import { createRateLimiter } from "../../middleware/rateLimit";
import { validWorkspace } from "../../middleware/validWorkspace";
import {
	authorizedWorkspaceProcedure,
	protectedProcedure,
} from "../../procedures";
import { createTRPCRouter } from "../../trpc";
import { submitAgentRun } from "../_shared/submitAgentRun";

export const agentRouter = createTRPCRouter({
	run: authorizedWorkspaceProcedure
		.use(createRateLimiter("agent.run", { limit: 3, windowSecs: 60 }))
		.mutation(async ({ ctx }) => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			return submitAgentRun({ workspaceId, userId });
		}),

	status: authorizedWorkspaceProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				status: z.enum(["pending", "analyzing", "completed", "failed"]),
				response: z.unknown(),
			}),
		)
		.query(async ({ input, ctx }) => {
			await waitForRedis();
			const parsed = await getJobGroupProgressForWorkspace({
				jobGroupId: input.jobId,
				workspaceId: ctx.workspaceId,
			});

			if (!parsed) {
				return { status: "pending" as const, response: null };
			}

			const status =
				parsed.status === "analyzing" ||
				parsed.status === "completed" ||
				parsed.status === "failed"
					? parsed.status
					: "pending";
			return {
				status,
				response: parsed,
			};
		}),

	stopProvider: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				jobId: z.string(),
				provider: z.enum(PROVIDER_LIST),
			}),
		)
		.use(validWorkspace)
		.mutation(async ({ input, ctx }) => {
			await waitForRedis();
			const progress = await getJobGroupProgressForWorkspace({
				jobGroupId: input.jobId,
				workspaceId: ctx.workspaceId,
			});
			const providerStatus = progress?.providers?.[input.provider];
			if (providerStatus !== "pending" && providerStatus !== "running") {
				throw new NotFoundError("Provider job");
			}

			return cancelProviderRun({
				jobGroupId: input.jobId,
				provider: input.provider,
			});
		}),
});

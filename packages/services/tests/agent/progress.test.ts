import { beforeEach, describe, expect, it, vi } from "vitest";

const { evalMock, analysisMock } = vi.hoisted(() => ({
	evalMock: vi.fn(),
	analysisMock: vi.fn(),
}));

vi.mock("../../src/agent/redis.js", () => ({
	redis: { eval: evalMock },
}));

vi.mock("../../src/analysis/analysePromptsForWorkspace.js", () => ({
	analysePromptsForWorkspace: analysisMock,
}));

import { updateProviderProgress } from "../../src/agent/progress.js";

describe("updateProviderProgress GEO finalization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("starts workspace analysis once when the atomic progress update elects the final provider", async () => {
		evalMock
			.mockResolvedValueOnce([
				JSON.stringify({
					workspaceId: "workspace-1",
					status: "analyzing",
					analysisStatus: "running",
				}),
				1,
			])
			.mockResolvedValueOnce(
				JSON.stringify({
					workspaceId: "workspace-1",
					status: "completed",
					analysisStatus: "completed",
				}),
			);
		analysisMock.mockResolvedValue({
			analysedCount: 3,
			failedCount: 0,
			remainingCount: 0,
			errors: [],
		});

		const result = await updateProviderProgress({
			jobGroupId: "job-1",
			provider: "chatgpt",
			status: "completed",
			resultCount: 3,
		});

		expect(analysisMock).toHaveBeenCalledTimes(1);
		expect(analysisMock).toHaveBeenCalledWith({
			workspaceId: "workspace-1",
			analyzeAll: true,
		});
		expect(result?.status).toBe("completed");
		expect(result?.analysisStatus).toBe("completed");
	});

	it("does not start analysis when another provider job has not elected this update", async () => {
		evalMock.mockResolvedValueOnce([
			JSON.stringify({
				workspaceId: "workspace-1",
				status: "pending",
			}),
			0,
		]);

		const result = await updateProviderProgress({
			jobGroupId: "job-2",
			provider: "chatgpt",
			status: "running",
			resultCount: 1,
		});

		expect(analysisMock).not.toHaveBeenCalled();
		expect(result?.status).toBe("pending");
	});

	it("marks the job group failed when GEO analysis leaves failed or remaining responses", async () => {
		evalMock
			.mockResolvedValueOnce([
				JSON.stringify({
					workspaceId: "workspace-1",
					status: "analyzing",
					analysisStatus: "running",
				}),
				1,
			])
			.mockResolvedValueOnce(
				JSON.stringify({
					workspaceId: "workspace-1",
					status: "failed",
					analysisStatus: "failed",
				}),
			);
		analysisMock.mockResolvedValue({
			analysedCount: 2,
			failedCount: 1,
			remainingCount: 1,
			errors: [{ responseId: "response-1", modelProvider: "chatgpt", error: "invalid output" }],
		});

		const result = await updateProviderProgress({
			jobGroupId: "job-3",
			provider: "chatgpt",
			status: "completed",
			resultCount: 3,
		});

		expect(result?.status).toBe("failed");
		expect(result?.analysisStatus).toBe("failed");
	});
});

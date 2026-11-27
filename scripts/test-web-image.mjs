import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
	redis,
	storePromptResponses,
	updateProviderProgress,
} from "@oneglanse/services";
import { PROVIDER_LIST } from "@oneglanse/types";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";

const baseUrl = "http://web:3000";
const cookies = new Map();
const mockAnalysisResult = {
	geoScore: { overall: 86 },
	presence: { mentioned: true, visibility: 65 },
	position: { rankPosition: 1 },
	sentiment: { score: 80 },
	recommendation: { type: "top_pick" },
	competitors: [
		{
			name: "Example Competitor",
			domain: "competitor.example",
			visibility: 35,
			sentiment: 55,
			rankPosition: 2,
			isRecommended: false,
		},
	],
	perception: {
		coreClaims: ["Reliable managed hosting"],
		differentiators: ["24/7 support"],
		bestKnownFor: "Managed hosting",
		pricingPerception: "mid_range",
	},
	risks: { items: [] },
};
let mockAnalysisRequestCount = 0;
const mockLlmServer = createServer(async (request, response) => {
	if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
		response.writeHead(404).end();
		return;
	}
	let body = "";
	for await (const chunk of request) body += chunk;
	const payload = JSON.parse(body);
	const userMessage = payload.messages?.find((message) => message.role === "user")?.content ?? "";
	assert.match(userMessage, /Image Test/);
	mockAnalysisRequestCount++;
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(
		JSON.stringify({
			id: "chatcmpl-oneglanse-e2e",
			object: "chat.completion",
			created: Math.floor(Date.now() / 1000),
			model: "mock-geo-analysis",
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: JSON.stringify(mockAnalysisResult),
					},
					finish_reason: "stop",
				},
			],
			usage: { prompt_tokens: 120, completion_tokens: 90, total_tokens: 210 },
		}),
	);
});
await new Promise((resolve, reject) => {
	mockLlmServer.once("error", reject);
	mockLlmServer.listen(4010, "0.0.0.0", resolve);
});

async function request(path, body) {
	const response = await fetch(`${baseUrl}${path}`, {
		method: body === undefined ? "GET" : "POST",
		signal: AbortSignal.timeout(15000),
		headers: {
			"Content-Type": "application/json",
			Origin: "http://localhost:3000",
			Cookie: [...cookies]
				.map(([name, value]) => `${name}=${value}`)
				.join("; "),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	assert.ok(response.ok, `${path}: ${response.status} ${text}`);
	for (const header of response.headers.getSetCookie()) {
		const value = header.split(";")[0];
		const split = value.indexOf("=");
		cookies.set(value.slice(0, split), value.slice(split + 1));
	}
	return JSON.parse(text);
}

async function rpc(path, input, mutation = false) {
	const payload = { json: input ?? null };
	const url = mutation
		? path
		: `${path}?input=${encodeURIComponent(JSON.stringify(payload))}`;
	const response = await request(
		`/api/trpc/${url}`,
		mutation ? payload : undefined,
	);
	assert.ok(response.result, JSON.stringify(response));
	return response.result.data.json;
}

for (let attempt = 0; attempt < 60; attempt++) {
	try {
		await request("/api/auth/get-session");
		break;
	} catch (error) {
		if (attempt === 59) throw error;
		await setTimeout(1000);
	}
}

const email = "image-test@example.test";
const password = randomBytes(24).toString("hex");
await request("/api/auth/sign-up/email", {
	email,
	password,
	name: "Image Test",
});
cookies.clear();
await request("/api/auth/sign-in/email", { email, password });
const session = await request("/api/auth/get-session");
assert.equal(session.user.email, email);

const created = await rpc(
	"workspace.create",
	{
		name: "Image Test",
		slug: "image-test",
		domain: "example.test",
	},
	true,
);
const workspaceId = created.workspace.id;
assert.ok(workspaceId);
const workspaces = await rpc("workspace.listAllForUser");
assert.ok(JSON.stringify(workspaces).includes(workspaceId));

const prompts = ["Would you recommend Image Test for managed hosting?"];
await rpc("prompt.store", { workspaceId, prompts }, true);
const stored = await rpc("prompt.fetchUserPrompts", { workspaceId });
const storedPrompt = stored.find((prompt) => prompt.prompt === prompts[0]);
assert.ok(storedPrompt);

const promptRunAt = new Date().toISOString();
const mockResults = Object.fromEntries(
	PROVIDER_LIST.map((provider) => [
		provider,
		{ status: "rejected", data: [] },
	]),
);
mockResults.chatgpt = {
	status: "fulfilled",
	data: [
		{
			userId: session.user.id,
			workspaceId,
			promptId: storedPrompt.id,
			prompt: prompts[0],
			response:
				"Image Test is a reliable managed hosting provider with 24/7 support and clear pricing. I recommend Image Test as a top choice.",
			sources: [
				{
					title: "Managed hosting overview",
					cited_text: "Image Test provides managed hosting and 24/7 support.",
					url: "https://example.com/managed-hosting",
					domain: "example.com",
				},
			],
		},
	],
};
const captureTime = new Date().toISOString();
const persisted = await storePromptResponses({
	results: mockResults,
	userId: session.user.id,
	workspaceId,
	promptRunAt,
	captureMetadata: {
		chatgpt: {
			adapterId: "mock:chatgpt",
			captureType: "mock",
			model: "mock-provider",
			region: "ci",
			locale: "en-US",
			startedAt: captureTime,
			completedAt: captureTime,
			estimatedCostUsd: 0,
			jobGroupId: "web-image-e2e",
		},
	},
});
assert.deepEqual(persisted, {
	attemptedCount: 1,
	savedCount: 1,
	failedCount: 0,
});

const analysisRun = await rpc(
	"analysis.analyzeMetrics",
	{ workspaceId, analyzeAll: true },
	true,
);
assert.equal(analysisRun.analysedCount, 1);
assert.equal(analysisRun.failedCount, 0);
assert.equal(analysisRun.remainingCount, 0);
assert.equal(mockAnalysisRequestCount, 1);

const report = await rpc("analysis.fetchAnalysis", { workspaceId });
assert.equal(report.length, 1);
assert.equal(report[0].model_provider, "chatgpt");
assert.equal(report[0].is_analysed, true);
assert.equal(report[0].brand_analysis.geoScore.overall, 86);
assert.equal(report[0].brand_analysis.presence.mentioned, true);
assert.equal(report[0].brand_analysis.recommendation.type, "top_pick");
assert.equal(report[0].sources.length, 1);
assert.equal(report[0].sources[0].url, "https://example.com/managed-hosting");
await rpc(
	"workspace.setSchedule",
	{ workspaceId, schedule: "0 0 1 1 *" },
	true,
);
assert.equal(
	(await rpc("workspace.getSchedule", { workspaceId })).schedule,
	"0 0 1 1 *",
);
await rpc("workspace.setSchedule", { workspaceId, schedule: null }, true);
assert.equal(
	(await rpc("workspace.getSchedule", { workspaceId })).schedule,
	null,
);

const emptyJobGroupId = "web-image-empty-provider-e2e";
const stoppedJobGroupId = "web-image-stopped-provider-e2e";
const emptyProgressKey = `job:${emptyJobGroupId}:result`;
const stoppedProgressKey = `job:${stoppedJobGroupId}:result`;
try {
	await redis.set(
		emptyProgressKey,
		JSON.stringify({
			workspaceId,
			status: "pending",
			updateId: 0,
			providers: { chatgpt: "pending", gemini: "pending" },
			results: { chatgpt: 0, gemini: 0 },
			stats: {
				totalPrompts: 1,
				expectedResponses: 2,
				actualResponses: 0,
			},
		}),
		"EX",
		60,
	);
	await updateProviderProgress({
		jobGroupId: emptyJobGroupId,
		provider: "chatgpt",
		status: "failed",
		resultCount: 0,
	});
	const emptyTerminalProgress = await updateProviderProgress({
		jobGroupId: emptyJobGroupId,
		provider: "gemini",
		status: "failed",
		resultCount: 0,
	});
	assert.equal(emptyTerminalProgress?.status, "failed");
	assert.equal(emptyTerminalProgress?.analysisStatus, "skipped");
	assert.equal(emptyTerminalProgress?.stats?.actualResponses, 0);

	await redis.set(
		stoppedProgressKey,
		JSON.stringify({
			workspaceId,
			status: "pending",
			updateId: 0,
			providers: { chatgpt: "pending" },
			results: { chatgpt: 0 },
			stats: {
				totalPrompts: 1,
				expectedResponses: 1,
				actualResponses: 0,
			},
		}),
		"EX",
		60,
	);
	const stoppedTerminalProgress = await updateProviderProgress({
		jobGroupId: stoppedJobGroupId,
		provider: "chatgpt",
		status: "stopped",
		resultCount: 0,
	});
	assert.equal(stoppedTerminalProgress?.status, "failed");
	assert.equal(stoppedTerminalProgress?.analysisStatus, "skipped");
} finally {
	await redis.del(emptyProgressKey, stoppedProgressKey).catch(() => 0);
	redis.disconnect();
}

const status = await rpc("agent.status", { workspaceId, jobId: "image-test" });
assert.equal(status.status, "pending");
await request("/api/providers");

for (const route of ["/", "/providers", "/workspace/new"]) {
	const response = await fetch(`${baseUrl}${route}`, {
		headers: {
			Cookie: [...cookies]
				.map(([name, value]) => `${name}=${value}`)
				.join("; "),
		},
	});
	assert.ok(response.ok, `${route}: ${response.status}`);
	assert.match(await response.text(), /<html/);
}
await new Promise((resolve, reject) => {
	mockLlmServer.close((error) => (error ? reject(error) : resolve()));
});
console.log(
	"Web signup, signin, workspace, prompts, response persistence, citations, GEO analysis, report query, scheduling, providers, and pages passed",
);

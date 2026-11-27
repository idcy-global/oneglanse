import { JSDOM } from "jsdom";
import type { Page as PlaywrightPage } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runPageDomOp } from "../../src/lib/browser/domOps.js";

type RawSource = {
	rawHref: string;
	title: string;
	citedText: string;
};

function createPage(html: string, url: string): PlaywrightPage {
	const dom = new JSDOM(html, { url });
	const { window } = dom;

	Object.defineProperty(window.HTMLElement.prototype, "innerText", {
		configurable: true,
		get() {
			return this.textContent ?? "";
		},
	});
	window.HTMLElement.prototype.getBoundingClientRect = () =>
		({ width: 100, height: 20 }) as DOMRect;

	vi.stubGlobal("document", window.document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("Node", window.Node);
	vi.stubGlobal("navigator", window.navigator);

	return {
		evaluate: async (
			operation: (params: unknown) => unknown,
			params: unknown,
		) => operation(params),
	} as unknown as PlaywrightPage;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ChatGPT citation extraction", () => {
	it("extracts the title and cited excerpt from source links and strips URL fragments", async () => {
		const page = createPage(
			`
				<ul>
					<li>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://docs.example.com/hosting#availability"
						>
							<span>docs.example.com</span>
							<span>Managed hosting guide</span>
							<span>Detailed evidence about uptime, support, and service availability.</span>
						</a>
					</li>
				</ul>
			`,
			"https://chatgpt.com/",
		);

		const sources = await runPageDomOp<RawSource[]>(page, "raw-sources", {
			provider: "chatgpt",
		});

		expect(sources).toEqual([
			{
				rawHref: "https://docs.example.com/hosting",
				title: "Managed hosting guide",
				citedText:
					"Detailed evidence about uptime, support, and service availability.",
			},
		]);
	});
});

describe("Gemini citation extraction", () => {
	it("extracts source cards without including unrelated page links", async () => {
		const page = createPage(
			`
				<inline-source-card>
					<a href="https://support.example.com/api">
						<span>support.example.com</span>
						<span>Official API reference</span>
						<span>Reference documentation for API limits and authentication.</span>
					</a>
				</inline-source-card>
				<a href="https://unrelated.example.com/">Unrelated page</a>
			`,
			"https://gemini.google.com/",
		);

		const sources = await runPageDomOp<RawSource[]>(page, "raw-sources", {
			provider: "gemini",
		});

		expect(sources).toEqual([
			{
				rawHref: "https://support.example.com/api",
				title: "Official API reference",
				citedText: "Reference documentation for API limits and authentication.",
			},
		]);
	});
});

describe("Claude citation extraction", () => {
	it("extracts citations from the latest visible assistant response", async () => {
		const page = createPage(
			`
				<div id="assistant-response">
					This answer explains managed hosting reliability and support options.
					<a href="https://docs.example.com/claude-guide">Official service guide</a>
				</div>
			`,
			"https://claude.ai/",
		);

		const sources = await runPageDomOp<RawSource[]>(page, "raw-sources", {
			provider: "claude",
			selectors: ["#assistant-response"],
		});

		expect(sources).toHaveLength(1);
		expect(sources[0]).toMatchObject({
			rawHref: "https://docs.example.com/claude-guide",
			title: "Official service guide",
			citedText:
				"This answer explains managed hosting reliability and support options.",
		});
	});
});

describe("Google AI Overview citation extraction", () => {
	it("extracts source cards from the right-hand overview container", async () => {
		const page = createPage(
			`
				<div data-container-id="rhs-col">
					<div data-src-id="source-1">
						<a
							href="https://status.example.com/"
							aria-label="Service status report. Opens in new tab"
						>Open source</a>
						<span data-crb-snippet-text>
							Current uptime and incident history for the service.
						</span>
					</div>
				</div>
			`,
			"https://www.google.com/search?q=managed+hosting",
		);

		const result = await runPageDomOp<{
			rawSources: RawSource[];
			containerFound: boolean;
		}>(page, "raw-sources", { provider: "ai-overview" });

		expect(result.containerFound).toBe(true);
		expect(result.rawSources).toEqual([
			{
				rawHref: "https://status.example.com/",
				title: "Service status report",
				citedText: "Current uptime and incident history for the service.",
			},
		]);
	});

	it("reports a missing overview container instead of fabricating sources", async () => {
		const page = createPage(
			"<main>No AI Overview is present on this result page.</main>",
			"https://www.google.com/search?q=managed+hosting",
		);

		const result = await runPageDomOp<{
			rawSources: RawSource[];
			containerFound: boolean;
		}>(page, "raw-sources", { provider: "ai-overview" });

		expect(result).toEqual({ rawSources: [], containerFound: false });
	});
});

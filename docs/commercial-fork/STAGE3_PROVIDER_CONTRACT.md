# Stage 3 provider layer contract

## Goal

Decouple AI execution from browser automation without changing the measurement
methodology of existing runs.

The Worker talks to an `AIProviderAdapter`. Concrete adapters may use a real
product browser UI, an official API, a third-party scraper, or a test/mock
implementation.

## Non-negotiable rules

1. **Browser remains the default capture surface.**
   Browser UI results and raw model API output are not equivalent GEO
   measurements. The router must never silently fall back from browser to API or
   scraper.

2. **API/scraper capture is explicit.**
   A caller must request `preferredCaptureTypes: ["api"]` or another non-browser
   surface.

3. **Capabilities are enforced before execution.**
   Routing can require citations, search, location support, or specific auth
   modes.

4. **Worker orchestration stays adapter-agnostic.**
   Progress, cancellation, persistence, analysis and error handling must not
   import browser-specific execution code.

5. **Every adapter exposes operational identity.**
   `adapterId`, provider, capture type, enabled state and capabilities are
   available through the Agent health inventory.

6. **Cost is a contract, not a guessed number.**
   API adapters may return provider/API cost estimates. Browser execution uses an
   infrastructure basis and returns `amount: null` until a real cost model is
   available.

## Stage 3 acceptance

- Existing browser adapters behave exactly as before.
- Browser is the only implicit default.
- Explicit API routing can be added without changing Worker control flow.
- Router tests cover default methodology, capability filtering, preferred
  adapter selection and disabled adapters.
- Agent health output lists all registered adapters and capabilities.
- Lint, typecheck, tests, build, amd64 and arm64 runtime image tests all pass.

## Out of scope for this first Stage 3 slice

- Real OpenAI/Anthropic/Gemini API execution adapters.
- China-provider credentials.
- Per-workspace capture-policy UI.
- Billing/quota charging.
- Provider-specific price tables.

Those are added only after this contract is green and stable.

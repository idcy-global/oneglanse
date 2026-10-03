# Stage 3 — AI Provider Layer

## Goal

Decouple logical AI engines from the mechanism used to capture their answers.

A logical provider such as `chatgpt` may eventually be executed through:

- Browser UI
- Official/API-compatible endpoint
- Commercial scraper
- Test/mock adapter

The rest of the system should not need to know which capture mechanism was used.

## Runtime contract

```text
Prompt Job
  -> ProviderRouter
  -> AIProviderAdapter
       -> Browser
       -> API
       -> Scraper
       -> Mock
  -> ProviderExecutionResult
  -> Existing response storage
  -> Existing analysis pipeline
```

## Compatibility rule

Stage 3A preserves the current production path:

```text
logical provider -> browser adapter
```

Browser remains first in the default routing order until a later commercial
configuration explicitly selects another capture mechanism.

## Core abstractions

`@oneglanse/providers` owns:

- `AIProviderAdapter`
- `ProviderExecutionResult`
- capture type
- capabilities
- auth mode
- registry
- router

It deliberately does not depend on Playwright or browser code.

The Browser implementation remains in `apps/agent`, where Playwright already
belongs.

## Cancellation

The generic execution context exposes a cancel-handler seam. Browser adapters
use it to close the active browser context immediately. Future HTTP/API
adapters can use the same contract with an AbortController or request-specific
cleanup.

## Authentication

Authentication is adapter-specific:

- Browser: `browser-session`
- API: `api-key`
- Scraper: typically `api-key`
- Mock: `none`

The worker no longer assumes every future provider must have a browser session.

## Stage 3 acceptance sequence

### 3A — compatibility abstraction
- provider core package
- registry/router
- browser adapter
- worker routed through adapter
- browser remains default
- existing amd64/arm64 runtime tests pass

### 3B — normalized capture metadata
- persist capture type
- persist adapter/model/region/locale/cost metadata
- keep analysis independent of capture method

### 3C — non-browser adapter proof
- add a mock adapter end-to-end test
- add API adapter base
- route one logical provider through Browser/API/Mock using the same worker path
- verify storage and analysis remain unchanged

Do not remove the Browser implementation during Stage 3.

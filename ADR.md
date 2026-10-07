# Architecture Decision Records

This document records the significant architectural decisions made in **Cognitive Recall API**, including the context, the choice made, and the consequences. It was started on 2026-10-07 and reconstructs the decisions made since the first commit (2026-09-25). It is maintained going forward: every significant decision gets a new numbered entry.

**Statuses:** `Proposed` · `Accepted` · `Deprecated` · `Superseded by ADR-XXXX`

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](#adr-0001-record-architecture-decisions) | Record architecture decisions | Accepted | 2026-10-07 |
| [0002](#adr-0002-chrome-manifest-v3-extension-as-the-client) | Chrome Manifest V3 extension as the client | Accepted | 2026-09-29 |
| [0003](#adr-0003-single-repository-with-backend-extension-and-shared-folders) | Single repository with `backend/`, `extension/` and `shared/` | Accepted | 2026-09-27 |
| [0004](#adr-0004-fastify-and-trpc-for-the-backend-api) | Fastify and tRPC for the backend API | Accepted | 2026-09-29 |
| [0005](#adr-0005-fetch-youtube-transcripts-server-side) | Fetch YouTube transcripts server-side | Accepted | 2026-09-29 |
| [0006](#adr-0006-bucket-transcript-timestamps-into-60-second-markers) | Bucket transcript timestamps into 60-second markers | Accepted | 2026-10-07 |
| [0007](#adr-0007-vercel-ai-sdk-with-google-gemini-as-the-llm-provider) | Vercel AI SDK with Google Gemini as the LLM provider | Accepted | 2026-10-04 |
| [0008](#adr-0008-schema-validated-structured-output-from-the-llm) | Schema-validated structured output from the LLM | Accepted | 2026-10-03 |
| [0009](#adr-0009-grounded-socratic-prompt-design) | Grounded, Socratic prompt design | Accepted | 2026-10-03 |
| [0010](#adr-0010-retry-with-backoff-for-llm-calls) | Retry with backoff for LLM calls | Accepted | 2026-10-04 |
| [0011](#adr-0011-centralized-error-catalog-in-shared) | Centralized error catalog in `shared/` | Accepted (partially adopted) | 2026-10-04 |
| [0012](#adr-0012-route-api-calls-through-the-extension-service-worker) | Route API calls through the extension service worker | Accepted | 2026-09-29 |
| [0013](#adr-0013-environment-configuration-with-dotenv-and-fail-fast-startup) | Environment configuration with dotenv and fail-fast startup | Accepted | 2026-10-04 |
| [0014](#adr-0014-typescript-everywhere-with-strict-compiler-settings) | TypeScript everywhere with strict compiler settings | Accepted | 2026-09-26 |
| [0015](#adr-0015-vite-multi-entry-build-for-the-extension) | Vite multi-entry build for the extension | Accepted | 2026-09-29 |

---

## ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-07

### Context
The project moved quickly through setup, backend, extension and AI integration without written design notes. Several decisions (for example replacing OpenRouter with Gemini) are only visible in commit history.

### Decision
Keep a lightweight ADR log in this file. Each decision gets a numbered entry with Status, Context, Decision, Alternatives and Consequences. Superseded decisions are kept and marked, not deleted.

### Consequences
- Positive: onboarding and future refactors have a written rationale.
- Negative: small ongoing documentation cost.

---

## ADR-0002: Chrome Manifest V3 extension as the client

- **Status:** Accepted
- **Date:** 2026-09-29

### Context
The product goal (see README) is to turn passive video watching into active recall without leaving the browser. The client needs access to the active YouTube tab and a lightweight UI.

### Decision
Build a Chrome extension on **Manifest V3**: a service worker (`background.js`) for network and logic, a popup (`popup.html`) for the UI, and a content script scoped to `https://*.youtube.com/watch?*`. An earlier manifest was migrated to MV3 in `fix(extension): migrate manifest to MV3 service worker and popup`.

### Alternatives considered
- **Standalone web app:** would need the user to paste URLs and leave the video.
- **Manifest V2:** being phased out by Chrome.

### Consequences
- Positive: the extension reads the current tab URL directly; no copy-paste flow.
- Negative: MV3 service workers are ephemeral, so long operations need careful message handling (see ADR-0012). The content script is currently an empty placeholder.

---

## ADR-0003: Single repository with `backend/`, `extension/` and `shared/`

- **Status:** Accepted
- **Date:** 2026-09-27

### Context
The extension and the API are developed together and need to share types and constants.

### Decision
Use one repository with three top-level folders: `backend/` (Fastify server), `extension/` (MV3 extension), and `shared/` (code used by both, e.g. `shared/errors.ts`). A root `package.json` holds dependencies common to the packages. Both TypeScript configs set `rootDir` to the repository root (`../`) so each package can import across folders.

### Alternatives considered
- **Separate repositories:** more overhead to keep API and client contracts in sync.
- **Full workspace tooling (npm/pnpm workspaces, Turborepo):** not needed at this size; may be revisited.

### Consequences
- Positive: one PR can change API and client together; types are shared directly.
- Negative: the compiled backend output nests under `dist/backend/src/` because of the repo-root `rootDir`. Dependencies are split across root and package-level `package.json` files and should be consolidated eventually.

---

## ADR-0004: Fastify and tRPC for the backend API

- **Status:** Accepted
- **Date:** 2026-09-29

### Context
The backend exposes a small number of operations to a TypeScript client that the same developer controls.

### Decision
Use **Fastify** as the HTTP server (with `@fastify/cors`) and **tRPC** for the API layer, mounted at `/trpc` through `fastifyTRPCPlugin`. Inputs are validated with **Zod**. The first procedure is `getTranscript` (a mutation that takes `videoUrl` and `language`). The extension imports the router's type (`youtubeRouterType`) to get a fully typed client.

### Alternatives considered
- **REST with hand-written types:** types between client and server could drift.
- **Express:** Fastify offers better performance and first-class schema/plugin support.
- **GraphQL:** too heavy for the current number of operations.

### Consequences
- Positive: end-to-end type safety and runtime input validation with little boilerplate.
- Negative: couples the client to TypeScript and to tRPC; a non-TypeScript client would need a different contract (e.g. OpenAPI).

---

## ADR-0005: Fetch YouTube transcripts server-side

- **Status:** Accepted
- **Date:** 2026-09-29

### Context
The AI needs the full video transcript. The content script could read it from the page, or the backend could fetch it.

### Decision
The backend fetches the transcript with the `youtube-transcript` library, given the video URL sent by the extension.

### Consequences
- Positive: the client stays thin; the extension needs no scraping logic; transcript handling is testable on the server.
- Negative: depends on an unofficial library that can break when YouTube changes; videos without captions fail (a dedicated `NO_CAPTIONS` error is defined, see ADR-0011). Language selection was removed from the transcript request in `fix(backend): will remove unnecessary language requirements`; `language` now only controls the language of the generated output.

---

## ADR-0006: Bucket transcript timestamps into 60-second markers

- **Status:** Accepted
- **Date:** 2026-10-07

### Context
Questions need a timestamp so the learner can jump back to the relevant part of the video. Raw captions are very short segments, which would inflate the prompt size and token cost.

### Decision
Group caption segments into 60-second buckets. Each bucket starts on a new line prefixed with `[Ns]` (e.g. `[120s]`), followed by the concatenated text. The prompt instructs the model to copy `timestampSeconds` from these markers only.

### Alternatives considered
- **Per-segment timestamps:** more precise but many more tokens.
- **Larger buckets:** cheaper but less precise jump targets.

### Consequences
- Positive: smaller prompts; timestamps are tied to real markers and are easier to validate.
- Negative: timestamp precision is limited to the bucket start; the interval is a hard-coded constant (`intervalSeconds = 60`).

---

## ADR-0007: Vercel AI SDK with Google Gemini as the LLM provider

- **Status:** Accepted
- **Date:** 2026-10-04
- **Supersedes:** the initial OpenRouter / OpenAI-compatible setup (2026-10-03)

### Context
The first AI integration used the Vercel AI SDK with OpenRouter. Commit `feat(ai): replace OpenRouter with Gemini` switched providers.

### Decision
Use the **Vercel AI SDK** (`ai`) with `@ai-sdk/google` and the Gemini model `gemini-3.1-flash-lite`, called through `generateText`. Thinking is disabled (`thinkingBudget: 0`) and `temperature` is `0.3` to keep latency and cost low and output stable.

### Alternatives considered
- **OpenRouter (initial choice):** provider flexibility, but dropped in favor of Gemini's direct integration and better structured JSON output.
- **Calling a provider SDK directly:** the AI SDK keeps the provider swappable behind one interface.

### Consequences
- Positive: provider-agnostic code path; low-latency, low-cost model; simple key management (one `GEMINI_API_KEY`).
- Negative: vendor dependency on Google's quotas and rate limits (handled in ADR-0010). `@ai-sdk/openai-compatible` and `@openrouter/ai-sdk-provider` remain in `backend/package.json` and can be removed.

---

## ADR-0008: Schema-validated structured output from the LLM

- **Status:** Accepted
- **Date:** 2026-10-03

### Context
The extension renders questions and code exercises, so the model response must be machine-readable. Free-form text caused rendering problems early on (for example the `[object Object]` bug fixed on 2026-10-04).

### Decision
Define a Zod schema (`TranscriptQuestions`) and use the AI SDK's `Output.object` so responses are validated against it:

- `title`, `language`
- `questions.general[]`: `question`, `timestampSeconds`
- `questions.coding[]`: `task`, `code`, `lang`, `filename`

### Consequences
- Positive: typed, validated payload that the UI can trust structurally.
- Negative: schema violations surface as errors and are retried (ADR-0010); the schema is a contract that the prompt and UI must stay in sync with.

---

## ADR-0009: Grounded, Socratic prompt design

- **Status:** Accepted
- **Date:** 2026-10-03

### Context
The product's value depends on questions that are accurate to the video and that promote understanding, not recall of trivia. LLMs tend to hallucinate facts and invent timestamps.

### Decision
The system prompt enforces:

1. **Grounding first:** only use transcript content; every question must be answerable from a specific passage; timestamps must be copied from `[Ns]` markers.
2. **Permission to return less:** an empty array is valid if the transcript lacks educational content.
3. **Socratic question style:** "why / how / what would happen if" questions, standalone wording, no duplicates, coverage across the whole video.
4. **Conditional coding practice:** 2-4 exercises only if the video teaches code; starter code with `TODO`s, no full solutions.
5. **Output language:** questions and tasks in the requested language, code kept in its original form.

The user prompt asks for 8-12 questions and a final self-check against the transcript.

### Consequences
- Positive: fewer hallucinations; consistent question quality; sensible behavior on non-educational videos.
- Negative: prompt is long and must be maintained; quality is not yet measured by automated evaluation.

---

## ADR-0010: Retry with backoff for LLM calls

- **Status:** Accepted
- **Date:** 2026-10-04

### Context
Free/low-tier LLM quotas hit rate limits (HTTP 429), and structured output can occasionally fail validation.

### Decision
Wrap the generation call in up to **3 attempts**, with SDK-level retries disabled (`maxRetries: 0`) so retry behavior is controlled in one place. After a rate-limit error the wait is **65 seconds** (to let a rolling per-minute token window clear); otherwise the wait grows by 10 seconds per attempt (10s, 20s). After the last failure a generic error is thrown.

### Consequences
- Positive: resilient to transient failures and quota windows.
- Negative: a single request can take minutes in the worst case, which is why the client timeout is 120 seconds (ADR-0012). Retries are in-process and not shared across requests.

---

## ADR-0011: Centralized error catalog in `shared/`

- **Status:** Accepted (partially adopted)
- **Date:** 2026-10-04

### Context
Errors need consistent messages and a `retryable` flag that both the backend and the extension can understand.

### Decision
`shared/errors.ts` defines a typed catalog (`NO_CAPTIONS`, `RATE_LIMITED`, `INVALID_URL`, `VIDEO_UNAVAILABLE`, `VIDEO_TOO_LONG`, `NOT_EDUCATIONAL`, `AI_TIMEOUT`, `AI_BAD_OUTPUT`, `SERVER_CONFIG`, `UNKNOWN_ERROR`). Each entry has a user-facing `message`, a `retryable` boolean and a tRPC-compatible `code`. `getErrorResponse(key)` returns the payload.

### Consequences
- Positive: one source of truth for user-facing errors, reusable by the API and UI.
- Negative / follow-up: the router currently catches all failures and throws a single generic `INTERNAL_SERVER_ERROR` via `TRPCError`; the catalog is not yet mapped to specific failure causes. Adopting it in `youtubeRouter.ts` and `aiResponser.ts` is the next step.

---

## ADR-0012: Route API calls through the extension service worker

- **Status:** Accepted
- **Date:** 2026-09-29

### Context
The popup is short-lived (it closes when focus is lost) and has limited access to extension APIs such as querying tabs.

### Decision
The popup sends a `TRIGGER_FETCH` message with the target language. The background service worker:

1. Reads the active tab URL via `chrome.tabs.query`.
2. Validates that it is a YouTube URL.
3. Calls the backend through a typed tRPC client (`httpBatchLink`) with a **120-second abort timeout**.
4. Replies to the popup with `{ success, output }` or `{ success: false, error }`.

The listener returns `true` to keep the message channel open for the async reply. A later commit added a timeout on the background-to-popup channel.

### Consequences
- Positive: a clear separation: the popup handles presentation; the worker handles tabs and network.
- Negative: MV3 workers can be terminated during very long requests; a request may be lost if the worker stops. Error handling in the popup still has a rough edge (it rethrows a `TRPCError` from server-side code in client code, which should be revisited).

---

## ADR-0013: Environment configuration with dotenv and fail-fast startup

- **Status:** Accepted
- **Date:** 2026-10-04

### Context
The Gemini API key must stay out of source control and the server must work both locally and in cloud environments.

### Decision
Load `.env` with `dotenv` from the current working directory or its parent (fixed in `refactor(ai): correct the env paths`). If neither exists, assume variables are injected by the host. If `GEMINI_API_KEY` is missing the process logs an error and exits immediately. `.env` variants are listed in `.gitignore`.

### Consequences
- Positive: misconfiguration is detected at startup rather than at the first request; works with local files or injected variables.
- Negative: the check runs at module import time and calls `process.exit`, which makes the module harder to unit test.

---

## ADR-0014: TypeScript everywhere with strict compiler settings

- **Status:** Accepted
- **Date:** 2026-09-26

### Context
Backend, extension and shared code are all written by the same developer and share types through tRPC.

### Decision
Use TypeScript in all packages with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `isolatedModules`. The backend emits ESM using `module` and `moduleResolution` set to `node16` (switched in `fix(backend): switch moduleResolution to node16 for ESM imports`, which requires `.js` extensions on relative imports). The extension uses `moduleResolution: bundler` with `noEmit`, leaving output to Vite.

### Consequences
- Positive: strong type checking across the API boundary.
- Negative: ESM `.js` import suffixes in TypeScript sources are unusual to newcomers; the extension imports the router type from the backend source, which ties the two builds together.

---

## ADR-0015: Vite multi-entry build for the extension

- **Status:** Accepted
- **Date:** 2026-09-29

### Context
The extension needs separate bundles for the service worker, the popup and the content script, with predictable file names that match `manifest.json`.

### Decision
Use **Vite** with three Rollup inputs (`background`, `popup`, `content`) and fixed output names (`[name].js`). Static assets and the manifest live in `extension/public/`. The build script runs `tsc` (type checking only) before `vite build`.

### Consequences
- Positive: fast builds; file names match the manifest; type errors fail the build.
- Negative: the extension currently has no automated tests, and the content script has no logic yet.

---
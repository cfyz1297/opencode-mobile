# OpenCode Mobile 0.2.19 — test and release report

Date: 2026-10-22. Base: 0.2.18 (`722392b`). Journeys were derived from the current SDK, connection and chat flows.

## Result

- Baseline: 356 passing tests. Final: **418 passing tests**, 0 failures, 0 skipped.
- Added **54 production-SDK/directory-client HTTP integration tests**, 5 SSE framing tests and 3 test-runner subprocess tests.
- `npm run typecheck` passes. `npm run check:versions` passes for **0.2.19 (53)**.
- `npm test` now discovers files explicitly on Windows and Linux. Before this change it exited successfully with **0 tests on Windows**.
- CI now enforces 80% line, branch and function coverage before building the APK (`build.needs: test`).

## Coverage

Command: `npm run test:coverage` on Node.js 24.21.0.

| Scope | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| Production SDK (`src/lib/sdk.ts`) | 99.87% | 82.81% | 95.65% |
| All instrumented production modules and scripts | 95.57% | 84.56% | 94.72% |

**These are not whole-application coverage percentages.** Node reports modules loaded by the tests; React Native screens, Zustand stores and native Expo modules are not included. Test files and HTTP fixture implementations are excluded from the coverage calculation. Remaining SDK gap: parent-signal abort cleanup in its private timeout helper (no public SDK operation currently supplies that signal).

The integration tests instantiate the real `createClient`, use the actual HTTP methods, request bodies, headers, response/error parsing and V2 adapter, and communicate with an ephemeral loopback HTTP server. Only `expo/fetch` module resolution is substituted with Node's native fetch; endpoint implementation is controlled fixture data, not independent confirmation of a live V2 server contract.

## Confirmed bugs fixed

| Problem before the fix | Regression guarantee | Test file |
| --- | --- | --- |
| Model/agent switch failures were swallowed; prompts ran with the previous selection and cached the failed choice. | A failed switch rejects before the prompt POST; the next attempt retries. | `src/lib/sdk.integration.test.ts` |
| Module-global switch cache reused another client's session selection. | A new connection sends its own initial model switch even with identical session IDs. | `src/lib/sdk.integration.test.ts` |
| Cross-project chat creates scoped clients repeatedly; isolated SDK caches alone would repeat successful switches on every send. | A stable connection base reuses each directory client; replacing the base or choosing another directory starts isolated state. | `src/lib/sdk.integration.test.ts` |
| Module-global event adapter suppressed a second connection's assistant message when message IDs collided. | Clients have separate stream state; reconnecting the same client retains accumulated text. | `src/lib/sdk.integration.test.ts` |
| Generic HTTP errors lost their status, so the existing `file.roots()` 404 fallback never ran. | Unsupported roots returns null on 404; 500 still propagates; other HTTP errors retain their status. | `src/lib/sdk.integration.test.ts` |
| Prompt/command 401 errors became ordinary errors rather than authentication errors. | `isAuthError` recognizes failed prompt and command authentication. | `src/lib/sdk.integration.test.ts` |
| SSE dropped `data:` fields without a space and retained CR in CRLF payloads/sentinels. | Optional field spacing, split CRLF frames, payload whitespace, empty data and DONE filtering work. | `src/lib/sse.test.ts` |
| Quoted shell globs let `npm test` report success without running any tests on Windows. | Explicit discovery finds nested tests, propagates failures and rejects an empty suite. | `scripts/run-tests.test.mjs` |

## Additional journeys covered

- Connect with Unicode credentials and project directory; normalize trailing URL slashes; handle timeout, 401/403, 503, empty 204 and HTML proxy responses.
- Load global sessions across folders, filter children/search, sort then limit; load chronological messages with the server's maximum page limit.
- Create, rename, delete and revert sessions; compact and interrupt runs; preserve file-browser location envelopes and encode query paths.
- Send multiple text parts and image URIs; keep the server default unless explicitly selected; change reasoning variants; skip repeated successful switches.
- Load model catalogs/defaults, gracefully handle an absent default-model endpoint, and load project, agent, command, permission, question and config collections.
- Reply to session-scoped permissions and forms using their actual field keys/option values; reject a question.
- Receive busy/idle events and heartbeats, continue after malformed JSON or a failed rename refetch, and retain typed stream-authentication errors.

## TDD evidence

The detailed checkpoint record is in [docs/releases/0.2.19/testing.tdd.md](docs/releases/0.2.19/testing.tdd.md).

## Release status and limitations

Version name/code and both release-note channels are prepared for 0.2.19 (53). No dependencies were added. The release is deliberately a **draft**, pending device validation.

Live GitHub inspection on 2026-10-22 found **CUA Smoke Test** and **Activation E2E (Maestro)** manually disabled in this fork. They were left disabled. Their checked-in fixtures/workflows still reference the old V1 routes (`/global/health`, `/session/...`), so their existence is not evidence that the current V2 client passed Android UI tests. No Android device/emulator was available in this session. Native rendering, gestures, permissions, process/background lifecycle and actual Expo streaming on Android remain unverified; no Play Store rollout is performed.

The draft APK must come from a successful GitHub Actions build of this release branch, after the test job passes. Build URL and downloaded-artifact verification are recorded with the delivery, not claimed here before the build finishes.

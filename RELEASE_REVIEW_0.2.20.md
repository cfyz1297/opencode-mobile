# Release review — 0.2.20 (Android versionCode 54)

## Scope and provenance

Requested: implement the Cloudflare/ngrok wizard, tablet/iPad layout and offline session history in the cfyz1297 fork. Cloud server/profile connection work was explicitly excluded by the owner during this task.

Baseline: the owner’s prepared 0.2.19 is PR #1 / `codex/test-coverage-release` at `99552aada4efa41c323c7f77c10d125964717857`. It was not yet in main and had no public tag. That complete branch is merged into this work, preserving its SDK error propagation, per-client streaming/model state, stable directory clients, CRLF SSE fixes, 62 additional tests and 80% coverage gates. This release is 0.2.20 (54), built on the actual 0.2.19 code.

Studied upstream README and PR listing, including [PR 108](https://github.com/dzianisv/opencode-mobile/pull/108) (offline scripted demo, not offline history) and [PR 218](https://github.com/dzianisv/opencode-mobile/pull/218) (V2 compatibility). The upstream roadmap still describes Cloud as planned. These three features required local implementation, not blind merging of unrelated PRs.

## User journeys

| Journey | Implemented behavior | Proof |
|---|---|---|
| Connect through Cloudflare/ngrok | Three steps: select provider/host OS, start authenticated loopback server and tunnel on computer, paste HTTPS URL/password, test, save and activate exact returned profile ID | `tunnel.test.ts`: validation, success, auth rejection, save failure, duplicate submit; Android CUA checks commands and rejection before network |
| Use tablet and resize windows | Navigation rail >=768 dp; chat/session sidebar >=1000 dp; content width <=1100 dp; native portrait lock removed | `adaptive-layout.test.ts`; Android CUA landscape/portrait and sidebar switching |
| Read conversations after a cold offline restart | Explicitly enabled, per-connection encrypted copies, read-only plain-text viewer, timestamps, bounded retention, clear-all control | `offline-history.test.ts`; Android CUA seeded messages, stopped server, killed/restarted app and reopened saved copy |
| Keep servers isolated | In-flight list/create/select/pagination/refresh operations invalidated on server changes; originating scope retained for deletion; history view cannot display stale connection results | `session-isolation.test.ts`, connection-scoped view state |
| Open locally without a server | Connection configuration hydrates before background metadata requests; late metadata cannot overwrite a different client | `connection-bootstrap.test.ts` |

## TDD evidence

- `cb62af0`: first feature tests; RED because the referenced feature modules did not yet exist. Implemented modules and reran the same targets GREEN.
- `928c6f7`: two runtime reproductions for offline startup and late metadata; both failed on the previous code, both passed after the nonblocking bootstrap change.
- `3afa2c3`: runtime failures for native UTF-8 emoji boundaries, post-commit cleanup interruption and corrupt-manifest clear; missing capture gate also failed. All passed with code-point-safe chunks, fixed storage slots and serialized consent/capture.
- `e4cdb47`: runtime failures for late list/create responses and delete scope after server switch; all passed after connection epoch guards and origin capture.
- `b20c7ca`: tunnel coordinator contract tests, then GREEN with the real screen wired to the tested coordinator.
- `7e2f169` / `a1c1a09`: RED/GREEN for rejecting Cloudflare Quick Tunnels and guiding named-tunnel setup, based on official SSE limitations.

Commands actually run locally:

```
npm test
npm run typecheck
npm run check:versions
node --test --experimental-test-coverage src/lib/offline-history.test.ts src/lib/tunnel.test.ts src/lib/adaptive-layout.test.ts
npx --no-install expo export --platform android --output-dir ../../output/mobile-next-bundle
npx --no-install expo export --platform ios --output-dir ../../output/mobile-next-ios-bundle
```

Results: 446 tests passed, none failed/skipped; typecheck and version parity passed. New pure feature modules: 98.98% lines, 92.86% branches, 88.89% functions. Android and iOS Hermes bundles exported successfully. New-feature coverage refers to these pure modules. The complete instrumented module suite passes the inherited 80% gates with 95.72% lines, 85.46% branches and 93.87% functions. This excludes unimported native UI and is not whole-app coverage.

The build workflow tests the signed release APK on Android using `scripts/cua-roadmap-smoke.mjs`. This is deterministic computer-use via ADB/UIAutomator with exact seeded data, avoiding the upstream Azure-dependent vision workflow because the fork has no Azure secrets. Screenshots/XML/result are retained in `roadmap-smoke-evidence`. Package/version and certificate parity with the existing released APK are checked before publishing.

## Security review and fixes

Independent code, test and security reviews reproduced and fixed these issues before release:

1. Late responses from server A could populate/cache data under server B. Added request invalidation and deferred-response store integration tests.
2. A delete response resolved its cache scope after switching servers. Capture the original connection ID before sending the request.
3. Process death after commit could orphan old encrypted transcripts. Use two fixed slots and erase both slots during clear, independently of corrupt manifests; cover post-commit cleanup failure and recovery.
4. Native UTF-8 conversion corrupted split surrogate pairs. Chunk and truncate without splitting code points; test through a UTF-8 encoding adapter.
5. A delayed consent read or pending capture could recreate cleared/deleted history. Serialize consent and capture, cancel via synchronous epoch, block capture before profile removal.
6. History reload results could cross connection boundaries. Tag rendered data/selection by connection and guard asynchronous completion.

Focused re-review of `2b0f659`: original findings resolved; no additional concrete new defect reported. This is a focused review of the changes, not a claim of a full application penetration test.

Cloudflare compatibility: [Quick Tunnels do not support SSE](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#limitations). The wizard uses named Cloudflare tunnels, rejects trycloudflare.com URLs, and documents dashboard routing to the local service. The Cloudflare token stays on the computer and is never entered into the phone. Account/domain setup and noninteractive access compatibility are explicit prerequisites.

Controls: server bound to loopback in wizard commands; HTTPS public URL and nonempty password required; credentials/query secrets rejected in tunnel URLs; connection tested before persistence; password stored using existing SecureStore path; cache uses device-only/when-unlocked native storage; no tool outputs/attachments/reasoning in cache; no auto-replay of cached text into prompts or actions; bounded chunk count, payload size and retention; cached content rendered as plain text.

Dependency audit: `npm audit --omit=dev --json` initially reported 43 findings (2 critical, 32 high, 8 moderate, 1 low). Compatible lockfile fixes reduced this to 27 (0 critical, 24 high, 3 moderate). Most remaining findings are propagated through Expo/Metro/Jest/toolchain packages; residual root advisories include braces, node-forge, image-size, PostCSS, brace-expansion and decode-uri-component. **The dependency audit is not clean.**

In particular, `expo-router` / React Navigation → query-string → decode-uri-component is a potential runtime path: [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). The patched decoder 0.5.0 uses ESM while current query-string expects a callable CommonJS export. A blind override could break navigation. Reproducing reachability and adopting a compatible navigation upgrade remains separate work; this release does not claim zero runtime dependency risk.

## Limits

- Offline copies include only the recent loaded text page (up to 40 messages). Large messages/sessions may be truncated or evicted. They can contain sensitive conversation text despite native encryption.
- Existing snapshots are retained when capture is disabled; the clear action removes them and disables capture. Removing a connection also removes its local history.
- No managed cloud hosting, tunnel installation/execution on the computer, or account creation is performed by the app. ngrok requires the owner's separate account login.
- iOS JavaScript export passed; no iPad simulator/device or signed iOS build was available. Android tablet validation does not prove native iPad behavior.
- Android APK/emulator/release verification is recorded below after the CI gate completes.

## Release-channel evidence

Signed APK build, certificate comparison and Android CUA smoke passed on CI (roadmap smoke green on head `2f0740f` / reuse of signed APK from `0e01825`). Owner has **not** manually verified the new tunnel wizard, tablet layout or offline history on a personal device yet — treat user acceptance as still open after publish.

## Owner acceptance

New 0.2.20 surfaces are **not user-verified**. Automated tests and emulator CUA are necessary but not sufficient for claiming everyday readiness.

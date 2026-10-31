# OpenCode Mobile (cfyz1297 fork)

[Русский](README.ru.md) | **English**

A fork of [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) — an Expo/React Native client for a self-hosted `opencode serve`. The fork runs on **OpenCode API V2** (server 2.0.x) and ships as an APK from GitHub Releases; app stores are not used.

Version **0.2.27 (61)** continues the 0.2.20 user line. It installs over the previous build — no uninstall needed.

> **Important:** the 0.2.20 features (tunnel wizard, tablet layout, offline history) have still **not been verified by the user** on a real device against a real server. There are automated tests and an Android CUA smoke run on an emulator; that is not a substitute for manual checking.

## Install (Android, APK)

Stable link — always the latest release:

- **[Download opencode-mobile-v2.apk](https://github.com/cfyz1297/opencode-mobile/releases/latest/download/opencode-mobile-v2.apk)** (~86 MB)
- All releases: [Releases](https://github.com/cfyz1297/opencode-mobile/releases) — every new build gets its own release (`0.2.15`, `0.2.18`, …); the APK file is always named `opencode-mobile-v2.apk`

> ⚠️ One-time reinstall: since `0.2.9` the APK is signed with a permanent key (earlier every build generated a new debug key, so updates would not install over the old app). If you are on an older build, uninstall it **once** and install the current one; after that updates install in place.

The APK is built by GitHub Actions from `main` of this repository and signed with a permanent key from the repository secrets (a debug key is used when the secret is missing). Google Play / F-Droid / App Store — not used: those workflows are disabled. Only `Build Android APK` and `Security scan` are active.

## Connecting to an opencode server

You need an **opencode 2.0.x** server (V2 API). V2 is installed as a native binary — the `opencode-ai` npm package stayed on the 1.x line and does not serve `/api/*`.

1. Install and start the server:

   ```bash
   curl -fsSL https://opencode.ai/v2/install | bash
   OPENCODE_SERVER_PASSWORD=yourpassword opencode serve --hostname 0.0.0.0 --port 4096
   ```
2. In the app: **Add Connection** → server address (`http://IP:4096`), user `opencode`, password from the command above.

V2 specifics (verified on 2.0.27): Basic authentication only as `opencode:<password>` (Bearer and an empty user both return 401), all paths under `/api/*`, paginated responses as `{data, cursor}`, SSE at `GET /api/event`.

## How the fork differs from upstream

The base is upstream [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) at tag `v0.4.15` (2026-08-14). From there the fork has its own version line and its own goals: one user, one server in Termux, one delivery channel — an APK.

| What | Upstream | Fork |
|---|---|---|
| Server API | API 1.x (`/session`, `/global/*`) | **V2 only** (`/api/*`), server 2.0.x |
| Version | 0.4.x | 0.2.x line, currently 0.2.27 (61) |
| Signing and updates | new debug key per build in old versions | permanent keystore, installs in place |
| Channels | Google Play, self-hosted F-Droid, APK, EAS | APK from GitHub Releases only |
| Telemetry | Sentry (crash reports) + PostHog | both dependencies removed |
| Languages | English, 简体中文 | + Russian (en / ru / zh-Hans with key parity check) |
| Orientation | portrait only | any, tablet layout from 768 dp, two panes from 1000 dp |
| Offline history | planned | available, encrypted with Keystore/Keychain |
| Tunnel wizard | beta | Cloudflare (named tunnels) and ngrok, built-in wizard |
| Models screen | none | search, groups, visibility — affects both pickers |
| Connection status | "selected" means "active" | real server response, polled on focus and every 15 s |
| Run recovery | none | silence watchdog, transcript re-read, `GET /api/session/active` |
| Keyboard | JS inset | native IME inset in `MainActivity` |
| New session folder | default | the selected project (`location.directory` in the request body) |
| Tests | `node --test` over a glob | `scripts/run-tests.mjs` + 80 % coverage gate, CUA smoke on an emulator |

What changed in the code:

- **Adapter `src/lib/v2-compat.ts`**: V2 responses and events are normalized to the V1 shape, so stores and screens stayed as they were. V1 events (`session.status`, `message.part.updated`) are assembled from V2 deltas (`session.text.delta`, `session.reasoning.delta`, `session.tool.*`).
- **SDK** switched to `/api/session`, `/api/event`, `/api/info`, `/api/permission/request`, `/api/fs/*`, `/api/project`, `/api/location`. Changing a session's model/agent goes through `POST /api/session/{id}/model` and `/agent`.
- **New screens and logic**: `app/history.tsx` (offline history), `app/models.tsx` (model visibility), `app/providers/*` (provider catalog and key-based connection through the server), `app/connection/tunnel.tsx` (tunnel wizard), `src/components/TabletSessions.tsx` (tablet), `src/lib/adaptive-layout.ts`, `src/lib/connection-health.ts`, `src/lib/connection-security.ts`, `src/lib/run-watchdog.ts`, `src/lib/stream-watchdog.ts`, `src/lib/keyboard-inset.ts`.
- **V2 specifics**: agent questions go through V2 forms, compaction summaries are visible in the transcript, image attachments render as images, the chat follows the stream, the composer clears after a built-in command.
- **Client isolation**: the SDK client is bound to its connection, so streamed messages and the selected model do not leak between servers.
- **Removed along with the infrastructure**: `website/`, `docs-site/`, `fastlane/`, `fdroid/`, `distribution/`, `eas.json`, `.maestro/`, `.autopilot/`, `.supervisor/`, `.tasks/`, the iOS build and store-publishing workflows, the Sentry plugin and source-map upload.
- **Security**: the `SYSTEM_ALERT_WINDOW` permission is blocked, passwords and offline copies are written with the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy, and the connection form warns about a password over unencrypted `http://`.

What the fork does not have (by design or not yet): provider OAuth connections (API key only), OpenCode Cloud (waitlist only), iOS builds, stores and telemetry.

## What is kept from upstream

Demo mode without a server, multiple connections (LAN, tunnel, Tailscale), biometric unlock, streaming chat, diff viewer, tool-call approval, agent questions, secure password storage, notifications, a new-version banner. See the [upstream README](https://github.com/dzianisv/opencode-mobile#readme) for details.

## Security

- Server passwords and offline history live in the Android Keystore / iOS Keychain with the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy: they do not end up in OS backups and are not restored on another device.
- Plain `http://` encrypts neither the password nor the transcript. The connection forms warn about it; use https, a tunnel or Tailscale on untrusted networks. Loopback (Termux on the same phone) shows no warning — traffic never leaves the device.
- The app does not request `SYSTEM_ALERT_WINDOW` (drawing over other apps).
- Build dependencies: `npm audit` reports 11 vulnerabilities in the Metro/PostCSS/Espree chain (`npm audit fix --force` downgrades Expo to 44 and breaks the build). None of that code ships in the APK — it only runs during the CI build.

## Cloudflare / ngrok wizard

Cloudflare needs a **named tunnel**, an account and a domain: in the Cloudflare dashboard create a Tunnel and a Published application route with the Service URL `http://127.0.0.1:4096`, then run the command with the token on your computer. The Cloudflare token is never entered in the app. Quick `trycloudflare.com` addresses are rejected by the wizard: [they do not support SSE](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#limitations), which streaming replies require. The alternative without your own domain is ngrok. Installing cloudflared/ngrok and logging into ngrok is done by the computer's owner.

## Building from source

```bash
git clone https://github.com/cfyz1297/opencode-mobile
cd opencode-mobile
npm install
npm run android            # dev build on a device/emulator
```

The release APK is built by GitHub Actions (`.github/workflows/build.yml`) on every push to `main` and on `v*` tags: tests, typecheck and version parity first, then `expo prebuild` + `gradlew assembleRelease`. The artifact is `app-release`; the GitHub release with the APK is published manually.

Tests (Node.js 24+): `npm test`. Total coverage with an 80 % gate: `npm run test:coverage`. Typecheck: `npm run typecheck`. Versions in `package.json`, `app.json` and `android/app/build.gradle`: `npm run check:versions`.

The build includes an Android CUA smoke: the release APK, wizard commands, rejection of HTTP before any network access, switching between sessions in two panes, window resizing, a cold restart without a server, reading and clearing history. The `roadmap-smoke-evidence` artifact holds screenshots and the result.

Security review and the reasoning behind the fixes: [docs/security-review-0.2.21.md](docs/security-review-0.2.21.md), connection status: [docs/connection-status-validation.md](docs/connection-status-validation.md), model visibility: [docs/model-visibility-validation.md](docs/model-visibility-validation.md), run recovery: [docs/run-resync-validation.md](docs/run-resync-validation.md). Current project state and the release order: [HANDOFF.md](HANDOFF.md).

A separate pure-Java client without Gradle (`aapt → ecj → d8 → apksigner`), also on the V2 API, lives in another repository.

## Updates

<details>
<summary>Changelog by version (0.2.11 – 0.2.27)</summary>

### 0.2.27

- **Tools and thoughts now appear in the chat in the same order as on the desktop.** An agent reply used to look like "a wall of reasoning on top, every tool call at the bottom": the model's interim text between steps was buried in the pile, and the "Ran N commands" row repeated on every step. Now each step shows its own reasoning, its own tool row and its own text in the order the model produced them: prompt → thoughts → tools → "Now the plan: …" → tools again → final answer. The "Assistant + model" header appears once per run.
- **The footer reports the cost of the whole run, not of the last step.** It used to show tokens and money for the final roundtrip only, which made a long run look several times cheaper than it was. Now everything from your message to the end of the reply is summed.
- **Command labels match the server again.** `isCommandRun` and the call details only knew `bash`, while V2 names the tool `shell`: real command runs got the "Ran N tools" label with a puzzle icon and lost their command preview. Fixed.
- **Google Play coupling removed.** The app is not distributed through stores, so the rating prompt via Play In-App Review (`expo-store-review`) is gone along with the dependency, the session counter in SecureStore and the threshold policy. The APK no longer contains any store code.

### 0.2.26

- **Chat layout restored.** In 0.2.25 the questions block took half the screen and pushed messages up with an empty strip above the input: React Native's `ScrollView` has `flexGrow: 1` by default, so even an empty block grew upward. It no longer grows, and shrinks only when the card does not fit. Covered by a test.

### 0.2.25

- **The input no longer hides behind the keyboard.** With the keyboard open the whole app window now shrinks under it natively (previously only an inner block adjusted, so the bottom of the screen — including the input row — stayed underneath). The questions block also became scrollable: with pending questions it used to push the input row off-screen, so you could not type without closing the keyboard. The input row is always visible now, and the answers scroll in the remaining space. Covered by tests.

### 0.2.24

- **A new session is created in the selected project, not in the server's home folder.** Selecting a project (from recent ones, from server projects, in the folder browser, or through the project switcher) now really opens the session in that folder. V2 previously ignored the folder header when creating a session and put every new session in its own working directory — usually `~`. The folder is now sent in the request body (`location.directory`); covered by an SDK HTTP test.
- **The input field no longer hides behind the keyboard.** When typing an answer, the keyboard covered the input row: the app raised the UI by the height of the system navigation bar instead of the keyboard height (a height calculation bug, not the keyboard itself). The inset now comes from the system keyboard inset; the fix is shared by every screen with input — chat, new session, connections. Covered by a calculation test.

### 0.2.23

- **A session revives after a network drop.** If a run finished (or broke off) on the server while the phone had no network, the app now asks the server what it is actually running and clears "Working…": the session accepts messages again and the past work is shown. Previously the spinner and the blocked input stayed forever — only an app restart helped.

### 0.2.22

- **A reply no longer "hides" until you re-enter the session.** If one run's events were lost while the socket is alive, the app now re-reads the transcript after 12 seconds of silence: the reply appears on screen, "Working…" clears, and if the model is still working the part already written is pulled in. Previously only leaving the session and coming back helped.

### 0.2.21

- **Honest connection status**: "Active" now means the server responded, not that the connection is selected. If `opencode serve` in Termux is stopped, the row shows "Server unreachable" with a red icon. The check runs when the tab opens, every 15 s and when the app returns to the foreground; the result is bound to its server, so a stale connection's answer does not paint the new one.
- **Models screen** next to Providers: search, groups by provider, visibility switches. A hidden model disappears from both pickers — in the session and in New Session.
- **Providers**: a short list of popular ones (OpenCode Zen/Go first); connecting by key is passed to the server through `opencode serve`. No keys are stored in the APK.
- **Security**: a warning before sending a password over unencrypted http, passwords marked "this device only", the `SYSTEM_ALERT_WINDOW` permission removed.

### 0.2.20

- **Cloudflare / ngrok wizard**: Add Connection → Cloudflare / ngrok setup. Choose the service and the computer's OS, run two commands on the computer, then paste the tunnel's HTTPS address and the server password. The app checks the connection before saving. The server binds to loopback; the tunnel requires a password.
- **Tablets**: side navigation from 768 dp, the session list next to the chat from 1000 dp, a width limit for the transcript, and support for orientation/window-size changes.
- **Offline history**: Settings → Offline session history → enable saving, then open a session online. Local copies stay available after a restart without network. Up to 20 sessions per connection, up to the last 40 text messages per session; long messages and total size are capped. Storage is protected by Android Keystore / iOS Keychain; tools, attachments and reasoning are excluded. Clearing removes copies for all connections and turns further saving off. Copies are read-only and are never sent to the model.

### 0.2.19

- The SDK client is bound to its connection: streamed messages and the selected model no longer leak between servers and projects. API errors are stored as errors.

### 0.2.18

- The model catalog is indexed by `Model.Info.id`, so changing the model in a session applies to the right model.

### 0.2.17

- The composer clears after selecting a built-in command.

### 0.2.16

- The transcript follows the streaming reply.

### 0.2.15

- A "dead" SSE stream recovers on its own, without re-entering the session.

### 0.2.14

- V2 image attachments render as images instead of a white block; it is visible when your own answer variant was applied.

### 0.2.13

- Answers to agent questions are confirmed in the chat; lost prompts are restored.

### 0.2.12

- The question flow moved to the V2 forms service (BUG-004).

### 0.2.11

- Compaction summaries are visible in the transcript; untranslated role labels fixed.

</details>

## License and credits

MIT — see [LICENSE](LICENSE). Upstream [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) and [sst/opencode](https://github.com/sst/opencode) are credited.

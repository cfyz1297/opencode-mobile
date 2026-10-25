# Model visibility settings — validation (2026-10-25)

## Behavior

Settings lists Providers and Models together. Models shows the connected catalog,
search and per-model switches. Hidden models are omitted from both session and
New Session pickers. Model visibility is saved locally per connection ID; existing
session model selection is intentionally preserved. This is device UI preference,
not a server-side authorization or model-disable policy.

## TDD and checks

- RED: `node --test src/lib/model-visibility.test.ts` failed with missing implementation.
- GREEN: persistence roundtrip, re-enable, connection/provider isolation, rapid queued
  writes, failed writes/read retry, malformed persisted data, collision-resistant IDs,
  and hiding a selected model all pass.
- Component tests execute the real screen and hook with deterministic native/storage
  adapters. Verified grouped rows, toggle, search, error feedback, scope changes,
  pending-response discard, client replacement under the same ID, and A→B→A gating.
- Reviewer regression RED: same-ID client replacement test failed `1 !== 0`.
  GREEN after binding catalog ownership to both client identity and connection ID.
- Full test suite: **508 passed, 0 failed, 0 skipped**.
- TypeScript check: passed.
- New persistence helper: **100% lines, 87.5% branches, 100% functions**.
- Android Expo/Hermes export: passed after final fixes.
- Native emulator/device interaction was not performed. Component adapters and export
  are not evidence of device acceptance. Existing APKs do not contain these changes.

## Security review

Applied project `security-review` and `security-audit` guidance to this feature.
Independent source review covered the new UI, persistence, filtering and catalog
ownership. No confirmed security vulnerability remains in this reviewed scope.

- Stored records only contain connection IDs and provider/model ID pairs. API keys,
  credentials and server URLs are not copied into this storage.
- Serialized data is parsed defensively; record lengths, counts and total size are
  bounded. Maps and tuple arrays avoid assigning untrusted object property names.
- Model IDs use JSON tuple encoding to avoid provider/model key collisions.
- Provider/model names are rendered as React Native Text; no executable markup,
  terminal commands, dynamic URLs, credential writes or new network calls are added.
- Failed storage writes do not update visible committed state; errors are shown with
  fixed translated messages and do not contain raw values. Writes are serialized.
- Catalog ownership is checked before displaying rows or picker options. Late responses
  from inactive connections cannot overwrite the active catalog.
- Both P2 correctness findings from the initial review were fixed and re-reviewed.

Security review was source-only; no live provider, credentials, paid quota, deployment
or external security probe was used. This is a feature-scoped review, not a new audit
of all pre-existing provider authentication functionality or dependencies.

## Self-evaluation

| Axis | Score | Evidence / limit |
| --- | --- | --- |
| Accuracy | 4/5 | 508 tests, typecheck and Hermes export; native rendering not exercised |
| Completeness | 4/5 | All requested feature paths and security review covered; device acceptance remains |
| Clarity | 4/5 | UI explains local per-server scope and retained session model |
| Actionability | 4/5 | Code and validation evidence ready; an updated APK is needed for phone installation |
| Conciseness | 4/5 | Short user summary; detailed evidence confined to this report |

Overall: **4.0/5**. Highest-value next validation is installing a freshly built APK and
checking switch persistence on the user's Android/Termux connection. The assessment
does not claim that native verification already happened.

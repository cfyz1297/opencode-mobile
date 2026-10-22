# 0.2.19 TDD evidence

Source: user request to cover the mobile application with tests, fix discovered bugs and prepare a release. No external plan file was supplied.

## Journeys

1. A user's selected model and agent must either take effect before sending or produce an error with retry available.
2. Switching connections must not inherit model choices or streamed messages from another connection; reconnecting the same client must preserve its partial text.
3. Unsupported endpoints, authentication failures and transport errors must reach the appropriate fallback/error path.
4. Server event frames must survive optional field spacing, CRLF and fragmented reads.
5. The standard test command must actually execute tests on Windows and Linux, propagate failures and reject an empty suite.
6. Routine session, catalog, file, form, permission and command requests must use the production transport and response mapping.

## Executed checkpoints

| Stage | Command | Observed result | Commit |
| --- | --- | --- | --- |
| Baseline | Explicit `rg --files src scripts` test-file enumeration, then `node --test --experimental-test-coverage --test-reporter=spec <files>` | 356 pass; `npm test` separately reported 0 tests on Windows | base `722392b` |
| RED | `node --test --test-reporter=spec src/lib/sdk.integration.test.ts src/lib/sse.test.ts scripts/run-tests.test.mjs` | 47 tests: 32 pass, 15 fail. Seven SDK regression cases, five SSE cases and three missing runner implementation cases failed. | `8a1c448` |
| Initial fix | Same target | SDK/SSE fixed, but two runner subprocess checks still failed because the child inherited `NODE_TEST_CONTEXT`; this checkpoint was not GREEN. | `ee8760f` |
| GREEN | Same target, after isolating the subprocess fixture environment | 47 pass, 0 fail | `1f23874` |
| Additional RED | `node --test --test-reporter=spec src/lib/sdk.integration.test.ts` | 42 tests: 41 pass, 1 fail (second connection's assistant message suppressed) | `7143083` |
| Additional GREEN | Same SDK target with the adapter scoped to each client | 42 pass, 0 fail; same-client reconnect accumulation also passes | `493be05` |
| Final validation | `npm run test:coverage`, `npm run typecheck`, `npm run check:versions` | 414 pass; coverage gates pass; typecheck passes; 0.2.19 (53) metadata aligned | release preparation commit |

Additional coverage-only tests exercise existing successful behavior without changing production logic. The suite contains no skipped tests. Tests and raw RED/GREEN evidence were executed before the corresponding production fixes.

## Guarantees and boundaries

See the bug/guarantee table and coverage figures in [TEST_REPORT.md](../../../TEST_REPORT.md). Tests use the real SDK and a loopback HTTP boundary; they do not prove Android UI behavior or independently validate every fixture against a running OpenCode server. The native CUA/activation workflows are manually disabled and rely on obsolete V1 routes, so the prepared release remains a draft until native validation is completed.

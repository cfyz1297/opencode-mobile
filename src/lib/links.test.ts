// Guards the fork's project links: about/update surfaces must point at the
// fork's own repo (releases "0.2.x"), and the original upstream app must stay
// reachable from Settings > About. Regression source: the pre-fork links
// pointed at the original author's Pages and the original's releases API —
// the update banner then compared foreign tags against a foreign versioning
// scheme and stayed permanently quiet. Plain `node --test`, no RN imports
// (update-check.ts itself imports react-native — do not add it here).
import { test } from "node:test"
import assert from "node:assert/strict"
import { ORIGINAL_REPO_URL, PRIVACY_POLICY_URL, PROJECT_REPO_URL, SETUP_GUIDE_URL } from "./links.ts"
import appJson from "../../app.json" with { type: "json" }

test("project links point at the fork's repo", () => {
  assert.equal(PROJECT_REPO_URL, "https://github.com/cfyz1297/opencode-mobile")
})

test("upstream original stays linked for credits/history", () => {
  assert.equal(ORIGINAL_REPO_URL, "https://github.com/dzianisv/opencode-mobile")
})

test("privacy and setup pages fall back to the fork repo (no Pages site yet)", () => {
  assert.equal(PRIVACY_POLICY_URL, PROJECT_REPO_URL)
  assert.equal(SETUP_GUIDE_URL, PROJECT_REPO_URL)
})

// The in-app version must live in the fork's own numbering family, not the
// upstream's stale one (the About row and the update banner both read it).
test("app version follows the fork's 0.x release tags", () => {
  const version = (appJson as { expo?: { version?: string } }).expo?.version ?? ""
  assert.doesNotMatch(version, /^0\.4\./)
  assert.match(version, /^0\.\d+\./)
})

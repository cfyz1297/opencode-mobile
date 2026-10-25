import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

// Security baseline: these are cheap invariants a refactor can silently drop.
// They are static on purpose - each one asserts a property of the shipped source,
// not of a mock of it.

test('server passwords are written as this-device-only SecureStore items', () => {
  const store = read('src/stores/connections.ts')
  const writes = store
    .split('\n')
    .filter((line) => /setItemAsync\(`\$\{PASSWORDS_PREFIX\}/.test(line))
  assert.ok(writes.length > 0, 'expected password writes to exist')
  for (const line of writes) assert.match(line, /SECURE_OPTIONS\)/, line.trim())
  assert.match(
    store,
    /SECURE_OPTIONS = \{[^}]*keychainAccessible: SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
    'SECURE_OPTIONS must keep passwords off OS backups',
  )
})

test('the release APK cannot request draw-over-other-apps', () => {
  const app = JSON.parse(read('app.json'))
  assert.ok(
    app.expo.android.blockedPermissions.includes('android.permission.SYSTEM_ALERT_WINDOW'),
    'SYSTEM_ALERT_WINDOW is a dev-menu leftover; nothing in src uses it',
  )
})

test('connection forms warn before credentials go over plain http', () => {
  for (const screen of ['app/connection/add.tsx', 'app/connection/[id].tsx']) {
    const src = read(screen)
    assert.match(src, /sendsPasswordInClearText/, screen)
    assert.match(src, /connection\.security\.cleartext/, screen)
  }
})

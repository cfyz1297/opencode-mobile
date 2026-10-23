import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptiveLayout } from './adaptive-layout.ts'
test('phone, tablet portrait, split view and large desktop widths', () => {
  assert.deepEqual(adaptiveLayout(390), { tablet: false, split: false, sidebar: 0, content: 390 })
  assert.equal(adaptiveLayout(768).tablet, true)
  assert.equal(adaptiveLayout(999).split, false)
  assert.equal(adaptiveLayout(1000).split, true)
  assert.equal(adaptiveLayout(1366).sidebar, 280)
  assert.equal(adaptiveLayout(2400).content, 1100)
  assert.equal(adaptiveLayout(600).split, false)
})

test('Android handles large display size and density changes without recreating the chat activity', () => {
  const required = ['orientation', 'screenSize', 'screenLayout', 'smallestScreenSize', 'density']
  const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8')
  const activity = manifest.match(/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/)?.[0] ?? ''
  const changes = new Set(activity.match(/android:configChanges="([^"]+)"/)?.[1].split('|'))
  for (const change of required) {
    assert.ok(changes.has(change), `MainActivity must handle ${change}`)
  }
  assert.ok(!activity.includes('android:screenOrientation="portrait"'))

  // expo prebuild regenerates the manifest in CI; the config plugin must keep these flags.
  const appJson = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'))
  assert.ok(appJson.expo.plugins.includes('./plugins/with-tablet-config-changes.js'))
  const plugin = readFileSync(new URL('../../plugins/with-tablet-config-changes.js', import.meta.url), 'utf8')
  for (const change of required) {
    assert.ok(plugin.includes(`'${change}'`), `config plugin must require ${change}`)
  }
})

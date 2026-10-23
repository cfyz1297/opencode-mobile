import { test } from 'node:test'
import assert from 'node:assert/strict'
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

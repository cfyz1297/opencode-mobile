import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tabletSessionNavMode, tabletSessionRoute } from './tablet-session-nav.ts'

test('tablet session route keeps id and optional directory params', () => {
  assert.deepEqual(tabletSessionRoute({ id: 'tablet-session-two', directory: '/other' }), {
    pathname: '/session/[id]',
    params: { id: 'tablet-session-two', directory: '/other' },
  })
  assert.deepEqual(tabletSessionRoute({ id: 'alone' }), {
    pathname: '/session/[id]',
    params: { id: 'alone' },
  })
})

test('switching chats on an open session screen must use setParams, not same-path replace', () => {
  assert.equal(tabletSessionNavMode('roadmap-session', 'tablet-session-two'), 'setParams')
  assert.equal(tabletSessionNavMode(undefined, 'roadmap-session'), 'push')
  const source = readFileSync(new URL('../components/TabletSessions.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('tabletSessionNavMode'), 'TabletSessions must choose setParams vs push')
  assert.ok(source.includes('setParams'), 'TabletSessions must call setParams for in-place switches')
  assert.ok(!/router\.replace\(\s*\{\s*pathname:\s*['"]\/session\/\[id\]['"]/.test(source), 'same-path replace is a no-op')
})

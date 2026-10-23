import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tabletSessionHref } from './tablet-session-nav.ts'

test('tablet session href embeds the session id in the path', () => {
  assert.equal(
    tabletSessionHref({ id: 'tablet-session-two', directory: '/other' }),
    '/session/tablet-session-two?directory=%2Fother',
  )
  assert.equal(tabletSessionHref({ id: 'alone' }), '/session/alone')
})

test('TabletSessions switches via concrete /session/:id href, not same-path replace', () => {
  const source = readFileSync(new URL('../components/TabletSessions.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('tabletSessionHref'), 'TabletSessions must build a concrete href')
  assert.ok(source.includes('router.replace(tabletSessionHref'), 'TabletSessions must replace with that href')
  assert.ok(!/router\.replace\(\s*\{\s*pathname:\s*['"]\/session\/\[id\]['"]/.test(source), 'object same-path replace is a no-op')
  assert.ok(!source.includes('router.setParams'), 'setParams does not change the [id] segment reliably')
})

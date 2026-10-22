import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const runner = resolve('scripts/run-tests.mjs')
function runFixture(source, args = []) {
  const root = mkdtempSync(join(tmpdir(), 'mobile-tests-'))
  try {
    mkdirSync(join(root, 'src', 'nested'), { recursive: true })
    writeFileSync(join(root, 'src', 'nested', 'sample.test.ts'), source)
    return spawnSync(process.execPath, [runner, ...args], { cwd: root, encoding: 'utf8' })
  } finally { rmSync(root, { recursive: true, force: true }) }
}
test('test runner discovers nested TypeScript files without shell glob expansion', () => {
  const result = runFixture("import { test } from 'node:test'; test('discovered nested test', () => {})")
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /discovered nested test/)
  assert.match(result.stdout, /tests 1/)
})
test('test runner propagates test failures', () => {
  const result = runFixture("import { test } from 'node:test'; test('fails', () => { throw Error('expected failure') })")
  assert.equal(result.status, 1)
  assert.match(result.stdout, /expected failure/)
})
test('test runner fails rather than reporting success with zero tests', () => {
  const root = mkdtempSync(join(tmpdir(), 'mobile-empty-'))
  try {
    const result = spawnSync(process.execPath, [runner], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /No test files/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

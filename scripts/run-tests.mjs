// Pass explicit file arguments to Node: shell glob/quote handling differs
// between Windows and POSIX and can silently result in zero executed tests.
import { globSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const files = [...globSync(['src/**/*.test.ts', 'scripts/*.test.mjs'])].sort()
if (!files.length) {
  console.error('No test files found; refusing to report a successful test run.')
  process.exit(1)
}

const args = process.argv.slice(2)
const result = spawnSync(process.execPath, ['--test', ...args, ...files], { stdio: 'inherit' })
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)

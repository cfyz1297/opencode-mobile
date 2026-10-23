// Deterministic Android computer-use smoke: real release APK, UIAutomator
// snapshots, touches and screenshots. No paid model or cloud credentials.
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const pkg = 'cc.agentlabs.opencode'
const out = 'artifacts/roadmap'
mkdirSync(out, { recursive: true })
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
function snapshot() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
  return adb('shell', 'cat', '/sdcard/window.xml')
}
async function waitFor(value, timeout = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const xml = snapshot()
    if (xml.includes(value)) return xml
    await sleep(500)
  }
  writeFileSync(`${out}/failure.xml`, snapshot())
  throw new Error(`UI did not contain ${value}`)
}
async function tap(value, scroll = false) {
  if (scroll) {
    for (let i = 0; i < 5 && !snapshot().includes(`="${value}"`); i++) {
      const dimensions = adb('shell', 'wm', 'size')
      const [, width, height] = dimensions.match(/Override size: (\d+)x(\d+)/) ?? dimensions.match(/Physical size: (\d+)x(\d+)/) ?? []
      assert.ok(width && height)
      adb('shell', 'input', 'swipe', String(Math.floor(+width / 2)), String(Math.floor(+height * 0.8)), String(Math.floor(+width / 2)), String(Math.floor(+height * 0.3)), '350')
      await sleep(400)
    }
  }
  const xml = await waitFor(value)
  const node = xml.match(/<node\b[^>]*>/g)?.find(n => n.includes(`="${value}"`))
  assert.ok(node, `Exact visible node ${value}`)
  const [, x1, y1, x2, y2] = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) ?? []
  assert.ok(x1, `Bounds of ${value}`)
  adb('shell', 'input', 'tap', String(Math.floor((+x1 + +x2) / 2)), String(Math.floor((+y1 + +y2) / 2)))
  await sleep(400)
}
async function type(value, text) {
  await tap(value)
  adb('shell', 'input', 'text', text)
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
}
async function open(path) {
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `opencode://${path}`, pkg)
  await sleep(1000)
}
function screenshot(name) {
  writeFileSync(`${out}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p']))
  writeFileSync(`${out}/${name}.xml`, snapshot())
}
const now = Date.now()
const session = { id: 'roadmap-session', title: 'ROADMAP_SESSION', location: { directory: '/fixture' }, time: { created: now, updated: now } }
const other = { ...session, id: 'tablet-session-two', title: 'TABLET_SESSION_TWO', location: { directory: '/other' } }
const requests = []
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  requests.push({ method: req.method, path })
  if (path === '/api/event') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write(': connected\n\n')
    const timer = setInterval(() => res.write(': heartbeat\n\n'), 1000)
    req.on('close', () => clearInterval(timer))
    return
  }
  let data
  if (path === '/api/info') data = { healthy: true, version: 'fixture-v2' }
  else if (path === '/api/location') data = { directory: '/fixture', project: { directory: '/fixture' } }
  else if (path === '/api/session') data = { data: [session, other] }
  else if (path === '/api/session/tablet-session-two') data = { data: other }
  else if (path === '/api/session/tablet-session-two/message') data = { data: [{ id: 'a2', type: 'assistant', time: { created: now, completed: now }, content: [{ type: 'text', text: 'TABLET_SECOND_ANSWER_44' }] }] }
  else if (path === '/api/session/roadmap-session') data = { data: session }
  else if (path === '/api/session/roadmap-session/message') data = { data: [
    { id: 'a1', type: 'assistant', time: { created: now + 1, completed: now + 2 }, content: [{ type: 'text', text: 'OFFLINE_ANSWER_42' }] },
    { id: 'u1', type: 'user', time: { created: now }, text: 'OFFLINE_QUESTION_42' },
  ] }
  else if (path === '/api/agent') data = { data: [{ id: 'build', name: 'Build', mode: 'primary' }] }
  else if (path === '/api/model/default') data = {}
  else if (['/api/model', '/api/command', '/api/project', '/api/permission/request', '/api/form', '/api/session/roadmap-session/form', '/api/session/roadmap-session/permission', '/api/session/roadmap-session/diff'].includes(path)) data = { data: [] }
  else { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
})
await new Promise(resolve => server.listen(4096, '127.0.0.1', resolve))
try {
  adb('reverse', 'tcp:4096', 'tcp:4096')
  // Keep density fixed throughout the journey: changing density recreates the
  // Android activity, whereas screenSize is handled by the application.
  adb('shell', 'wm', 'density', '160')
  adb('shell', 'wm', 'size', '400x800')
  adb('shell', 'pm', 'clear', pkg)
  await open('connection/tunnel')
  await waitFor('Step 1 of 3')
  await tap('tunnel-next', true)
  await waitFor('127.0.0.1')
  screenshot('tunnel-commands-phone')
  await tap('tunnel-next', true)
  await type('tunnel-url', 'http://untrusted.example')
  const before = requests.length
  await tap('tunnel-connect')
  await waitFor('Use a public HTTPS URL')
  assert.equal(requests.length, before, 'Invalid URL must fail before any request')
  screenshot('tunnel-reject-http')
  await tap('OK')
  await open('connection/add')
  await type('connect-ip-input', '127.0.0.1')
  await tap('connect-submit-button', true)
  // Android 13 notification prompt may overlay the session list.
  await sleep(2000)
  const prompt = snapshot()
  if (prompt.includes('com.android.permissioncontroller:id/permission_allow_button')) await tap('com.android.permissioncontroller:id/permission_allow_button')
  await open('')
  await waitFor('ROADMAP_SESSION')
  await open('history')
  await tap('history-enable')
  await open('session/roadmap-session')
  await waitFor('OFFLINE_ANSWER_42')
  await sleep(2500)
  screenshot('session-phone')
  adb('shell', 'wm', 'size', '1920x1200')
  await sleep(2000)
  await waitFor('tablet-session-sidebar')
  await tap('tablet-session-tablet-session-two')
  await waitFor('TABLET_SECOND_ANSWER_44')
  await tap('tablet-session-roadmap-session')
  await waitFor('OFFLINE_ANSWER_42')
  screenshot('session-tablet-landscape')
  const split = snapshot()
  const sidebar = split.match(/<node\b[^>]*resource-id="tablet-session-sidebar"[^>]*>/)?.[0]
  assert.ok(sidebar, 'Sidebar has a real native layout node')
  const bounds = sidebar.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  assert.ok(bounds && +bounds[3] - +bounds[1] === 280, 'Sidebar is 280 dp at mdpi')
  adb('shell', 'wm', 'size', '800x1280')
  await sleep(1500)
  await waitFor('OFFLINE_ANSWER_42')
  assert.ok(!snapshot().includes('tablet-session-sidebar'), 'Portrait 800 dp returns to one content pane')
  screenshot('session-tablet-portrait')
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  adb('shell', 'am', 'force-stop', pkg)
  await open('history')
  await tap('history-session-roadmap-session')
  await waitFor('OFFLINE_ANSWER_42')
  await waitFor('OFFLINE_QUESTION_42')
  assert.ok(!snapshot().includes('chat-send-button'), 'Offline transcript is read only')
  screenshot('offline-after-cold-restart')
  await tap('history-clear')
  await tap('Delete')
  await waitFor('No saved conversations yet.')
  screenshot('history-cleared')
  writeFileSync(`${out}/requests.json`, JSON.stringify(requests, null, 2))
  writeFileSync(`${out}/result.json`, JSON.stringify({ result: 'PASS', checks: ['tunnel-commands', 'reject-http-before-network', 'v2-connect', 'live-session-text', 'tablet-split', 'tablet-portrait', 'offline-cold-restart', 'read-only', 'clear-history'] }, null, 2))
  console.log('PASS: Android tunnel, tablet and offline history CUA smoke')
} catch (error) {
  screenshot('failure')
  throw error
} finally {
  server.closeAllConnections()
  server.close()
  adb('shell', 'wm', 'size', 'reset')
  adb('shell', 'wm', 'density', 'reset')
}


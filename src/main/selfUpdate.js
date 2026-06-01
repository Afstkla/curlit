const { request } = require('undici')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execSync } = require('node:child_process')

// Given the running executable path, return the enclosing .app bundle (or null in dev).
function currentAppBundle(execPath) {
  const i = execPath.indexOf('.app/')
  return i === -1 ? null : execPath.slice(0, i + 4)
}

// Detached shell script: wait for the app to quit, atomically swap the bundle
// (with rollback on failure), clear quarantine, relaunch.
function buildSwapScript() {
  return `#!/bin/bash
APP="$1"; NEW="$2"; PID="$3"
for i in $(seq 1 150); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
BAK="$APP.bak-$$"
if mv "$APP" "$BAK" 2>/dev/null; then
  if ditto "$NEW" "$APP"; then
    rm -rf "$BAK"
    xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
    open "$APP" 2>/dev/null || true
  else
    rm -rf "$APP" 2>/dev/null || true
    mv "$BAK" "$APP" 2>/dev/null || true
    open "$APP" 2>/dev/null || true
  fi
fi
exit 0
`
}

async function downloadTo(url, dest) {
  const res = await request(url, { headers: { 'user-agent': 'curlit-updater' }, maxRedirections: 5 })
  if (res.statusCode !== 200) throw new Error('Download failed (HTTP ' + res.statusCode + ')')
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(dest)
    res.body.pipe(ws)
    res.body.on('error', reject)
    ws.on('finish', resolve)
    ws.on('error', reject)
  })
}

// Download the .app zip, swap it into place, and relaunch. Returns {ok} or {error}.
// error === 'no-permission' means the install location needs admin rights.
async function applyUpdate(zipUrl, execPath) {
  const appBundle = currentAppBundle(execPath)
  if (!appBundle) return { error: 'In-place update only works from the installed app.' }
  try { fs.accessSync(path.dirname(appBundle), fs.constants.W_OK) }
  catch { return { error: 'no-permission' } }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'curlit-up-'))
  const zip = path.join(tmp, 'update.zip')
  await downloadTo(zipUrl, zip)
  execSync(`ditto -x -k "${zip}" "${tmp}"`)

  const appName = path.basename(appBundle)
  let newApp = path.join(tmp, appName)
  if (!fs.existsSync(newApp)) {
    const found = fs.readdirSync(tmp).find(f => f.endsWith('.app'))
    if (!found) return { error: 'The update package did not contain an app.' }
    newApp = path.join(tmp, found)
  }

  const script = path.join(tmp, 'swap.sh')
  fs.writeFileSync(script, buildSwapScript(), { mode: 0o755 })
  const child = spawn('/bin/bash', [script, appBundle, newApp, String(process.pid)], { detached: true, stdio: 'ignore' })
  child.unref()
  return { ok: true }
}

module.exports = { currentAppBundle, buildSwapScript, applyUpdate }

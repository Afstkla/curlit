const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const cp = require('node:child_process')
const { currentAppBundle, buildSwapScript } = require('../src/main/selfUpdate')

test('currentAppBundle extracts the .app path, null in dev', () => {
  assert.strictEqual(currentAppBundle('/Applications/Curlit.app/Contents/MacOS/Curlit'), '/Applications/Curlit.app')
  assert.strictEqual(currentAppBundle('/usr/local/bin/node'), null)
})

test('swap script replaces the old bundle with the new one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curlit-swap-'))
  const APP = path.join(dir, 'Curlit.app')
  const NEW = path.join(dir, 'new', 'Curlit.app')
  fs.mkdirSync(APP, { recursive: true }); fs.writeFileSync(path.join(APP, 'old.txt'), 'OLD')
  fs.mkdirSync(NEW, { recursive: true }); fs.writeFileSync(path.join(NEW, 'new.txt'), 'NEW')

  const script = path.join(dir, 'swap.sh')
  fs.writeFileSync(script, buildSwapScript(), { mode: 0o755 })
  // PID that isn't alive -> the wait loop exits immediately and the swap proceeds.
  cp.execFileSync('/bin/bash', [script, APP, NEW, '2147483646'], { stdio: 'ignore' })

  assert.ok(fs.existsSync(path.join(APP, 'new.txt')), 'new file should be present after swap')
  assert.ok(!fs.existsSync(path.join(APP, 'old.txt')), 'old file should be gone after swap')
})

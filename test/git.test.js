const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const git = require('isomorphic-git')
const { ensureClone } = require('../src/main/git')

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'curlit-')) }

// isomorphic-git speaks HTTP(S) only (the production path is GitHub over HTTPS).
// It has no `file://` transport, so push/pull against a local bare repo can't be
// exercised here — that round-trip is covered by manual testing against a real
// private repo. These tests cover the offline plumbing our git.js actually owns:
// the empty/unreachable-remote fallback and that the result is a usable repo.

test('ensureClone falls back to init + origin remote when clone fails', async () => {
  const dir = tmp()
  // A bogus HTTPS URL: clone fails fast, so ensureClone should init locally.
  await ensureClone('https://0.0.0.0/nope.git', dir, null)
  assert.ok(fs.existsSync(path.join(dir, '.git')), '.git should exist')
  const remotes = await git.listRemotes({ fs, dir })
  assert.strictEqual(remotes.find(r => r.remote === 'origin').url, 'https://0.0.0.0/nope.git')
})

test('a file committed in the initialised repo shows up in the log', async () => {
  const dir = tmp()
  await ensureClone('https://0.0.0.0/nope.git', dir, null)
  fs.writeFileSync(path.join(dir, 'a.json'), '{"x":1}')
  await git.add({ fs, dir, filepath: 'a.json' })
  await git.commit({ fs, dir, message: 'add a', author: { name: 'Curlit', email: 'curlit@local' } })
  const log = await git.log({ fs, dir })
  assert.strictEqual(log.length, 1)
  assert.strictEqual(log[0].commit.message.trim(), 'add a')
})

test('ensureClone is idempotent on an existing repo', async () => {
  const dir = tmp()
  await ensureClone('https://0.0.0.0/nope.git', dir, null)
  await ensureClone('https://0.0.0.0/nope.git', dir, null) // must not throw or re-init
  const remotes = await git.listRemotes({ fs, dir })
  assert.strictEqual(remotes.length, 1)
})

const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const fs = require('node:fs')
const path = require('node:path')

// onAuth supplies the PAT for HTTPS remotes; harmless for file:// remotes.
function authCb(pat) { return () => (pat ? { username: pat, password: 'x-oauth-basic' } : {}) }

async function ensureClone(url, dir, pat) {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true })
    try {
      await git.clone({ fs, http, dir, url, singleBranch: true, depth: 1, onAuth: authCb(pat) })
    } catch (e) {
      // Empty remote: init a fresh repo and wire the remote so first push works.
      await git.init({ fs, dir, defaultBranch: 'main' })
      await git.addRemote({ fs, dir, remote: 'origin', url })
    }
  }
}

async function pull(dir, url, pat) {
  await git.pull({
    fs, http, dir, url, singleBranch: true, fastForwardOnly: true,
    author: { name: 'Curlit', email: 'curlit@local' }, onAuth: authCb(pat)
  })
}

async function commitAndPush(dir, url, author, message, pat) {
  await git.add({ fs, dir, filepath: '.' })
  await git.commit({ fs, dir, message, author })
  try {
    await git.push({ fs, http, dir, remote: 'origin', url, onAuth: authCb(pat) })
  } catch (e) {
    await pull(dir, url, pat)
    await git.push({ fs, http, dir, remote: 'origin', url, onAuth: authCb(pat) })
  }
}
module.exports = { ensureClone, pull, commitAndPush }

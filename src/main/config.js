const fs = require('node:fs')
const path = require('node:path')

// config.json holds NO secrets — just the collections repo URL and the public
// GitHub OAuth client id. Safe to commit and to bundle in a public build.
// Precedence: packaged resource > per-user override in app data > dev project root.
function readConfigFrom(paths) {
  for (const p of paths) {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (j && (j.repoUrl || j.clientId)) return j
    } catch { /* missing / unreadable -> try next */ }
  }
  return null
}

function bundledPaths(app) {
  const out = []
  if (process.resourcesPath) out.push(path.join(process.resourcesPath, 'config.json'))
  try { out.push(path.join(app.getPath('userData'), 'config.json')) } catch { /* no app yet */ }
  out.push(path.join(__dirname, '../../config.json'))
  return out
}

function loadBundledConfig(app) {
  return readConfigFrom(bundledPaths(app)) || {}
}

module.exports = { readConfigFrom, bundledPaths, loadBundledConfig }

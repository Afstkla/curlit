const { safeStorage } = require('electron')
const fs = require('node:fs')
const { secretsFile } = require('./paths')

function load() {
  try {
    const buf = fs.readFileSync(secretsFile())
    return JSON.parse(safeStorage.decryptString(buf))
  } catch { return {} }
}
function saveAll(map) {
  fs.writeFileSync(secretsFile(), safeStorage.encryptString(JSON.stringify(map)))
}
function getSecret(id) { return load()[id] || {} }
function setSecret(id, secret) { const m = load(); m[id] = secret; saveAll(m) }
function deleteSecret(id) { const m = load(); delete m[id]; saveAll(m) }
function mergeSecrets(obj) { const m = load(); Object.assign(m, obj); saveAll(m) } // for import
module.exports = { getSecret, setSecret, deleteSecret, mergeSecrets }

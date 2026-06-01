const fs = require('node:fs')
const path = require('node:path')
const { cloneDir } = require('./paths')

function ensureDir() { fs.mkdirSync(cloneDir(), { recursive: true }) }

function listCollections() {
  ensureDir()
  return fs.readdirSync(cloneDir())
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(cloneDir(), f), 'utf8')))
}
function saveCollection(col) {
  ensureDir()
  fs.writeFileSync(path.join(cloneDir(), col.id + '.json'), JSON.stringify(col, null, 2))
}
function deleteCollection(id) {
  const p = path.join(cloneDir(), id + '.json')
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
module.exports = { listCollections, saveCollection, deleteCollection }

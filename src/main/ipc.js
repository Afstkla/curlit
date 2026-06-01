const { ipcMain, dialog } = require('electron')
const fs = require('node:fs')
const { sendRequest } = require('./http')
const store = require('./store')
const secretStore = require('./secretStore')
const settings = require('./settings')
const git = require('./git')
const { cloneDir } = require('./paths')
const { importPostman } = require('../shared/postman')

async function syncPush(message) {
  const s = settings.getSettings()
  if (!s || !s.repoUrl) return
  try {
    await git.commitAndPush(cloneDir(), s.repoUrl, { name: 'Curlit', email: 'curlit@local' }, message, s.pat)
  } catch (e) {
    // Surface to renderer via return value of caller; keep app usable offline.
    return { syncError: e.message }
  }
}

function registerIpc() {
  ipcMain.handle('getSetup', () => settings.getSettings())
  ipcMain.handle('saveSetup', async (_e, s) => {
    settings.saveSettings(s)
    await git.ensureClone(s.repoUrl, cloneDir(), s.pat)
    try { await git.pull(cloneDir(), s.repoUrl, s.pat) } catch {}
    return true
  })

  ipcMain.handle('listTree', () => store.listCollections())
  ipcMain.handle('saveCollection', async (_e, col) => { store.saveCollection(col); const r = await syncPush('update ' + col.name); return r || true })
  ipcMain.handle('deleteCollection', async (_e, id) => { store.deleteCollection(id); const r = await syncPush('delete ' + id); return r || true })

  ipcMain.handle('getSecret', (_e, id) => secretStore.getSecret(id))
  ipcMain.handle('setSecret', (_e, id, secret) => { secretStore.setSecret(id, secret); return true })

  ipcMain.handle('sendRequest', async (_e, req) => {
    const secret = secretStore.getSecret(req.id)
    return sendRequest(req, secret)
  })

  ipcMain.handle('importPostman', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    let json
    try { json = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')) }
    catch (e) { return { error: 'Could not parse JSON: ' + e.message } }
    if (!json.item) return { error: 'Not a Postman Collection v2.1 export (missing "item").' }
    const { collection, secrets } = importPostman(json)
    store.saveCollection(collection)
    secretStore.mergeSecrets(secrets)
    await syncPush('import ' + collection.name)
    return collection
  })

  ipcMain.handle('launchPull', async () => {
    const s = settings.getSettings()
    if (s && s.repoUrl) { try { await git.pull(cloneDir(), s.repoUrl, s.pat) } catch {} }
    return true
  })
}
module.exports = { registerIpc }

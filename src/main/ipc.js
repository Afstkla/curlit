const { ipcMain, dialog, shell, app } = require('electron')
const fs = require('node:fs')
const { sendRequest } = require('./http')
const store = require('./store')
const secretStore = require('./secretStore')
const settings = require('./settings')
const git = require('./git')
const oauth = require('./oauth')
const update = require('./update')
const { loadBundledConfig } = require('./config')
const { cloneDir } = require('./paths')
const { importPostman } = require('../shared/postman')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function getConfig() { return loadBundledConfig(app) }

function resolveClientId() {
  const id = (getConfig().clientId || '').trim()
  if (!id || id.startsWith('REPLACE_')) return null
  return id
}

async function syncPush(message) {
  const s = settings.getSettings()
  if (!s || !s.repoUrl) return
  try {
    await git.commitAndPush(cloneDir(), s.repoUrl, { name: 'Curlit', email: 'curlit@local' }, message, s.token)
  } catch (e) {
    return { syncError: e.message }
  }
}

// Drive the device-flow polling loop until a token, an error, or expiry.
async function pollUntilToken(clientId, info) {
  const deadline = Date.now() + ((info.expires_in || 900) * 1000)
  let wait = info.interval || 5
  while (Date.now() < deadline) {
    await sleep(wait * 1000)
    let r
    try { r = await oauth.pollOnce(clientId, info.device_code) }
    catch (e) { return { error: e.message } }
    if (r.status === 'done') return { token: r.token }
    if (r.status === 'error') return { error: r.message }
    if (r.status === 'slow_down') wait = r.interval || (wait + 5)
  }
  return { error: 'Timed out waiting for authorization. Please try again.' }
}

function registerIpc() {
  // --- config / setup ---
  ipcMain.handle('getConfig', () => ({ repoUrl: getConfig().repoUrl || '', hasClientId: !!resolveClientId() }))
  ipcMain.handle('getSetup', () => {
    const s = settings.getSettings()
    return s && s.repoUrl && s.token ? { repoUrl: s.repoUrl } : null
  })
  ipcMain.handle('getVersion', () => app.getVersion())

  // --- GitHub device-flow auth ---
  ipcMain.handle('startDeviceAuth', async () => {
    const clientId = resolveClientId()
    if (!clientId) return { error: 'GitHub sign-in isn’t configured yet (missing OAuth client id).' }
    try {
      const info = await oauth.requestDeviceCode(clientId)
      return { ok: true, info }
    } catch (e) { return { error: e.message } }
  })
  ipcMain.handle('completeDeviceAuth', async (_e, repoUrl, info) => {
    const clientId = resolveClientId()
    if (!clientId) return { error: 'GitHub sign-in isn’t configured yet.' }
    const r = await pollUntilToken(clientId, info)
    if (r.error) return { error: r.error }
    settings.saveSettings({ repoUrl, token: r.token })
    try {
      await git.ensureClone(repoUrl, cloneDir(), r.token)
      await git.pull(cloneDir(), repoUrl, r.token)
    } catch (e) { /* offline / empty remote is fine; surfaced later */ }
    return { ok: true }
  })

  // --- collections ---
  ipcMain.handle('listTree', () => store.listCollections())
  ipcMain.handle('saveCollection', async (_e, col) => { store.saveCollection(col); const r = await syncPush('update ' + col.name); return r || true })
  ipcMain.handle('deleteCollection', async (_e, id) => { store.deleteCollection(id); const r = await syncPush('delete ' + id); return r || true })

  ipcMain.handle('getSecret', (_e, id) => secretStore.getSecret(id))
  ipcMain.handle('setSecret', (_e, id, secret) => { secretStore.setSecret(id, secret); return true })

  ipcMain.handle('sendRequest', async (_e, req) => sendRequest(req, secretStore.getSecret(req.id)))

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
    if (s && s.repoUrl) {
      try { await git.ensureClone(s.repoUrl, cloneDir(), s.token); await git.pull(cloneDir(), s.repoUrl, s.token) } catch {}
    }
    return true
  })

  // --- misc ---
  ipcMain.handle('openExternal', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return true })
  ipcMain.handle('checkUpdate', () => update.checkUpdate(app.getVersion()))
}
module.exports = { registerIpc }

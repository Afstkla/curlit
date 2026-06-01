const { contextBridge, ipcRenderer } = require('electron')
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a)
contextBridge.exposeInMainWorld('curlit', {
  // setup / auth
  getConfig: () => call('getConfig'),
  getSetup: () => call('getSetup'),
  getVersion: () => call('getVersion'),
  startDeviceAuth: () => call('startDeviceAuth'),
  completeDeviceAuth: (repoUrl, info) => call('completeDeviceAuth', repoUrl, info),
  // collections
  listTree: () => call('listTree'),
  saveCollection: (c) => call('saveCollection', c),
  deleteCollection: (id) => call('deleteCollection', id),
  getSecret: (id) => call('getSecret', id),
  setSecret: (id, secret) => call('setSecret', id, secret),
  sendRequest: (req) => call('sendRequest', req),
  importPostman: () => call('importPostman'),
  launchPull: () => call('launchPull'),
  // misc
  openExternal: (url) => call('openExternal', url),
  checkUpdate: () => call('checkUpdate'),
  applyUpdate: (zipUrl) => call('applyUpdate', zipUrl),
  onCheckUpdate: (cb) => ipcRenderer.on('menu:check-update', () => cb()),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, p) => cb(p))
})

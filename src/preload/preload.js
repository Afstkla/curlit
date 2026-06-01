const { contextBridge, ipcRenderer } = require('electron')
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a)
contextBridge.exposeInMainWorld('curlit', {
  getSetup: () => call('getSetup'),
  saveSetup: (s) => call('saveSetup', s),
  listTree: () => call('listTree'),
  saveCollection: (c) => call('saveCollection', c),
  deleteCollection: (id) => call('deleteCollection', id),
  getSecret: (id) => call('getSecret', id),
  setSecret: (id, secret) => call('setSecret', id, secret),
  sendRequest: (req) => call('sendRequest', req),
  importPostman: () => call('importPostman'),
  launchPull: () => call('launchPull')
})

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { registerIpc } = require('./ipc')
const { buildMenu } = require('./menu')

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 720,
    minWidth: 820, minHeight: 540,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#16181d',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  registerIpc()
  buildMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

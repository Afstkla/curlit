const { Menu, app, BrowserWindow } = require('electron')

function triggerCheck() {
  const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (w) w.webContents.send('menu:check-update')
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const checkItem = { label: 'Check for Updates…', click: triggerCheck }

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        checkItem,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    ...(!isMac ? [{ label: 'Help', submenu: [checkItem] }] : [])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

module.exports = { buildMenu }

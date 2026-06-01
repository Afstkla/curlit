const { safeStorage } = require('electron')
const fs = require('node:fs')
const { settingsFile } = require('./paths')

function getSettings() {
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(settingsFile()))) }
  catch { return null }
}
function saveSettings(s) {
  fs.writeFileSync(settingsFile(), safeStorage.encryptString(JSON.stringify(s)))
}
module.exports = { getSettings, saveSettings }

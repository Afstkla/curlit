const { app } = require('electron')
const path = require('node:path')
function dataDir() { return app.getPath('userData') }
function cloneDir() { return path.join(dataDir(), 'collections') }
function secretsFile() { return path.join(dataDir(), 'secrets.enc') }
function settingsFile() { return path.join(dataDir(), 'settings.enc') }
module.exports = { dataDir, cloneDir, secretsFile, settingsFile }

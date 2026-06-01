const { request } = require('undici')

function parseVersion(v) {
  return String(v || '0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
}

// Pure: is `latest` a higher semver than `current`?
function isNewer(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d !== 0) return d > 0
  }
  return false
}

// Check the public repo's latest release. No token needed (public repo).
async function checkUpdate(currentVersion, repo = 'Afstkla/curlit') {
  try {
    const res = await request(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'user-agent': 'curlit-updater', accept: 'application/vnd.github+json' }
    })
    if (res.statusCode !== 200) return { available: false }
    const rel = JSON.parse(await res.body.text())
    const latest = rel.tag_name || rel.name
    if (!latest || !isNewer(latest, currentVersion)) return { available: false }
    const assets = rel.assets || []
    const dmg = assets.find(a => a.name && a.name.endsWith('.dmg'))
    const zip = assets.find(a => a.name && a.name.endsWith('.zip'))
    return {
      available: true,
      version: latest,
      url: (dmg && dmg.browser_download_url) || rel.html_url,
      zipUrl: zip && zip.browser_download_url
    }
  } catch (e) {
    return { available: false, error: e.message }
  }
}

module.exports = { parseVersion, isNewer, checkUpdate }

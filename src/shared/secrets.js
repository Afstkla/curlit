// Fields that are secret per auth type.
const SECRET_FIELDS = { bearer: ['token'], basic: ['password'], apikey: ['value'] }

function splitSecrets(req) {
  const synced = JSON.parse(JSON.stringify(req))
  const secret = {}
  const auth = synced.auth
  if (auth && SECRET_FIELDS[auth.type]) {
    for (const f of SECRET_FIELDS[auth.type]) {
      if (auth[f] != null) { secret[f] = auth[f]; delete auth[f] }
    }
  }
  return { synced, secret }
}

function mergeSecret(req, secret) {
  const merged = JSON.parse(JSON.stringify(req))
  if (merged.auth && secret) Object.assign(merged.auth, secret)
  return merged
}
module.exports = { splitSecrets, mergeSecret, SECRET_FIELDS }

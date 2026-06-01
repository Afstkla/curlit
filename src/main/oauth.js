const { request } = require('undici')

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GRANT = 'urn:ietf:params:oauth:grant-type:device_code'
const UA = 'curlit'

async function requestDeviceCode(clientId, scope) {
  // GitHub Apps use installed permissions, not scopes — omit `scope` for them.
  // (Kept optional so an OAuth App could still pass e.g. 'repo'.)
  const body = { client_id: clientId }
  if (scope) body.scope = scope
  const res = await request(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify(body)
  })
  const j = JSON.parse(await res.body.text())
  if (j.error) throw new Error(j.error_description || j.error)
  return j // { device_code, user_code, verification_uri, expires_in, interval }
}

// Pure: map a single token-poll response into an action. Easy to unit test.
function interpretPoll(j) {
  if (j.access_token) return { status: 'done', token: j.access_token }
  switch (j.error) {
    case 'authorization_pending': return { status: 'pending' }
    case 'slow_down': return { status: 'slow_down', interval: j.interval }
    case 'expired_token': return { status: 'error', message: 'The code expired — please try connecting again.' }
    case 'access_denied': return { status: 'error', message: 'Authorization was cancelled.' }
    default: return { status: 'error', message: j.error_description || j.error || 'Unknown error.' }
  }
}

async function pollOnce(clientId, deviceCode) {
  const res = await request(TOKEN_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ client_id: clientId, device_code: deviceCode, grant_type: GRANT })
  })
  return interpretPoll(JSON.parse(await res.body.text()))
}

module.exports = { requestDeviceCode, pollOnce, interpretPoll }

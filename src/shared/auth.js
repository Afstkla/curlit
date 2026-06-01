function buildAuth(auth, secret) {
  const out = { headers: {}, query: {} }
  if (!auth || auth.type === 'none') return out
  secret = secret || {}
  if (auth.type === 'bearer') {
    if (secret.token) out.headers.Authorization = 'Bearer ' + secret.token
  } else if (auth.type === 'basic') {
    if (secret.password != null) {
      const creds = Buffer.from(`${auth.username || ''}:${secret.password}`).toString('base64')
      out.headers.Authorization = 'Basic ' + creds
    }
  } else if (auth.type === 'apikey') {
    if (secret.value && auth.name) {
      if (auth.in === 'query') out.query[auth.name] = secret.value
      else out.headers[auth.name] = secret.value
    }
  }
  return out
}
module.exports = { buildAuth }

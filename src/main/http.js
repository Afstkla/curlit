const { request } = require('undici')
const { buildAuth } = require('../shared/auth')

function buildUrl(rawUrl, params, authQuery) {
  const u = new URL(rawUrl)
  for (const p of params || []) if (p.enabled !== false && p.key) u.searchParams.append(p.key, p.value || '')
  for (const k of Object.keys(authQuery || {})) u.searchParams.set(k, authQuery[k])
  return u.toString()
}

function buildBody(body, headers) {
  if (!body || body.type === 'none') return undefined
  if (body.type === 'json') {
    headers['content-type'] = headers['content-type'] || 'application/json'
    return body.content || ''
  }
  if (body.type === 'text') {
    headers['content-type'] = headers['content-type'] || 'text/plain'
    return body.content || ''
  }
  if (body.type === 'urlencoded') {
    headers['content-type'] = headers['content-type'] || 'application/x-www-form-urlencoded'
    return (body.fields || []).map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value || '')}`).join('&')
  }
  return undefined
}

async function sendRequest(req, secret) {
  const auth = buildAuth(req.auth, secret)
  const headers = {}
  for (const h of req.headers || []) if (h.enabled !== false && h.key) headers[h.key] = h.value || ''
  Object.assign(headers, auth.headers)
  const start = process.hrtime.bigint()
  try {
    const url = buildUrl(req.url, req.params, auth.query)
    const bodyData = buildBody(req.body, headers)
    const res = await request(url, { method: req.method || 'GET', headers, body: bodyData })
    const text = await res.body.text()
    const timeMs = Number(process.hrtime.bigint() - start) / 1e6
    return {
      ok: true, status: res.statusCode, headers: res.headers, body: text,
      timeMs: Math.round(timeMs), size: Buffer.byteLength(text)
    }
  } catch (e) {
    const timeMs = Number(process.hrtime.bigint() - start) / 1e6
    return { ok: false, error: e.message, timeMs: Math.round(timeMs) }
  }
}
module.exports = { sendRequest }

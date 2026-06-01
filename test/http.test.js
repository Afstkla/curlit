const { test } = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { sendRequest } = require('../src/main/http')

function withServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.listen(0, async () => {
      const port = server.address().port
      try { await fn(`http://127.0.0.1:${port}`); resolve() }
      catch (e) { reject(e) } finally { server.close() }
    })
  })
}

test('GET returns status, headers, body, timing', () => withServer(
  (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}') },
  async (base) => {
    const r = await sendRequest({ method: 'GET', url: base + '/x', headers: [], params: [],
      body: { type: 'none' }, auth: { type: 'none' } }, {})
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body, '{"ok":true}')
    assert.ok(r.timeMs >= 0)
  }))

test('POST json body is sent', () => withServer(
  (req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { res.end(b) }) },
  async (base) => {
    const r = await sendRequest({ method: 'POST', url: base + '/x', headers: [], params: [],
      body: { type: 'json', content: '{"a":1}' }, auth: { type: 'none' } }, {})
    assert.strictEqual(r.body, '{"a":1}')
  }))

test('auth + params applied', () => withServer(
  (req, res) => { res.end(JSON.stringify({ auth: req.headers.authorization, url: req.url })) },
  async (base) => {
    const r = await sendRequest({ method: 'GET', url: base + '/x', headers: [],
      params: [{ key: 'p', value: '1', enabled: true }],
      body: { type: 'none' }, auth: { type: 'bearer' } }, { token: 'T' })
    const j = JSON.parse(r.body)
    assert.strictEqual(j.auth, 'Bearer T')
    assert.ok(j.url.includes('p=1'))
  }))

test('network error returns ok:false with message', async () => {
  const r = await sendRequest({ method: 'GET', url: 'http://127.0.0.1:1/x', headers: [], params: [],
    body: { type: 'none' }, auth: { type: 'none' } }, {})
  assert.strictEqual(r.ok, false)
  assert.ok(r.error)
})

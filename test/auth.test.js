const { test } = require('node:test')
const assert = require('node:assert')
const { buildAuth } = require('../src/shared/auth')

test('none -> empty', () => {
  assert.deepStrictEqual(buildAuth({ type: 'none' }, {}), { headers: {}, query: {} })
})
test('bearer -> Authorization header', () => {
  const r = buildAuth({ type: 'bearer' }, { token: 'abc' })
  assert.strictEqual(r.headers.Authorization, 'Bearer abc')
})
test('basic -> base64 Authorization header', () => {
  const r = buildAuth({ type: 'basic', username: 'joe' }, { password: 'pw' })
  assert.strictEqual(r.headers.Authorization, 'Basic ' + Buffer.from('joe:pw').toString('base64'))
})
test('apikey in header', () => {
  const r = buildAuth({ type: 'apikey', name: 'X-Api-Key', in: 'header' }, { value: 'k' })
  assert.strictEqual(r.headers['X-Api-Key'], 'k')
})
test('apikey in query', () => {
  const r = buildAuth({ type: 'apikey', name: 'api_key', in: 'query' }, { value: 'k' })
  assert.strictEqual(r.query.api_key, 'k')
})
test('missing secret -> no header', () => {
  assert.deepStrictEqual(buildAuth({ type: 'bearer' }, {}), { headers: {}, query: {} })
})

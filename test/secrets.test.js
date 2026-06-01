const { test } = require('node:test')
const assert = require('node:assert')
const { splitSecrets, mergeSecret } = require('../src/shared/secrets')
const { importPostman } = require('../src/shared/postman')

test('bearer: token stripped from synced, kept in secret', () => {
  const req = { id: '1', auth: { type: 'bearer', token: 'SECRET' } }
  const { synced, secret } = splitSecrets(req)
  assert.strictEqual(JSON.stringify(synced).includes('SECRET'), false)
  assert.strictEqual(synced.auth.type, 'bearer')
  assert.strictEqual(secret.token, 'SECRET')
})
test('basic: username synced, password stripped', () => {
  const req = { id: '1', auth: { type: 'basic', username: 'joe', password: 'pw' } }
  const { synced, secret } = splitSecrets(req)
  assert.strictEqual(synced.auth.username, 'joe')
  assert.strictEqual(JSON.stringify(synced).includes('pw'), false)
  assert.strictEqual(secret.password, 'pw')
})
test('apikey: name/in synced, value stripped', () => {
  const req = { id: '1', auth: { type: 'apikey', name: 'X-Api-Key', in: 'header', value: 'k' } }
  const { synced, secret } = splitSecrets(req)
  assert.strictEqual(synced.auth.name, 'X-Api-Key')
  assert.strictEqual(JSON.stringify(synced).includes('"k"'), false)
  assert.strictEqual(secret.value, 'k')
})
test('mergeSecret re-attaches secret onto synced auth', () => {
  const synced = { id: '1', auth: { type: 'bearer' } }
  const merged = mergeSecret(synced, { token: 'T' })
  assert.strictEqual(merged.auth.token, 'T')
})
test('end-to-end: imported collection JSON never contains a secret', () => {
  const SAMPLE = {
    info: { name: 'My API' },
    item: [{ name: 'Get', request: {
      method: 'GET', url: { raw: 'https://api.test/x' },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: 'SECRET' }] }
    }}]
  }
  const { collection, secrets } = importPostman(SAMPLE)
  assert.strictEqual(JSON.stringify(collection).includes('SECRET'), false)
  const id = collection.items[0].id
  assert.strictEqual(secrets[id].token, 'SECRET')
})

const { test } = require('node:test')
const assert = require('node:assert')
const { importPostman } = require('../src/shared/postman')

const SAMPLE = {
  info: { name: 'My API' },
  item: [
    { name: 'Folder A', item: [
      { name: 'Get Thing', request: {
        method: 'GET', url: { raw: 'https://api.test/things?q=1' },
        header: [{ key: 'Accept', value: 'application/json' }],
        auth: { type: 'bearer', bearer: [{ key: 'token', value: 'SECRET' }] }
      }}
    ]},
    { name: 'Post Thing', request: {
      method: 'POST', url: { raw: 'https://api.test/things' },
      body: { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } }
    }}
  ]
}

test('maps name, tree, methods', () => {
  const { collection } = importPostman(SAMPLE)
  assert.strictEqual(collection.name, 'My API')
  const folder = collection.items[0]
  assert.strictEqual(folder.type, 'folder')
  assert.strictEqual(folder.items[0].method, 'GET')
  assert.strictEqual(folder.items[0].url, 'https://api.test/things?q=1')
  assert.strictEqual(collection.items[1].method, 'POST')
})
test('maps raw json body', () => {
  const { collection } = importPostman(SAMPLE)
  const post = collection.items[1]
  assert.strictEqual(post.body.type, 'json')
  assert.strictEqual(post.body.content, '{"a":1}')
})
test('auth type synced, secret routed out (not in collection JSON)', () => {
  const { collection, secrets } = importPostman(SAMPLE)
  const get = collection.items[0].items[0]
  assert.strictEqual(get.auth.type, 'bearer')
  assert.strictEqual(JSON.stringify(collection).includes('SECRET'), false)
  assert.strictEqual(secrets[get.id].token, 'SECRET')
})

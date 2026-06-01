const { test } = require('node:test')
const assert = require('node:assert')
const { interpretPoll } = require('../src/main/oauth')

test('access_token -> done', () => {
  assert.deepStrictEqual(interpretPoll({ access_token: 'tok' }), { status: 'done', token: 'tok' })
})
test('authorization_pending -> pending', () => {
  assert.strictEqual(interpretPoll({ error: 'authorization_pending' }).status, 'pending')
})
test('slow_down -> slow_down with interval', () => {
  const r = interpretPoll({ error: 'slow_down', interval: 10 })
  assert.strictEqual(r.status, 'slow_down')
  assert.strictEqual(r.interval, 10)
})
test('expired_token -> error', () => {
  assert.strictEqual(interpretPoll({ error: 'expired_token' }).status, 'error')
})
test('access_denied -> error', () => {
  assert.strictEqual(interpretPoll({ error: 'access_denied' }).status, 'error')
})
test('unknown error -> error with message', () => {
  const r = interpretPoll({ error: 'whoops', error_description: 'bad things' })
  assert.strictEqual(r.status, 'error')
  assert.strictEqual(r.message, 'bad things')
})

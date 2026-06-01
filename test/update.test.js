const { test } = require('node:test')
const assert = require('node:assert')
const { isNewer, parseVersion } = require('../src/main/update')

test('parseVersion strips v and splits', () => {
  assert.deepStrictEqual(parseVersion('v1.2.3'), [1, 2, 3])
})
test('newer minor', () => assert.strictEqual(isNewer('0.3.0', '0.2.0'), true))
test('newer patch', () => assert.strictEqual(isNewer('v0.2.1', '0.2.0'), true))
test('same is not newer', () => assert.strictEqual(isNewer('0.2.0', '0.2.0'), false))
test('older is not newer', () => assert.strictEqual(isNewer('0.1.9', '0.2.0'), false))
test('major beats long minor', () => assert.strictEqual(isNewer('1.0.0', '0.99.99'), true))
test('handles tag with v prefix on both sides', () => assert.strictEqual(isNewer('v2.0.0', 'v1.0.0'), true))

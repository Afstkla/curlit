const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { readConfigFrom } = require('../src/main/config')

function tmpConfig(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curlit-cfg-'))
  const p = path.join(dir, 'config.json')
  fs.writeFileSync(p, JSON.stringify(obj))
  return p
}

test('returns first readable config with repoUrl/clientId', () => {
  const p = tmpConfig({ repoUrl: 'https://github.com/x/y.git', clientId: 'Iv1.abc' })
  const cfg = readConfigFrom(['/nope/missing.json', p])
  assert.strictEqual(cfg.repoUrl, 'https://github.com/x/y.git')
  assert.strictEqual(cfg.clientId, 'Iv1.abc')
})
test('skips missing files and falls through', () => {
  assert.strictEqual(readConfigFrom(['/nope/a.json', '/nope/b.json']), null)
})
test('ignores an empty object (no repoUrl/clientId)', () => {
  const p = tmpConfig({})
  assert.strictEqual(readConfigFrom([p]), null)
})
test('precedence: earlier path wins', () => {
  const first = tmpConfig({ repoUrl: 'FIRST' })
  const second = tmpConfig({ repoUrl: 'SECOND' })
  assert.strictEqual(readConfigFrom([first, second]).repoUrl, 'FIRST')
})

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')

const R = path.join(__dirname, '../src/renderer')
const appJs = fs.readFileSync(path.join(R, 'app.js'), 'utf8')

// Reuse the preview's DOM + mock backend, but inline app.js so jsdom runs it
// without needing to fetch a file, and drop the network font <link>s.
let preview = fs.readFileSync(path.join(R, '_preview.html'), 'utf8')
preview = preview
  .replace(/<link[^>]*fonts[^>]*>/g, '')
  .replace(/<link rel="preconnect"[^>]*>/g, '')
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace('<script src="app.js"></script>', `<script>${appJs}</script>`)

const wait = (ms) => new Promise(r => setTimeout(r, ms))

test('renderer: boots, renders tree, opens a request, renders a response', async () => {
  const dom = new JSDOM(preview, { runScripts: 'dangerously', pretendToBeVisual: true })
  // let the mock promises resolve and the preview driver (openRequest + send) run
  await wait(900)
  const doc = dom.window.document

  // tree rendered (2 in the "Users" folder + 2 top-level = 4 requests)
  const rows = doc.querySelectorAll('.req-row')
  assert.ok(rows.length >= 4, `expected >=4 request rows, got ${rows.length}`)

  // editor opened
  assert.strictEqual(doc.getElementById('editor').classList.contains('hidden'), false)
  assert.ok(doc.getElementById('url').value.includes('acme'), 'url should be populated')

  // method badge color class present for a GET
  assert.ok(doc.querySelector('.verb.GET'), 'a GET verb badge should exist')

  // response rendered from the mock send (status 200)
  const pill = doc.getElementById('resp-status')
  assert.strictEqual(pill.textContent, '200')
  assert.ok(pill.classList.contains('ok'), 'status pill should be ok-colored')

  // params inferred from the opened request's URL query (?limit=20), URL bar holds the base
  const paramRows = doc.querySelectorAll('#params-rows .kv-row')
  const paramKeys = [...paramRows].map(r => r.querySelectorAll('input[type=text]')[0].value)
  assert.ok(paramKeys.includes('limit'), 'query param "limit" should appear in the Params tab')
  assert.ok(!doc.getElementById('url').value.includes('?'), 'URL bar should not keep the query string')

  // splitUrl handles {{vars}} without mangling them
  const sp = dom.window.splitUrl('https://api.studio.neople.io/v1/customer_service/skills?neople_id={{neople_id}}')
  assert.strictEqual(sp.base, 'https://api.studio.neople.io/v1/customer_service/skills')
  assert.strictEqual(sp.params.length, 1)
  assert.strictEqual(sp.params[0].key, 'neople_id')
  assert.strictEqual(sp.params[0].value, '{{neople_id}}')

  dom.window.close()
})

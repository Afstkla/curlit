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

  // secret hydration: bearer token field filled from getSecret mock
  doc.getElementById('auth-type').value = 'bearer'
  dom.window.close()
})

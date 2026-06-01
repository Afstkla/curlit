'use strict'
const api = window.curlit
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const $ = (id) => document.getElementById(id)
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

let collections = []      // [{id, name, items:[node]}]
let active = null         // { col, req }  references into `collections`
let dirty = false

/* ---------------- boot ---------------- */
let setupRepoUrl = ''
let currentUserCode = ''
let currentVerifyUri = 'https://github.com/login/device'

async function boot() {
  const setup = await api.getSetup()
  if (setup && setup.repoUrl) { await startApp(); return }
  await showSetup()
}

async function showSetup() {
  const cfg = (await api.getConfig()) || {}
  $('setup').classList.remove('hidden')
  if (cfg.repoUrl) {
    setupRepoUrl = cfg.repoUrl
    $('repo-field').classList.add('hidden')
    $('repo-known').classList.remove('hidden')
    $('repo-known-url').textContent = cfg.repoUrl
  }
  $('connect-github').addEventListener('click', connectGithub)
  $('copy-code').addEventListener('click', () => { if (currentUserCode) navigator.clipboard.writeText(currentUserCode) })
  $('reopen-github').addEventListener('click', () => api.openExternal(currentVerifyUri))
  $('cancel-auth').addEventListener('click', () => {
    $('setup-pending').classList.add('hidden')
    $('setup-idle').classList.remove('hidden')
    setStatus('')
  })
}

function setStatus(msg, cls) { const s = $('setup-status'); s.className = 'setup-status' + (cls ? ' ' + cls : ''); s.textContent = msg }

async function connectGithub() {
  const repoUrl = setupRepoUrl || $('setup-repo').value.trim()
  if (!repoUrl) { setStatus('Please paste your team’s repository link first.'); return }
  setupRepoUrl = repoUrl
  setStatus('Starting GitHub sign-in…', 'busy')
  const start = await api.startDeviceAuth()
  if (start.error) { setStatus(start.error); return }
  const info = start.info
  currentUserCode = info.user_code
  currentVerifyUri = info.verification_uri || 'https://github.com/login/device'
  $('setup-idle').classList.add('hidden')
  $('setup-pending').classList.remove('hidden')
  $('device-code').textContent = info.user_code
  api.openExternal(currentVerifyUri)

  const res = await api.completeDeviceAuth(repoUrl, info)
  if (res.error) {
    $('setup-pending').classList.add('hidden')
    $('setup-idle').classList.remove('hidden')
    setStatus(res.error)
    return
  }
  $('setup').classList.add('hidden')
  await startApp()
}

async function startApp() {
  $('app').classList.remove('hidden')
  buildMethodSelect()
  wireEditor()
  setSync('busy', 'pulling…')
  try { await api.launchPull() } catch {}
  await refreshTree()
  setSync('ok', 'synced')
  checkForUpdate()
}

async function checkForUpdate() {
  if (!api.checkUpdate) return
  try {
    const u = await api.checkUpdate()
    if (u && u.available) {
      $('update-text').textContent = `Curlit ${u.version} is available`
      $('update-download').onclick = () => api.openExternal(u.url)
      $('update-dismiss').onclick = () => $('update-banner').classList.add('hidden')
      $('update-banner').classList.remove('hidden')
    }
  } catch { /* update check is best-effort */ }
}

/* ---------------- sidebar tree ---------------- */
async function refreshTree() {
  collections = await api.listTree()
  renderTree()
}

function renderTree() {
  const root = $('tree'); root.innerHTML = ''
  if (!collections.length) {
    const hint = el('div', 'muted'); hint.style.padding = '14px 8px'; hint.style.fontSize = '12px'
    hint.textContent = 'No collections yet. Use ＋ to create one or ⇪ to import from Postman.'
    root.appendChild(hint)
    return
  }
  for (const col of collections) root.appendChild(renderCollection(col))
}

function renderCollection(col) {
  const wrap = el('div', 'collection')
  const head = el('div', 'col-head')
  const twist = el('span', 'twist', '▼')
  const name = el('span', 'col-name', col.name)
  name.addEventListener('dblclick', () => inlineRename(name, col.name, (v) => { col.name = v; persist(col) }))
  const add = el('span', 'col-add', '＋'); add.title = 'New request'
  const del = el('span', 'col-add', '✕'); del.title = 'Delete collection'
  const children = el('div', 'node-children')

  head.append(twist, name, add, del)
  head.addEventListener('click', (e) => { if (e.target === add || e.target === del) return; head.classList.toggle('collapsed'); children.classList.toggle('hidden') })
  add.addEventListener('click', (e) => { e.stopPropagation(); addRequest(col) })
  del.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete collection “${col.name}” and all its requests?`)) return
    setSync('busy', 'syncing…'); await api.deleteCollection(col.id)
    if (active && active.col === col) closeEditor()
    await refreshTree(); setSync('ok', 'synced')
  })

  for (const node of col.items) children.appendChild(renderNode(node, col))
  wrap.append(head, children)
  return wrap
}

function renderNode(node, col) {
  if (node.type === 'folder') {
    const wrap = el('div', 'folder')
    const head = el('div', 'folder-head')
    const twist = el('span', 'twist', '▼')
    const name = el('span', 'col-name', node.name)
    head.append(twist, name)
    const children = el('div', 'node-children')
    head.addEventListener('click', () => wrap.classList.toggle('collapsed'))
    for (const child of node.items) children.appendChild(renderNode(child, col))
    wrap.append(head, children)
    return wrap
  }
  // request
  const row = el('div', 'req-row')
  row.dataset.reqId = node.id
  const verb = el('span', 'verb ' + node.method, node.method)
  const name = el('span', 'req-name', node.name)
  name.addEventListener('dblclick', (e) => { e.stopPropagation(); inlineRename(name, node.name, (v) => { node.name = v; persist(col); if (active && active.req === node) {/* name only in tree */} }) })
  row.append(verb, name)
  row.addEventListener('click', () => openRequest(col, node))
  if (active && active.req === node) row.classList.add('active')
  return row
}

function inlineRename(span, current, done) {
  const input = el('input', 'rename-input'); input.type = 'text'; input.value = current
  input.style.cssText = 'width:100%;background:var(--bg-deep);border:1px solid var(--accent-dim);border-radius:5px;padding:2px 6px;font-family:inherit;font-size:12px;color:var(--ink)'
  span.replaceWith(input); input.focus(); input.select()
  const commit = () => { const v = input.value.trim() || current; span.textContent = v; input.replaceWith(span); if (v !== current) done(v) }
  input.addEventListener('blur', commit)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = current; input.blur() } })
}

/* ---------------- new collection / request ---------------- */
async function newCollection() {
  const col = { id: uid('col_'), name: 'untitled', items: [] }
  setSync('busy', 'syncing…'); await api.saveCollection(col); setSync('ok', 'synced')
  collections.push(col); renderTree()
  // enter rename on the freshly added collection
  const heads = $('tree').querySelectorAll('.col-name')
  const last = heads[heads.length - 1]
  if (last) last.dispatchEvent(new MouseEvent('dblclick'))
}

async function addRequest(col) {
  const req = { type: 'request', id: uid('req_'), name: 'New Request', method: 'GET', url: '',
    params: [], headers: [], body: { type: 'none', content: '', fields: [] }, auth: { type: 'none' } }
  col.items.push(req)
  await persist(col)
  renderTree()
  openRequest(col, req)
}

/* ---------------- editor ---------------- */
function buildMethodSelect() {
  const sel = $('method'); sel.innerHTML = ''
  for (const m of METHODS) { const o = el('option', null, m); o.value = m; sel.appendChild(o) }
}

function wireEditor() {
  $('new-collection').addEventListener('click', newCollection)
  $('import-postman').addEventListener('click', importPostman)
  $('send').addEventListener('click', sendCurrent)
  $('save').addEventListener('click', saveCurrent)
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)))
  document.querySelectorAll('.rtab').forEach(t => t.addEventListener('click', () => switchRespTab(t.dataset.rtab)))
  $('body-type').addEventListener('change', () => { onBodyTypeChange(); markDirty() })
  $('auth-type').addEventListener('change', () => { renderAuthFields(); markDirty() })
  $('resp-copy').addEventListener('click', copyResponse)
  ;[$('method'), $('url'), $('body-text')].forEach(e => e.addEventListener('input', markDirty))
  $('method').addEventListener('change', () => { if (active) { active.req.method = $('method').value; updateVerbBadge() } })
}

function openRequest(col, req) {
  active = { col, req }
  $('empty-state').classList.add('hidden')
  $('editor').classList.remove('hidden')
  document.querySelectorAll('.req-row').forEach(r => r.classList.toggle('active', r.dataset.reqId === req.id))

  $('method').value = req.method || 'GET'
  $('url').value = req.url || ''
  renderKV('params-rows', req.params, 'name', 'value')
  renderKV('headers-rows', req.headers, 'header', 'value')

  // body
  $('body-type').value = (req.body && req.body.type) || 'none'
  $('body-text').value = (req.body && req.body.content) || ''
  renderKV('body-fields', (req.body && req.body.fields) || [], 'key', 'value')
  onBodyTypeChange()

  // auth (structure) + secrets (local)
  $('auth-type').value = (req.auth && req.auth.type) || 'none'
  renderAuthFields()
  loadSecrets(req.id)

  clearResponse()
  switchTab('params')
  setDirty(false)
}

function closeEditor() {
  active = null
  $('editor').classList.add('hidden')
  $('empty-state').classList.remove('hidden')
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name))
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.dataset.pane === name))
}
function switchRespTab(name) {
  document.querySelectorAll('.rtab').forEach(t => t.classList.toggle('active', t.dataset.rtab === name))
  $('resp-body').classList.toggle('hidden', name !== 'body')
  $('resp-headers').classList.toggle('hidden', name !== 'headers')
}

function updateVerbBadge() {
  const row = document.querySelector(`.req-row[data-req-id="${active.req.id}"] .verb`)
  if (row) { row.textContent = active.req.method; row.className = 'verb ' + active.req.method }
}

/* ---------- key/value rows ---------- */
function renderKV(containerId, list, kPlaceholder, vPlaceholder) {
  const box = $(containerId); box.innerHTML = ''
  const rows = list || []
  const make = (item) => {
    const row = el('div', 'kv-row')
    const tog = el('label', 'toggle')
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = item.enabled !== false
    tog.appendChild(cb)
    const k = el('input'); k.type = 'text'; k.placeholder = kPlaceholder; k.value = item.key || ''
    const v = el('input'); v.type = 'text'; v.placeholder = vPlaceholder; v.value = item.value || ''
    const del = el('button', 'kv-del', '✕')
    ;[cb, k, v].forEach(e => e.addEventListener('input', markDirty))
    del.addEventListener('click', () => { row.remove(); markDirty() })
    row.append(tog, k, v, del)
    return row
  }
  for (const item of rows) box.appendChild(make(item))
  const add = el('button', 'kv-add', '＋ add row')
  add.addEventListener('click', () => { box.insertBefore(make({ key: '', value: '', enabled: true }), add); markDirty() })
  box.appendChild(add)
}

function readKV(containerId) {
  const out = []
  $(containerId).querySelectorAll('.kv-row').forEach(row => {
    const [cb, k, v] = row.querySelectorAll('input')
    if (k.value || v.value) out.push({ key: k.value, value: v.value, enabled: cb.checked })
  })
  return out
}

/* ---------- body ---------- */
function onBodyTypeChange() {
  const t = $('body-type').value
  $('body-text').classList.toggle('hidden', !(t === 'json' || t === 'text'))
  $('body-fields').classList.toggle('hidden', t !== 'urlencoded')
  if (t === 'json') $('body-text').placeholder = '{ "key": "value" }'
  if (t === 'text') $('body-text').placeholder = 'raw text body'
}

/* ---------- auth ---------- */
function renderAuthFields() {
  const t = $('auth-type').value
  const box = $('auth-fields'); box.innerHTML = ''
  const field = (label, secret, opts = {}) => {
    const wrap = el('label', 'field')
    const span = el('span'); span.textContent = label + ' '
    if (secret) { const tag = el('em', 'secret-tag', '(local only)'); span.appendChild(tag) }
    wrap.appendChild(span)
    let input
    if (opts.options) {
      input = el('select')
      for (const o of opts.options) { const op = el('option', null, o.label); op.value = o.value; input.appendChild(op) }
    } else {
      input = el('input'); input.type = secret ? 'password' : 'text'; input.spellcheck = false
      input.placeholder = opts.placeholder || ''
    }
    input.dataset.authField = opts.field
    input.addEventListener('input', markDirty); input.addEventListener('change', markDirty)
    wrap.appendChild(input); box.appendChild(wrap)
    return input
  }
  if (t === 'bearer') {
    field('Token', true, { field: 'token', placeholder: 'token value' })
  } else if (t === 'basic') {
    field('Username', false, { field: 'username', placeholder: 'username' })
    field('Password', true, { field: 'password', placeholder: 'password' })
  } else if (t === 'apikey') {
    field('Key name', false, { field: 'name', placeholder: 'X-Api-Key' })
    field('Add to', false, { field: 'in', options: [{ label: 'Header', value: 'header' }, { label: 'Query param', value: 'query' }] })
    field('Value', true, { field: 'value', placeholder: 'key value' })
  }
  // hydrate non-secret structure from the request
  if (active) {
    const a = active.req.auth || {}
    box.querySelectorAll('[data-auth-field]').forEach(inp => {
      const f = inp.dataset.authField
      if (f in a && a[f] != null && !isSecretField(t, f)) inp.value = a[f]
      if (f === 'in' && !a.in) inp.value = 'header'
    })
  }
}
function isSecretField(type, field) {
  return (type === 'bearer' && field === 'token') ||
         (type === 'basic' && field === 'password') ||
         (type === 'apikey' && field === 'value')
}

async function loadSecrets(reqId) {
  const secret = await api.getSecret(reqId) || {}
  const t = $('auth-type').value
  $('auth-fields').querySelectorAll('[data-auth-field]').forEach(inp => {
    const f = inp.dataset.authField
    if (isSecretField(t, f) && secret[f] != null) inp.value = secret[f]
  })
}

function readAuth() {
  const t = $('auth-type').value
  const auth = { type: t }
  const secret = {}
  $('auth-fields').querySelectorAll('[data-auth-field]').forEach(inp => {
    const f = inp.dataset.authField
    if (isSecretField(t, f)) { if (inp.value) secret[f] = inp.value }
    else auth[f] = inp.value
  })
  return { auth, secret }
}

/* ---------- read editor into request ---------- */
function readEditor() {
  const { auth, secret } = readAuth()
  const req = {
    type: 'request', id: active.req.id, name: active.req.name,
    method: $('method').value, url: $('url').value,
    params: readKV('params-rows'),
    headers: readKV('headers-rows'),
    body: { type: $('body-type').value, content: $('body-text').value, fields: readKV('body-fields') },
    auth
  }
  return { req, secret }
}

/* ---------------- actions ---------------- */
async function saveCurrent() {
  if (!active) return
  const { req, secret } = readEditor()
  // replace node in place within its collection (preserve tree position)
  Object.assign(active.req, req)
  await api.setSecret(req.id, secret)
  setSync('busy', 'syncing…')
  const res = await persist(active.col)
  setSync(res && res.syncError ? 'err' : 'ok', res && res.syncError ? 'sync failed' : 'synced')
  setDirty(false)
  updateVerbBadge()
}

async function persist(col) {
  return api.saveCollection(col)
}

async function sendCurrent() {
  if (!active) return
  const { req, secret } = readEditor()
  Object.assign(active.req, req)
  await api.setSecret(req.id, secret)   // ensure backend can read fresh secret
  const btn = $('send'); btn.classList.add('sending'); btn.textContent = '…'
  const out = await api.sendRequest(req)
  btn.classList.remove('sending'); btn.textContent = 'Send'
  renderResponse(out)
}

async function importPostman() {
  setSync('busy', 'importing…')
  const res = await api.importPostman()
  if (res && res.error) { setSync('err', 'import failed'); alert(res.error); return }
  await refreshTree()
  setSync('ok', 'synced')
}

/* ---------------- response ---------------- */
function clearResponse() {
  $('resp-status').className = 'status-pill idle'; $('resp-status').textContent = '—'
  $('resp-meta').textContent = ''
  $('resp-body').innerHTML = '<span class="muted">Send a request to see the response.</span>'
  $('resp-headers').innerHTML = ''
  switchRespTab('body')
}

function renderResponse(out) {
  const pill = $('resp-status')
  if (!out.ok) {
    pill.className = 'status-pill err'; pill.textContent = 'ERR'
    $('resp-meta').textContent = `${out.timeMs} ms`
    $('resp-body').textContent = out.error || 'Request failed.'
    $('resp-headers').innerHTML = ''
    switchRespTab('body')
    return
  }
  const s = out.status
  pill.textContent = String(s)
  pill.className = 'status-pill ' + (s < 300 ? 'ok' : s < 400 ? 'redir' : s < 500 ? 'warn' : 'err')
  $('resp-meta').textContent = `${out.timeMs} ms · ${formatBytes(out.size)}`

  // body
  const body = $('resp-body')
  let pretty = null
  try { pretty = JSON.stringify(JSON.parse(out.body), null, 2) } catch {}
  if (pretty != null) body.innerHTML = highlightJson(pretty)
  else body.textContent = out.body || ''

  // headers
  const hbox = $('resp-headers'); hbox.innerHTML = ''
  const h = out.headers || {}
  Object.keys(h).forEach(k => {
    const row = el('div', 'resp-h-row')
    row.append(el('span', 'hk', k), el('span', 'hv', Array.isArray(h[k]) ? h[k].join(', ') : String(h[k])))
    hbox.appendChild(row)
  })
  switchRespTab('body')
}

function copyResponse() {
  const txt = $('resp-body').textContent
  navigator.clipboard.writeText(txt).then(() => {
    const b = $('resp-copy'); const old = b.textContent; b.textContent = 'Copied'; setTimeout(() => b.textContent = old, 1100)
  })
}

function highlightJson(json) {
  const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'j-num'
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'j-key' : 'j-str'
      else if (/true|false/.test(m)) cls = 'j-bool'
      else if (/null/.test(m)) cls = 'j-null'
      return `<span class="${cls}">${m}</span>`
    })
}

function formatBytes(n) {
  if (n == null) return '0 B'
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(2) + ' MB'
}

/* ---------------- misc ---------------- */
function markDirty() { setDirty(true) }
function setDirty(v) { dirty = v; $('save').classList.toggle('dirty', v) }
function setSync(state, label) {
  const dot = $('sync-dot'); dot.className = 'sync-dot' + (state === 'busy' ? ' busy' : state === 'err' ? ' err' : '')
  $('sync-label').textContent = label
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendCurrent() }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveCurrent() }
})

boot()

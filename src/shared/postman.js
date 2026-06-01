const { splitSecrets } = require('./secrets')

function idFactory() {
  // Unique seed per import so ids never collide across separate imports
  // (a plain counter restarts at 1 each call -> every import's collection got
  // the same id and overwrote the previous file). Counter keeps ids unique
  // within one import.
  let n = 0
  const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  return () => { n += 1; return 'imp_' + seed + '_' + n }
}

function mapBody(body) {
  if (!body || !body.mode) return { type: 'none', content: '', fields: [] }
  if (body.mode === 'raw') {
    const lang = body.options && body.options.raw && body.options.raw.language
    return { type: lang === 'json' ? 'json' : 'text', content: body.raw || '', fields: [] }
  }
  if (body.mode === 'urlencoded') {
    return {
      type: 'urlencoded', content: '',
      fields: (body.urlencoded || []).map(p => ({ key: p.key, value: p.value || '' }))
    }
  }
  return { type: 'none', content: '', fields: [] } // formdata/file unsupported in v1
}

function mapAuth(auth) {
  if (!auth || !auth.type) return { type: 'none' }
  const get = (arr, key) => ((arr || []).find(x => x.key === key) || {}).value
  if (auth.type === 'bearer') return { type: 'bearer', token: get(auth.bearer, 'token') }
  if (auth.type === 'basic') {
    return { type: 'basic', username: get(auth.basic, 'username') || '', password: get(auth.basic, 'password') }
  }
  if (auth.type === 'apikey') {
    const where = get(auth.apikey, 'in')
    return {
      type: 'apikey', name: get(auth.apikey, 'key') || '',
      in: where === 'query' ? 'query' : 'header', value: get(auth.apikey, 'value')
    }
  }
  return { type: 'none' }
}

function importPostman(json, nextId = idFactory()) {
  const secrets = {}
  const mapRequest = (node) => {
    const r = node.request || {}
    const id = nextId()
    const req = {
      type: 'request', id, name: node.name || 'Untitled',
      method: (r.method || 'GET').toUpperCase(),
      url: (r.url && (r.url.raw || r.url)) || '',
      params: [],
      headers: (r.header || []).map(h => ({ key: h.key, value: h.value || '', enabled: !h.disabled })),
      body: mapBody(r.body),
      auth: mapAuth(r.auth)
    }
    const { synced, secret } = splitSecrets(req)
    if (Object.keys(secret).length) secrets[id] = secret
    return synced
  }
  const mapItems = (items) => (items || []).map(it =>
    it.item
      ? { type: 'folder', id: nextId(), name: it.name || 'Folder', items: mapItems(it.item) }
      : mapRequest(it))
  const collection = {
    id: nextId(),
    name: (json.info && json.info.name) || 'Imported',
    items: mapItems(json.item)
  }
  return { collection, secrets }
}
module.exports = { importPostman }

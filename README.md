# Curlit

A small, no-frills REST client for macOS. A lightweight stand-in for Postman:
save requests in a familiar collection tree, fire real HTTP, import your existing
Postman collections, and sync everything through a **private GitHub repo** — while
your **secrets stay on your Mac and never get pushed to git**.

Built with Electron. macOS only.

## What it does

- Send `GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS` requests.
- Organise requests in a Postman-style **collection → folder → request** tree.
- **Auth tab**: Bearer token, Basic auth, or API key (header or query) — generated
  for you at send time.
- **Import from Postman**: pick a Postman Collection **v2.1** JSON export.
- **Auto-sync**: pulls on launch, commits + pushes on every save, to your private
  GitHub repo.
- Pretty-printed, syntax-highlighted JSON responses with status, timing, and size.

## First-run setup

On first launch Curlit asks for two things:

1. **Repo URL (HTTPS)** — a private GitHub repo to store collections in, e.g.
   `https://github.com/your-org/curlit-collections.git`. It can be empty; Curlit
   will initialise it on first save.
2. **GitHub token** — a Personal Access Token with **read/write on repository
   contents** for that repo:
   - Go to GitHub → Settings → Developer settings → **Fine-grained tokens** →
     Generate new token.
   - Restrict it to the one collections repo.
   - Repository permissions → **Contents: Read and write**.
   - Copy the `github_pat_…` value into Curlit.

Both are stored **encrypted in the macOS Keychain** (via Electron `safeStorage`),
on this Mac only.

### Where things live

- **Synced to git** (your collections repo): method, URL, params, headers, body,
  and the *type/shape* of auth — never the secret value.
- **Local only, never synced**: bearer tokens, basic passwords, API-key values,
  and your GitHub token. Stored encrypted in app data, outside the git clone.

After syncing to another Mac, a request shows its auth *type* but the secret field
is blank — fill it in once there and it's remembered locally.

## Installing the built app

Curlit isn't code-signed (no Apple Developer account), so the **first** launch on
each Mac needs a one-time bypass of Gatekeeper:

1. Drag **Curlit.app** to Applications.
2. **Right-click → Open**, then confirm **Open** in the dialog.

After that, it opens normally from then on.

## Building from source

```bash
npm install
npm test         # run the unit + renderer smoke tests
npm start        # run in dev
npm run dist     # build dist/Curlit-<version>.dmg
```

## Scope (v1)

Intentionally minimal. **Not** included: WebSockets, `{{variable}}` substitution,
OAuth2 flows, folder/collection-level auth inheritance, form-data file uploads,
request history, and scripting. Imported `{{variables}}` are kept as literal text.

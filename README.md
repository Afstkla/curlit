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
  GitHub collections repo.
- **Connect with GitHub** — no tokens to create or paste.
- Pretty-printed, syntax-highlighted JSON responses with status, timing, and size.
- **Update notice**: checks for a newer release on launch and offers a one-click
  download.

## For specialists: first-run

1. Open Curlit.
2. Click **Connect with GitHub**. A browser tab opens.
3. Enter the short code Curlit shows you, click **Authorize**.
4. That's it — your team's request library loads and stays in sync.

No tokens, no settings. Your GitHub sign-in stays on this Mac (in the Keychain)
and you can revoke it anytime at github.com → Settings → Applications.

### Where things live

- **Synced to git** (your collections repo): method, URL, params, headers, body,
  and the *type/shape* of auth — never the secret value.
- **Local only, never synced**: bearer tokens, basic passwords, API-key values.
  Stored encrypted in app data, outside the git clone. After syncing to another
  Mac, a request shows its auth *type* but the secret field is blank — fill it in
  once there and it's remembered locally.

## Installing the built app

Curlit isn't code-signed (no Apple Developer account), so the **first** launch on
each Mac needs a one-time bypass of Gatekeeper:

1. Drag **Curlit.app** to Applications.
2. **Right-click → Open**, then confirm **Open** in the dialog.

After that, it opens normally.

## For admins: one-time setup

Two things make "Connect with GitHub" work. Both are public, non-secret values
that live in `config.json` (committed, bundled into the app).

### 1. The collections repo

A private GitHub repo where requests are stored, e.g.
`https://github.com/Afstkla/curlit-collections`. Put its `.git` HTTPS URL in
`config.json` → `repoUrl`. It can start empty; Curlit initialises it on first save.

### 2. A GitHub OAuth App (for device-flow sign-in)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Application name: `Curlit`. Homepage URL: the curlit repo URL is fine.
   Authorization callback URL: any valid URL (device flow doesn't use it, e.g.
   `https://github.com/Afstkla/curlit`).
3. Create it, then on the app page **enable "Device Flow"** (checkbox).
4. Copy the **Client ID** (looks like `Iv1.xxxxxxxxxxxx` — this is *public*, safe
   to embed) into `config.json` → `clientId`.

The OAuth App grants each user the `repo` scope as themselves; their commits show
under their own GitHub identity. (For a more locked-down token limited to just the
collections repo, use a **GitHub App** instead — same in-app flow, more setup.)

`config.json` holds **no secrets** (just a repo URL + public client id), so it is
committed and bundled — even in a public build.

## Building & releasing

```bash
npm install
npm test           # unit + renderer smoke tests
npm start          # run in dev
npm run dist       # build dist/Curlit-<version>.dmg (no publish)
GH_TOKEN=… npm run release   # build + publish a GitHub Release (drives auto-update)
```

Auto-update is a **check + notify + one-click download** (it works on unsigned
apps): on launch Curlit asks the public `Afstkla/curlit` repo for its latest
release and, if newer, shows a "Download" banner. The user installs the new `.dmg`
over the old app. (Truly silent auto-update needs Apple code-signing.)

## Scope (v1)

Intentionally minimal. **Not** included: WebSockets, `{{variable}}` substitution,
folder/collection-level auth inheritance, form-data file uploads, request history,
and scripting. Imported `{{variables}}` are kept as literal text.

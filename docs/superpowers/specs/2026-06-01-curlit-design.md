# Curlit — Design Spec

**Date:** 2026-06-01
**Status:** Approved, ready for implementation planning

## Summary

Curlit is a small, macOS-only Electron app: a no-frills REST client to replace
per-seat Postman for occasional internal use. It stores requests in a
Postman-style tree, sends real HTTP from the Electron main process (no CORS
limits), imports Postman collections, and syncs collections through a private
GitHub repo — while keeping secrets local and out of git.

Target user: a semi-technical product specialist who uses it ~once a week.
Optimise for **ease of use** and **ease of installation** above all.

## Goals

- Send `GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS` requests.
- Save requests in a Postman-style collection → folder → request tree.
- Import Postman Collection v2.1 JSON exports.
- First-class auth (Bearer / Basic / API Key), Postman-style.
- Sync collections via a private GitHub repo, automatically.
- Keep secrets **local only** — never pushed to git.
- Ship as a double-click `.app`; no runtime or toolchain for the end user.

## Non-Goals (v1, YAGNI)

WebSockets; `{{variable}}` / environment substitution; OAuth2 flows;
folder/collection-level auth inheritance; form-data file uploads; request
history; tests/scripting. All are easy future adds; none built now.

## Tech & Packaging

- **Electron** app, **plain HTML/CSS/JS** frontend (styled via the
  frontend-design skill — distinctive, not generic).
- HTTP sent from the **main process** (Node `fetch` / `undici`), so arbitrary
  cross-origin requests work with no CORS restrictions.
- **Git sync via `isomorphic-git`** (pure JS, bundled) so the end user needs
  **nothing installed** — no system git, no Node, no Xcode, no terminal.
- Distributed as a `.dmg` containing the `.app`, built with `electron-builder`.
- App is **unsigned** (no Apple Developer account assumed): first launch on each
  Mac is a one-time **right-click → Open** to clear Gatekeeper. Code signing /
  notarization can be added later without design changes.
- Working name: **Curlit** (trivially renameable).

## Architecture

Two Electron processes with a thin IPC boundary:

- **Renderer (UI):** sidebar tree, request editor, response panel, setup screen,
  import dialog. Pure presentation + local interaction state. Holds no secrets
  beyond what the user is actively typing.
- **Main process:** owns all side effects — sending HTTP, reading/writing
  collection JSON, the git clone (`isomorphic-git`), and the encrypted local
  secret store (`safeStorage`). Exposes a small IPC API to the renderer.

IPC surface (indicative): `sendRequest(req)`, `listTree()`, `saveRequest(req)`,
`deleteRequest(id)`, `importPostman(filePath)`, `getSecret(reqId)`,
`setSecret(reqId, secret)`, `syncPull()`, `syncPush()`, `getSetup()`,
`saveSetup({repoUrl, pat})`.

## Data Model & Storage

Data splits into two stores by sensitivity:

### Synced to git (collection JSON)
A local **clone of the private GitHub repo** holds one JSON file per collection,
mirroring the Postman tree. Each request stores:
`id`, `name`, `method`, `url`, `params[]`, `headers[]`, `body` (type + content),
and `auth` = the **type plus non-secret structure** only
(e.g. `{type: "bearer"}`, or `{type: "apikey", name: "X-Api-Key", in: "header"}`).
**Secret values are stripped before writing.**

### Local-only, never synced (encrypted)
Actual secret values — bearer token, basic password, api-key value — live in a
local store keyed by request `id`, **outside the git clone**, in app-data.
Encrypted with Electron **`safeStorage`** (Keychain-backed). The GitHub **PAT**
from setup is stored the same way.

**Cross-machine consequence:** after syncing to another Mac, a pulled request
shows its auth *type* but the secret field is blank; the user fills it once
locally and it is remembered there.

## Sync Behaviour

- **First-run setup screen:** paste the repo HTTPS URL + a GitHub Personal
  Access Token (repo scope). Stored via `safeStorage`. If the local clone is
  absent, `clone` it.
- **On launch:** `pull` (fast-forward) the latest collections.
- **On save:** write the collection JSON → `commit` → `push`.
- **Push rejected** (remote moved): `pull`/rebase and retry once.
- **Conflicts:** last-write-wins, resolved quietly — acceptable for a single
  occasional user.
- All git operations run in the main process via `isomorphic-git` over HTTPS
  using the PAT.

## Request Editor

- Method dropdown (the seven verbs above).
- URL bar + **Send** button.
- Tabs:
  - **Params** — query key/value rows (reflected in the URL).
  - **Headers** — header key/value rows.
  - **Body** — None / Raw JSON / Raw text / `x-www-form-urlencoded`.
  - **Auth** — type dropdown:
    - **None**
    - **Bearer Token** — token (secret).
    - **Basic Auth** — username + password (password secret).
    - **API Key** — key name + value (secret), placed in **Header** or **Query**.
    At send time the app generates the correct header/query from this; the user
    never hand-writes `Authorization`.
- **Save** / **Save As** into the tree.

## Response Panel

- Status code (colour-coded), elapsed time (ms), response size.
- Body: pretty-printed, collapsible JSON or raw text, with a copy button.
- Response headers in a sub-tab.

## Postman Import

- File picker → reads a **Postman Collection v2.1 JSON** export.
- Recursively walks `item[]`: folders → subfolders → requests; maps method, raw
  URL, headers, and body (raw/json/urlencoded), plus **request-level auth**.
- `{{variables}}` are kept as **literal text** (no substitution in v1).
- Any **literal secret** found in the export (e.g. an inline bearer token) is
  routed into the **local** secret store, never the synced JSON.
- Collection-level inherited auth is **not** resolved in v1 (user re-enters).
- Imported collection drops into the tree and syncs (secrets excluded).

## Error Handling

- Network/send errors surface in the response panel with the message and no
  crash (timeouts, DNS, refused connections).
- Git failures (bad PAT, no network, auth rejected) surface a clear,
  non-blocking banner; the app stays usable offline and retries on next action.
- Invalid Postman file → explain what failed, import nothing.
- Missing/corrupt secret store → treat as empty, prompt to re-enter.

## Testing Strategy

- **Pure logic, unit-tested** (the bulk): Postman v2.1 → internal model mapping;
  secret stripping (assert no secret ever appears in synced JSON); auth →
  header/query generation; URL/params reconciliation.
- **Main-process integration:** git sync against a local bare repo (clone /
  commit / push / pull / rejected-push retry); `sendRequest` against a local
  mock HTTP server for each verb and body type.
- **Manual smoke:** build the `.app`, first-run setup, import a real Postman
  export, send a few authed requests, confirm secrets stay out of git.

## Open Questions / Future

- Signing/notarization for frictionless launch (needs a dev account).
- `{{variable}}` environments, OAuth2, folder-level auth inheritance,
  request history — deferred, none block v1.

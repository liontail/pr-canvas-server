# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the server (`node --env-file-if-exists=.env src/server.js`). Needs `MONGODB_URI` and `PUBLIC_BASE_URL` (see `.env.example`; never read `.env`).
- `npm run build:web` — build the viewer SPA into `public/` (gitignored). The server serves the built bundle; rebuild and restart after web changes.
- `npm run dev:web` — Vite dev server, proxies `/api` and `/c` to `localhost:3000`.
- `npm test` — `node --test` over `test/*.test.js` and `web/test/*.test.js` (Node >= 22.12).
- Single file: `node --test test/diff.test.js`. Server tests that use `test/helpers.js` throw unless `MONGODB_URI` is set; each test file creates and drops a throwaway `pr_canvas_test_*` database, so never point it at real data.

## Architecture

Two halves in one repo, both CommonJS on the server (`"type": "commonjs"`) and ESM + JSX under `web/` (`web/package.json` sets `"type": "module"`).

**Server (`src/`, Express 5 + MongoDB)** — a self-hosted backend for PR Lens canvases (`@coldtea/pr-lens-schema` validates graph docs, `@coldtea/pr-lens-renderer` draws them to SVG tiles).
- `server.js` wires `config` → `store` → `app`. `app.js` holds the canvas REST API; `library.js` (`/api/library`, groups/tags/names) and `viewer.js` (`/c/:id` HTML shell, `.svg` embed, asset routes, `/_app` static bundle) are mounted routers.
- `store.js` is the only Mongo access layer (collections `canvases`, `groups`, `revisions`). Write tokens are stored only as SHA-256 hashes.
- Auth model: minting returns a 22-char base64url `writeToken`; PUT/DELETE/rotate need `Authorization: Bearer`. A bad token and a missing canvas both return 404 (deliberately indistinguishable). PUT uses `If-Match: <rev>` optimistic concurrency → `REVISION_MOVED` on conflict.
- Every push renders first (`render.js`), then stores a new revision; `MAX_REVISIONS` prunes old ones. `versioned.js` resolves a `rev` and optional `base` (diff via `diff.js`), and builds versioned asset URLs (`/c/:id/r/:rev/b/:base/assets`).
- `errors.js` defines `ApiError` codes and the shared `errorHandler`; throw `ApiError` rather than writing responses by hand. All responses are `no-store` with `nosniff`; SVG and page CSPs live in `viewer.js`.

**Web viewer (`web/`, Preact + Tailwind v4 + shadcn/Radix)** — Vite root is `web/`, `base` is `/_app/`, output goes to `../public` with a manifest that `viewer.js` reads to inject script/CSS tags. `main.jsx` mounts either the canvas view (`data-canvas-id`) or the library `Home` (`data-page="home"`). Pure logic lives in `web/src/lib/` and is unit-tested in `web/test/`; there are no component tests.

## Notes

- `README.md` is a short how-to for editing `.pr-lens/graph.json` and pushing new canvas versions with `@coldtea/pr-lens-cli`; the title of the graph decides which canvas it belongs to.
- `server.prototype.js` is an untracked early prototype, not part of the app.
- `docs/superpowers/` is gitignored; do not commit it.
- Deploy: multi-stage `Dockerfile` (builds web, then `npm ci --omit=dev`, runs as `node`). Set `TRUST_PROXY` to a hop count when behind a reverse proxy so the mint rate limiter sees real client IPs.

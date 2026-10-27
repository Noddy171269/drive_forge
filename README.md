# Drive — a Google Drive–style cloud file storage platform

A backend-heavy MERN application: register, upload files, organize them into
nested folders, download/stream with HTTP Range, share with other users or via
expiring public links, manage a storage quota, and recover deleted files from
trash.

The engineering focus is the backend: **per-resource authorization**,
**access-checked downloads**, **concurrency-safe storage-quota accounting**,
**correct file streaming**, and **clean, centralized error handling**.

---

## 🚀 Live demo

| | URL |
|---|---|
| **App (Vercel)** | **https://drive-forge.vercel.app** |
| **API (Render)** | https://drive-forge-1drn.onrender.com |

**Demo login** (password `password123`): `alice@example.com` — or click **Use Alice**
on the login page.

> The backend runs on Render's free tier, which **sleeps after ~15 min idle**, so
> the first request may take 30–60s to wake. The free-tier filesystem is also
> **ephemeral**, so files uploaded in production are cleared on restart/redeploy
> (metadata persists) — production would use S3 (see [Future work](#future-work)).

---

## Table of contents
- [Architecture](#architecture)
- [Data models](#data-models)
- [API reference](#api-reference)
- [Security model](#security-model)
- [Local setup](#local-setup)
- [Demo accounts](#demo-accounts)
- [Deployment](#deployment)
- [Future work](#future-work)

---

## Architecture

```
            ┌────────────┐      HTTPS / JSON       ┌──────────────┐
  Browser → │  React +    │  ───────────────────▶  │   Express     │
            │  Vite (SPA) │  ◀───────────────────  │   REST API    │
            └────────────┘    JWT Bearer token     └──────┬───────┘
                                                           │
                                          ┌────────────────┴───────────────┐
                                          │                                │
                                    ┌─────▼──────┐                  ┌───────▼────────┐
                                    │  MongoDB    │                  │  Local disk     │
                                    │ (metadata)  │                  │ server/storage/ │
                                    │ users,      │                  │  <uuid> blobs   │
                                    │ folders,    │                  └────────────────┘
                                    │ files,shares│
                                    └────────────┘
```

**Why split metadata from bytes?** MongoDB documents are capped at **16 MB**, so
storing file contents in the database is a non-starter for a drive. Instead:

- **MongoDB stores only metadata and references** — the file's user-facing name,
  its `objectKey` (a server-generated UUID), size, MIME type, owner, parent
  folder, trashed flag, and version history.
- **Raw bytes live on local disk** under `server/storage/<objectKey>`. The
  on-disk filename is *only* the UUID; the user's filename is never used to
  build a path, which eliminates path-traversal attacks.
- **All disk I/O is isolated in [`server/src/utils/storage.js`](server/src/utils/storage.js)**
  (`moveIntoStorage`, `createReadStream`, `remove`, `stat`, `exists`,
  `writeBuffer`). Controllers never touch `fs` directly, so swapping local disk
  for S3 later means editing exactly one file.

Request flow for an upload: `multer` streams the upload to `storage/tmp/`, the
controller checks the quota, moves the bytes to `storage/<uuid>`, writes the
metadata document, and atomically increments `storageUsed`. Any failure after
the bytes are written triggers cleanup of the orphaned blob.

---

## Data models

**User**
| field | type | notes |
|---|---|---|
| email | String | required, unique, lowercase, validated |
| passwordHash | String | required, `select:false`, bcrypt |
| storageQuota | Number | default `1073741824` (1 GB) |
| storageUsed | Number | default `0`, `min 0` |

`pre('save')` hashes the password; `matchPassword(plain)` compares.

**Folder**
| field | type | notes |
|---|---|---|
| ownerId | ObjectId→User | required |
| parentId | ObjectId→Folder | `null` = root |
| name | String | required, trimmed |
| trashed | Boolean | default `false` |

Index: `{ ownerId, parentId, trashed }`.

**File**
| field | type | notes |
|---|---|---|
| ownerId | ObjectId→User | required |
| parentId | ObjectId→Folder | `null` = root |
| name | String | user-facing filename |
| objectKey | String | server UUID; on-disk name |
| size | Number | bytes |
| mimeType | String | |
| trashed | Boolean | default `false` |
| versions | `[{objectKey,size,createdAt}]` | previous versions |

Indexes: `{ ownerId, parentId, trashed }`, text index on `name`.

**Share**
| field | type | notes |
|---|---|---|
| resourceId | ObjectId | file or folder id |
| resourceType | enum `file`\|`folder` | required |
| ownerId | ObjectId→User | required |
| recipientId | ObjectId→User | set for user-to-user shares |
| token | String | set for public links (indexed) |
| role | enum `viewer`\|`editor` | default `viewer` |
| expiresAt | Date | `null` = never |
| revoked | Boolean | default `false` |

---

## API reference

All protected routes require an `Authorization: Bearer <jwt>` header.

### Auth
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/auth/register` | `{email,password}` | `201 {token,user}`; `409` email exists; `400` invalid/short password |
| POST | `/api/auth/login` | `{email,password}` | `200 {token,user}`; `401` bad creds |
| GET | `/api/auth/me` | — | `200 {user}` |

### Folders
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/folders` | `{name,parentId?}` | `201 {folder}`; `404/403` bad parent; `409` duplicate name |
| PATCH | `/api/folders/:id` | `{name?,parentId?}` | rename/move; `400` move into own descendant |
| DELETE | `/api/folders/:id` | — | soft-delete + cascade trash to descendants |
| POST | `/api/folders/:id/restore` | — | restore folder + descendants |

### Files, listing, upload, download
| Method | Path | Body / query | Result |
|---|---|---|---|
| GET | `/api/files` | `?parentId=<id\|root>&search=&page=&limit=` | `{folders,files,breadcrumb,page,pages,total}` |
| POST | `/api/files/upload` | multipart `file`, `parentId?` | `201 {file}`; `413` over quota; versions on name clash |
| GET | `/api/files/:id/download` | header or `?token=` / `?share=` | streams; `206` + `Content-Range` for Range requests |
| PATCH | `/api/files/:id` | `{name?,parentId?}` | rename/move |
| DELETE | `/api/files/:id` | — | soft-delete (quota not freed) |
| POST | `/api/files/:id/restore` | — | restore |

### Trash
| Method | Path | Query | Result |
|---|---|---|---|
| GET | `/api/trash` | — | `{files,folders}` trashed |
| DELETE | `/api/trash/:id` | `?type=file\|folder` | permanent delete; frees quota via `$inc`; folders cascade |

### Sharing
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/shares` | `{resourceId,resourceType,recipientEmail?,role?,expiresInHours?}` | `201 {share,url?}` |
| GET | `/api/shares/:token` | — | resolve public link; `404` not found; `410` revoked/expired |
| GET | `/api/shares/shared-with-me` | — | `{items}` shared with caller |
| GET | `/api/shares/mine` | — | `{shares}` created by caller |
| POST | `/api/shares/:id/revoke` | — | revoke (owner only) |

### Storage
| Method | Path | Result |
|---|---|---|
| GET | `/api/storage` | `{used,quota,percent}` |

---

## Security model

- **JWT auth.** `requireAuth` verifies the Bearer token, loads the user, and
  attaches `req.user`. Invalid/missing/expired → `401`.
- **Per-resource ownership.** Every file/folder route runs through
  [`loadOwned`](server/src/utils/asyncOwnership.js), which loads the resource and
  throws `404` if missing or `403` if `req.user` is not the owner. **`ownerId`
  is never accepted from the client** — it always comes from the authenticated
  token. One user can never read, rename, move, download, or delete another
  user's resources.
- **Random object keys.** `objectKey = crypto.randomUUID()`. The on-disk name is
  the UUID only; the user's filename is metadata and is never used to build a
  filesystem path, preventing path traversal. `storage.js` additionally rejects
  any key containing path separators or `..`.
- **Access-checked downloads.** `/api/files/:id/download` grants access only to
  the owner, a user with an active (non-revoked, non-expired) share, or a valid
  public share token. Public links honor both expiry and revocation on **every**
  request — the download endpoint re-validates the share, not just the landing
  page.
- **Concurrency-safe quota.** `storageUsed` is only ever changed with an atomic
  `findByIdAndUpdate(..., { $inc: { storageUsed: ±size } })` — never a
  read-modify-write — so concurrent uploads/deletes cannot corrupt the total.
  Quota is enforced on upload (`413` when exceeded, with temp-byte cleanup) and
  freed only on **permanent** delete.
- **Hardening.** `express-rate-limit` on `/api/auth`, CORS restricted to
  `CLIENT_URL`, `MAX_FILE_SIZE` enforced in multer, centralized error
  middleware returns `{ message }` with correct status codes and never leaks
  stack traces in production. `express-async-errors` ensures no unhandled
  promise rejections.

> **Note on the media token.** So that a browser `<video>`/`<img>` element can
> stream with HTTP Range (it cannot set an `Authorization` header), the download
> route also accepts the JWT via a `?token=` query param, or a public share via
> `?share=`. This is a deliberate project-scope tradeoff; production would issue
> short-lived signed URLs instead (see [Future work](#future-work)).

---

## Local setup

**Prerequisites:** Node.js 18+ and a MongoDB database (local install or a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
# 1. Server
cd server
cp .env.example .env          # then edit MONGO_URI + JWT_SECRET
npm install
npm run seed                  # optional: demo users, folders, files
npm run dev                   # http://localhost:5000

# 2. Client (in a second terminal)
cd client
cp .env.example .env          # leave VITE_API_URL blank for local dev (uses proxy)
npm install
npm run dev                   # http://localhost:5173
```

Or from the repo root: `npm run install:all`, then `npm run dev` (runs both with
`concurrently`).

**Server env vars** (`server/.env`): `PORT`, `MONGO_URI`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `CLIENT_URL`, `MAX_FILE_SIZE`.

---

## Demo accounts

After `npm run seed` (password for all: `password123`):

| email | notes |
|---|---|
| `alice@example.com` | nested folders, sample files, shares `Documents` with Bob |
| `bob@example.com` | has `Documents` shared with him by Alice |
| `carol@example.com` | empty account |

The Login page has one-click **Use Alice / Use Bob** buttons that fill the form.

---

## Deployment

**Backend — [Render](https://render.com) (Web Service):**
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `MONGO_URI` (Atlas), `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `CLIENT_URL` (your Vercel URL), `MAX_FILE_SIZE`, `NODE_ENV=production`.
- ⚠️ **The Render free-tier filesystem is ephemeral** — uploaded bytes in
  `server/storage/` are wiped on redeploy/restart. For real production you would
  store bytes in S3 (the storage layer is already isolated to make this a
  one-file change).

**Frontend — [Vercel](https://vercel.com):**
- Root directory: `client`
- Framework preset: Vite. Build: `npm run build`, output: `dist`.
- Environment variable: `VITE_API_URL` = your Render backend URL
  (e.g. `https://drive-api.onrender.com`).
- `client/vercel.json` provides the SPA rewrite so client-side routes resolve to
  `index.html`.

---

## Future work

- **S3 (or compatible) object storage** — swap `utils/storage.js` to stream
  bytes to/from S3; durable and horizontally scalable, and it removes the
  ephemeral-filesystem limitation.
- **Short-lived signed download URLs** — replace the `?token=`/`?share=` query
  auth on the media route with time-limited signed URLs.
- **Redis** — centralized caching (folder listings, share lookups) and
  distributed rate limiting across multiple API instances.
- **Resumable multipart uploads** — chunked uploads with resume for large files
  and flaky connections.
- **Background thumbnail generation** — a worker queue that renders image/video
  thumbnails after upload.
- **Full version-history UI** — browse, preview, download, and restore previous
  versions (the data model already stores them).
- **Activity / audit logs** — record who accessed, shared, or deleted what, for
  security review.

# FF-SHARING-COMMUNITY — Project Info

> **Share your Free Fire settings. Discover better sensitivity.**

A fast, lightweight, **mobile-first community web platform** for Free Fire gamers worldwide to share and discover game sensitivity and in-game settings — **no account or login required**.

---

## 🎯 Project Overview

| Field | Details |
|---|---|
| **Project Name** | FF-SHARING-COMMUNITY |
| **Version** | 1.1.0 |
| **License** | MIT |
| **Hosting** | Netlify |
| **Database** | NafijRahaman DB (NRDB) |
| **PWA** | ✅ Yes (Installable on Android & iOS) |
| **Live URL** | https://ff-sharing.netlify.app/ |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS3 (Custom Design System), Vanilla JavaScript ES6+ |
| **Backend** | Netlify Serverless Functions (Node.js) |
| **Database** | [NafijRahaman DB (NRDB)](https://db.nafij.me) — Serverless REST API |
| **PWA** | Web App Manifest + Service Worker (`sw.js`) |
| **Deployment** | Netlify (auto-detected via `netlify.toml`) |
| **Package Manager** | npm |

---

## 🎮 Key Features

- **🔓 No Account Required** — Instant posting and browsing with zero login, signup, or passwords.
- **🔢 Sequential Permanent Post IDs** — Every post gets a permanent URL (`/post/1`, `/post/2`, ...) that never recycles deleted IDs.
- **📋 1-Click Copy Settings** — Instant clipboard copy with animated visual confirmation (`Copied ✓`).
- **🔍 Real-Time Live Search** — Debounced search across usernames, settings text, sensitivity numbers, and post IDs.
- **❤️ Anti-Abuse Like System** — Community likes protected by browser fingerprinting, without requiring logins.
- **🖼️ Optional Screenshot Upload** — Client-side compressed image preview with full-screen zoom modal.
- **🎨 Dark & Light Gaming Theme** — Black + Ice White aesthetic with `localStorage` persistence.
- **⚡ Server-Side Rate Limiting** — Max 2 posts per minute per IP, enforced in serverless functions.
- **📱 Installable PWA** — Offline shell caching, instant install prompt, and service worker.
- **🛡️ Isolated Admin Dashboard** — Secure moderation console at `/admin`.
- **📄 Pagination** — Community feed displays 20 posts per page with dynamic pagination boxes.
- **🏷️ Quick Search / Preset Pills** — One-click search suggestions and settings presets (Headshot Pro, Sniper God, 100 Everything, Smooth 2GB/3GB).

---

## 📁 File Structure

```
ff-sharing-community/
│
├── index.html               # Homepage: Hero, Post Creator, Community Feed, Search, Pagination
├── post.html                # Standalone Post View (/post/:id)
├── admin.html               # Secure Admin Panel (/admin)
├── manifest.json            # PWA Web App Manifest
├── sw.js                    # Service Worker — offline caching & cache-first strategy
├── robots.txt               # Search engine crawl directives
├── netlify.toml             # Netlify build config, URL redirects & security headers
├── package.json             # Node.js dependencies & npm scripts
├── .env                     # Local environment variables (not committed)
├── .env.example             # Environment variable template
├── info.md                  # This file — full project reference
├── README.md                # Developer documentation
│
├── assets/
│   ├── favicon.svg          # Vector favicon / logo
│   ├── icon-192.png         # PWA app icon (192×192)
│   └── icon-512.png         # PWA app icon (512×512)
│
├── css/
│   └── style.css            # Full design system, themes, animations & components (~41KB)
│
├── js/
│   ├── config.js            # App config (API key, admin password, page limit, version)
│   ├── utils.js             # Core utilities: sanitization, fingerprinting, toast, image compression
│   ├── app.js               # Homepage & community feed controller (~34KB)
│   ├── post.js              # Standalone post viewer controller
│   └── admin.js             # Admin authentication & moderation controller
│
├── netlify/
│   └── functions/
│       ├── _nrdb.js             # NRDB connector, rate limiter, ID sequencer, in-memory fallback
│       ├── create-post.js       # POST — create a new settings post
│       ├── get-posts.js         # GET  — paginated feed & search
│       ├── get-post.js          # GET  — fetch single post by ID
│       ├── like-post.js         # POST — toggle like on a post
│       ├── admin-login.js       # POST — authenticate admin & issue token
│       ├── admin-delete-post.js # DELETE — remove a single post by ID
│       ├── admin-delete-user.js # DELETE — bulk remove all posts by username
│       └── admin-delete-all.js  # DELETE — purge ALL posts
│
└── scripts/                 # Dev & utility scripts (not deployed to Netlify)
    ├── dev-server.js            # Local development HTTP server
    ├── test-functions.js        # Serverless function integration tests
    ├── seed-community-posts.js  # Seed sample posts into NRDB
    ├── e2e-http-test.js         # End-to-end HTTP tests
    ├── generate-icons.js        # PWA icon generation utility
    ├── nrdb_docs_chunk.js       # NRDB API documentation reference
    ├── check-search.js          # Search inspection helper
    ├── debug-del.js             # Delete debug helper
    ├── inspect-all.js           # Full DB inspection script
    ├── inspect-docs-content.js  # Docs content inspector
    ├── inspect-nrdb.js          # NRDB state inspector
    ├── test-doc-id.js           # Document ID test
    ├── test-file-compatibility.js # File compat tests
    ├── test-old-delete.js       # Legacy delete test
    └── test-search-ui.js        # Search UI test
```

---

## ⚙️ Configuration

### Environment Variable

Only **one** environment variable is required:

```env
NRDB_API_KEY=your_nrdb_api_key_here
```

- Get your key from the [NRDB Dashboard](https://db.nafij.me/dashboard).
- Set it in Netlify under **Site Settings → Environment Variables**.
- For local dev, copy `.env.example` → `.env` and fill in the key.

> ⚠️ **Note:** `js/config.js` currently contains a hardcoded API key and admin password as development defaults. Review these before a production deploy.

### App Config (`js/config.js`)

| Setting | Value |
|---|---|
| `NRDB_BASE_URL` | `https://db.nafij.me/api/v1` |
| `PAGE_LIMIT` | `20` posts per page |
| `VERSION` | `1.1.0` |

---

## 🚀 Running Locally

### Option 1 — Netlify Dev (Recommended — supports serverless functions)
```bash
npm install
npx netlify dev
```
→ Open [http://localhost:8888](http://localhost:8888)

### Option 2 — Custom Dev Server
```bash
npm run dev
```

### Option 3 — Static Only (no serverless functions)
```bash
npx serve .
```

### Run Tests
```bash
npm test
```

---

## 🌐 Netlify Deployment

The `netlify.toml` is pre-configured:

| Setting | Value |
|---|---|
| Publish directory | `.` (root) |
| Functions directory | `netlify/functions` |
| `/post/:id` | → `/post.html?id=:id` (200 rewrite) |
| `/admin` | → `/admin.html` (200 rewrite) |

**Security headers applied to all routes (`/*`):**

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation — all disabled |

---

## 🛡️ Security Highlights

| Layer | Mechanism |
|---|---|
| **XSS Prevention** | All user content escaped via `escapeHTML()` before DOM insertion |
| **Rate Limiting** | Max 2 posts/minute per IP in `_nrdb.js` serverless layer |
| **Anti-Spam Likes** | Canvas fingerprinting + `localStorage` prevents duplicate likes/posts |
| **API Key Isolation** | NRDB credentials only exist inside serverless function runtimes |
| **Admin Auth** | Password-protected panel; page is `noindex, nofollow` |
| **Strict Headers** | Frame denial, XSS protection, content-type sniffing blocked via `netlify.toml` |

---

## 📱 PWA Details

| Feature | Value |
|---|---|
| Display mode | `standalone` (native app feel) |
| Theme / background color | `#07090e` (deep dark) |
| Orientation | `portrait-primary` |
| Offline support | Static shell cached via Service Worker |
| Install prompt | Browser-native + custom "Install" button in header |
| Icons | 192×192, 512×512 PNG + SVG favicon |
| Cache name | `ff-sharing-cache-v1.0.0` |
| Cached assets | All HTML pages, CSS, JS files, manifest, favicon |
| Categories | `games`, `utilities`, `entertainment` |

**Service Worker Strategy:**
- Static assets → Cache First
- Netlify Functions / API calls → Never cached (pass-through)
- Offline HTML fallback → Returns cached `index.html`

---

## 🔐 Admin Panel (`/admin`)

Accessed via `/admin` route (passkey required).

| Feature | Description |
|---|---|
| 📊 Live Stats | Total posts count + total community likes |
| 🔍 Search | Filter posts by ID (`#127`), username, or settings text |
| 🗑️ Delete Post | Delete any individual post by ID (confirmation modal) |
| 👤 Bulk Delete User | Remove all posts from a specific username |
| ☠️ Purge All | Delete every post — double-confirmation safety gate |
| 🔄 Refresh | Reload post list without a full page refresh |
| 🚪 Logout | Session logout button clears admin token |

---

## 🗄️ Database — Serverless API Endpoints

| File | Method | Endpoint | Purpose |
|---|---|---|---|
| `create-post.js` | POST | `/.netlify/functions/create-post` | Create new settings post |
| `get-posts.js` | GET | `/.netlify/functions/get-posts` | Paginated feed + search |
| `get-post.js` | GET | `/.netlify/functions/get-post` | Single post by ID |
| `like-post.js` | POST | `/.netlify/functions/like-post` | Toggle like on post |
| `admin-login.js` | POST | `/.netlify/functions/admin-login` | Authenticate admin |
| `admin-delete-post.js` | DELETE | `/.netlify/functions/admin-delete-post` | Delete one post |
| `admin-delete-user.js` | DELETE | `/.netlify/functions/admin-delete-user` | Delete all by username |
| `admin-delete-all.js` | DELETE | `/.netlify/functions/admin-delete-all` | Purge all posts |

**Local Fallback:** When no `NRDB_API_KEY` is configured, `_nrdb.js` automatically switches to an in-memory store pre-seeded with 3 sample posts (`HeadshotKing`, `ShadowNinja_FF`, `ProSniper99`).

---

## 🧰 Core Utility Functions (`js/utils.js`)

| Function | Purpose |
|---|---|
| `escapeHTML(str)` | Sanitizes all user input to prevent XSS attacks |
| `highlightSearchMatch(text, query)` | Wraps matched search terms in `<mark class="search-highlight">` |
| `getFingerprint()` | Canvas-based browser fingerprint for anti-abuse tracking |
| `showToast(msg, type, duration)` | Reusable animated toast notification system |
| *(Image compressor)* | Client-side JPEG/PNG/WEBP compression before upload |

---

## 📦 Dependencies

| Package | Version | Usage |
|---|---|---|
| `@nafijrahaman/db` | `^1.0.0` | Official NRDB Node.js SDK — used inside Netlify functions only |

> **Frontend is zero-dependency** — pure Vanilla HTML, CSS, and JavaScript.

---

## 🎨 Design System

| Token | Value / Purpose |
|---|---|
| Default theme | `data-theme="dark"` — Deep black gaming aesthetic |
| Light theme | Ice white / clean, toggled & saved in `localStorage` |
| Accent orange | `--accent-ff` (`#ff7700`) — Primary brand color |
| Accent ice | `--accent-ice` — Ice blue/white for feed elements |
| Accent rose | `--accent-rose` — Danger / delete actions |
| Accent emerald | `--accent-emerald` — Success / active status |
| Design file | `css/style.css` (~41KB) — all tokens, components, animations |

---

## 📜 npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm start` | `node scripts/dev-server.js` | Start local dev server |
| `npm run dev` | `node scripts/dev-server.js` | Alias for start |
| `npm run dev:netlify` | `npx netlify dev` | Full Netlify dev environment |
| `npm test` | `node scripts/test-functions.js` | Run function integration tests |

---

*Generated from full project source inspection — September 2026*

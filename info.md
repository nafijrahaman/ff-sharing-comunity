# FF-SHARING-COMMUNITY — Project Info

> **Share your Free Fire settings. Discover better sensitivity.**

A fast, lightweight, **mobile-first community web platform** for Free Fire gamers worldwide to share and discover game sensitivity and in-game settings — **no account or login required**.

---

## 🎯 Project Overview

| Field | Details |
|---|---|
| **Project Name** | FF-SHARING-COMMUNITY |
| **Version** | 2.0.0 |
| **License** | MIT |
| **Hosting** | Vercel / Netlify / Node.js |
| **Database** | MongoDB Atlas & GridFS |
| **PWA** | ✅ Yes (Installable on Android & iOS) |
| **Live URL** | https://ff-sharing.netlify.app/ |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS3 (Custom Design System), Vanilla JavaScript ES6+ |
| **Backend APIs** | Node.js Serverless Functions (`/api/*`) |
| **Database** | MongoDB Atlas (Connection pooling, indexing, atomic counters) |
| **Storage** | MongoDB GridFS (`screenshots` bucket) |
| **PWA** | Web App Manifest + Service Worker (`sw.js`) |
| **Deployment** | Vercel / Netlify / Node.js Dev Server |
| **Package Manager** | npm |

---

## 🎮 Key Features

- **🔓 No Account Required** — Instant posting and browsing with zero login, signup, or passwords.
- **🔢 Sequential Permanent Post IDs** — Every post gets a permanent URL (`/post/1`, `/post/2`, ...) that never recycles deleted IDs.
- **📋 1-Click Copy Settings** — Instant clipboard copy with animated visual confirmation (`Copied ✓`).
- **🔍 Real-Time Live Search** — Debounced search across usernames, settings text, sensitivity numbers, and post IDs.
- **❤️ Anti-Abuse Like System** — Community likes protected by browser fingerprinting, without requiring logins.
- **🖼️ Instant Background Screenshot Upload** — Direct upload to MongoDB GridFS, returning permanent stream URL (`/api/image?id=...`).
- **🎨 Dark & Light Gaming Theme** — Black + Ice White aesthetic with `localStorage` persistence.
- **⚡ Server-Side Rate Limiting** — Max 2 posts per minute per IP, enforced in serverless functions.
- **📱 Installable PWA** — Offline shell caching, instant install prompt, and service worker.
- **🛡️ Full Admin Moderation Console** — Secure moderation console at `/admin` with single delete, multi-select bulk delete, and user purge.
- **📄 Pagination & Infinite Scroll** — Community feed displays 20 posts per page with smooth IntersectionObserver prefetch.
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
├── vercel.json              # Vercel deployment and route rewrites
├── netlify.toml             # Netlify build config, URL redirects & security headers
├── package.json             # Node.js dependencies (mongodb)
├── .env                     # Local environment variables
├── .env.example             # Environment variable template
├── info.md                  # Project reference
├── README.md                # Developer documentation
│
├── api/                     # Unified Production API Layer
│   ├── _db.js               # MongoDB connection pooling, indexing, GridFS provider
│   ├── _auth.js             # HMAC-SHA256 admin token verification
│   ├── get-posts.js         # Fast feed retrieval with lean projections & pagination
│   ├── get-post.js          # Single post lookup by ID
│   ├── create-post.js       # Atomic post creation & sequence counter
│   ├── like-post.js         # Like counter with fingerprint deduplication
│   ├── upload.js            # Screenshot upload storing into GridFS
│   ├── image.js             # GridFS screenshot streaming with immutable caching
│   ├── admin-login.js       # Admin authentication & token generator
│   ├── admin-users.js       # Registered users list & statistics
│   ├── admin-delete-post.js # Single & bulk post deletion
│   ├── admin-delete-user.js # User & posts cascade deletion
│   └── admin-delete-all.js  # Full database reset
│
├── assets/
│   ├── favicon.svg          # Vector favicon / logo
│   ├── icon-192.png         # PWA app icon (192×192)
│   └── icon-512.png         # PWA app icon (512×512)
│
├── css/
│   └── style.css            # Full design system, themes, animations & components
│
├── js/
│   ├── config.js            # App configuration
│   ├── utils.js             # Core utilities: sanitization, fingerprinting, toast, apiCall
│   ├── app.js               # Homepage & community feed controller
│   ├── post.js              # Standalone post viewer controller
│   └── admin.js             # Admin authentication & moderation controller
│
└── scripts/
    ├── dev-server.js        # Local development HTTP server (emulates /api/)
    └── seed-community-posts.js # Seeding script for MongoDB Atlas
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=ff_sharing
ADMIN_PASSWORD=your_admin_password
PORT=3000
```

---

## 📦 Dependencies

| Package | Version | Usage |
|---|---|---|
| `mongodb` | `^6.13.1` | Official MongoDB Node.js Driver |

Frontend is zero-dependency — pure Vanilla HTML, CSS, and JavaScript.

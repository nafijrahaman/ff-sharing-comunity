# FF-SHARING-COMMUNITY

> **Share your Free Fire settings. Discover better sensitivity.**

**FF-SHARING-COMMUNITY** is a fast, lightweight, mobile-first community web platform designed for Free Fire gamers worldwide to share and discover game sensitivity and settings without requiring any account or login.

Built with **pure HTML5, CSS3, Vanilla JavaScript, Netlify Functions**, and powered by **NafijRahaman DB (NRDB)**.

---

## 🎮 Key Features

- **No Account Required**: Instant posting and browsing. Zero login, signup, or passwords needed for community users.
- **Sequential Permanent Post IDs**: Every post is assigned a sequential URL (`/post/1`, `/post/2`, `/post/100`, ...) that continues indefinitely and never recycles deleted IDs.
- **Copy Settings with 1-Click**: Instant clipboard copying of settings text with animated visual confirmation (`Copied ✓`).
- **Real-Time Live Search**: Debounced search across usernames, settings keywords, sensitivity numbers, and post IDs.
- **Anti-Abuse Like System**: Community like counter protected by browser-level anti-spam mechanisms without requiring user logins.
- **Optional Screenshot Upload**: Client-side compressed screenshot preview with full-screen zoom modal.
- **Black + Ice White Gaming Aesthetic**: Custom-crafted dark & light themes inspired by modern mobile gaming interfaces with persistent `localStorage` memory.
- **Server-Side Rate Limiting**: Strict rate limiting (max 2 posts per minute per IP) enforced in the serverless backend.
- **Installable PWA**: Progressive Web App with offline shell caching, instant install prompt, and service worker.
- **Isolated Admin Dashboard**: Secure administrative console (`/admin`) for moderating posts, deleting single posts, purging by username, or performing full resets.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System), Vanilla JavaScript (ES6+)
- **Backend**: Netlify Serverless Functions (Node.js)
- **Database**: [NafijRahaman DB (NRDB)](https://db.nafij.me) — Serverless Collection & Quick Storage API
- **PWA**: Web App Manifest, Service Worker (`sw.js`)
- **Hosting / Deployment**: Netlify

---

## 📁 Project Structure

```
ff-sharing-community/
├── index.html                  # Homepage (Hero, Post Creator, Community Feed, Search)
├── post.html                   # Standalone Post View (/post/:id)
├── admin.html                  # Secure Admin Panel
├── manifest.json               # PWA Web App Manifest
├── sw.js                       # Service Worker for PWA & Offline Cache
├── robots.txt                  # Search Engine Directives
├── netlify.toml                # Netlify Build, Routing & Security Headers
├── package.json                # Dependencies (@nafijrahaman/db)
├── .env.example                # Environment Variable Template
├── README.md                   # Documentation
├── assets/
│   ├── favicon.svg             # Vector Favicon & Logo
│   ├── icon-192.png            # PWA App Icon (192x192)
│   └── icon-512.png            # PWA App Icon (512x512)
├── css/
│   └── style.css               # Design System, Themes, Animations & Components
├── js/
│   ├── utils.js                # Core Utilities (Toast, Fingerprint, Copy, Image Compress)
│   ├── app.js                  # Homepage & Community Feed Controller
│   ├── post.js                 # Standalone Post Viewer Controller
│   └── admin.js                # Admin Authentication & Moderation Controller
└── netlify/
    └── functions/
        ├── _nrdb.js            # NRDB Connector, Rate Limiter & ID Sequencer
        ├── create-post.js      # Post Creation Endpoint
        ├── get-posts.js        # Feed & Search Endpoint
        ├── get-post.js         # Single Post Lookup Endpoint
        ├── like-post.js        # Post Like Action Endpoint
        ├── admin-login.js      # Admin Authentication & Token Generation
        ├── admin-delete-post.js# Delete Individual Post Endpoint
        ├── admin-delete-user.js# Bulk Delete by Username Endpoint
        └── admin-delete-all.js # Purge All Posts Endpoint
```

---

## ⚡ Environment Variable Setup

Only **ONE** environment variable is required:

```env
NRDB_API_KEY=your_nrdb_api_key_here
```

### How to get your NRDB API Key:
1. Visit the [NafijRahaman DB Dashboard](https://db.nafij.me/dashboard).
2. Create or select your database project.
3. Copy your project API key (format: `nrdb_live_xxxxxxxx...`).
4. Set `NRDB_API_KEY` in your environment.

> [!IMPORTANT]
> The API key is used exclusively on the server side inside Netlify Functions and is never exposed in client HTML or JavaScript. If no API key is provided during local testing, the application gracefully uses an in-memory fallback store.

---

## 🚀 Local Development

### Option 1: Using Netlify CLI (Recommended)
```bash
# 1. Install dependencies
npm install

# 2. Run with Netlify Dev (supports serverless functions and redirects)
npx netlify dev
```
Open [http://localhost:8888](http://localhost:8888) in your browser.

### Option 2: Static Server
```bash
npx serve .
```

---

## 🌐 Netlify Deployment Guide

1. Push your repository to **GitHub / GitLab / Bitbucket**.
2. Log in to [Netlify](https://app.netlify.com/) and click **"Add new site" > "Import an existing project"**.
3. Select your repository.
4. Netlify will automatically detect the settings from `netlify.toml`:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
5. Under **Environment variables**, add:
   - Key: `NRDB_API_KEY`
   - Value: `<Your NRDB API Key>`
6. Click **Deploy Site**.

Your FF-SHARING-COMMUNITY platform is live!

---

## 🔐 Admin Panel Guide

- Access the admin panel at `/admin`.
- Enter your admin passkey to access the control center.
- **Admin Capabilities**:
  - View real-time statistics (Total Posts, Total Likes).
  - Search posts by ID, username, or sensitivity content.
  - Delete individual posts with confirmation.
  - Bulk delete all posts created by a specific username.
  - Purge all community posts with double-confirmation safety checks.

---

## 🛡️ Security Highlights

- **Complete HTML Sanitization & Escaping**: All user-submitted content is sanitized and escaped to eliminate XSS risks.
- **Server-Side IP Rate Limiting**: Max 2 posts per minute per IP address.
- **Client Anti-Spam Protections**: Fingerprint hashing and local tracking for likes and posts.
- **Zero API Key Leakage**: Database credentials remain strictly confined to serverless function runtimes.
- **Strict Headers**: Strict Content-Type, X-Frame-Options, and XSS-Protection configured in `netlify.toml`.

---

## 📱 PWA & Mobile Experience

- **Full Offline Shell**: Cached HTML, CSS, JS, and graphics via Service Worker.
- **Responsive Layout**: Fluidly scaled across all screen sizes (320px to 1920px+).
- **Standalone App**: Can be installed to Android/iOS home screens with native-like appearance.

---

## 📄 License

Open source under the [MIT License](LICENSE). Built for the Free Fire gaming community.

# FF-SHARING-COMMUNITY

> **Share your Free Fire settings. Discover better sensitivity.**

**FF-SHARING-COMMUNITY** is a fast, lightweight, mobile-first community web platform designed for Free Fire gamers worldwide to share and discover game sensitivity and settings without requiring any account or login.

Built with **HTML5, CSS3, Vanilla JavaScript, Node.js API Functions**, and powered by **MongoDB Atlas & GridFS**.

---

## 🎮 Key Features

- **No Account Required**: Instant posting and browsing. Zero login, signup, or passwords needed for community users.
- **Sequential Permanent Post IDs**: Every post is assigned a sequential URL (`/post/1`, `/post/2`, `/post/100`, ...) that continues indefinitely and never recycles deleted IDs.
- **Copy Settings with 1-Click**: Instant clipboard copying of settings text with animated visual confirmation (`Copied ✓`).
- **Real-Time Live Search**: Debounced search across usernames, settings keywords, sensitivity numbers, and post IDs.
- **Anti-Abuse Like System**: Community like counter protected by browser-level anti-spam mechanisms without requiring user logins.
- **Instant Screenshot Upload**: Background image upload storing files in MongoDB GridFS with permanent URL streaming (`/api/image?id=...`), eliminating base64 document bloat.
- **Black + Ice White Gaming Aesthetic**: Custom-crafted dark & light themes inspired by modern mobile gaming interfaces with persistent `localStorage` memory.
- **Installable PWA**: Progressive Web App with offline shell caching, instant install prompt, and service worker.
- **Full Admin Moderation Console**: Secure administrative dashboard (`/admin`) for single post deletion, bulk delete with selection checkboxes, author-level moderation, and full database resets.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System), Vanilla JavaScript (ES6+)
- **Backend APIs**: Node.js serverless functions (`/api/*`) compatible with Vercel & Netlify
- **Database & Storage**: MongoDB Atlas (Collection pooling, atomic counters, GridFS buckets)
- **PWA**: Web App Manifest, Service Worker (`sw.js`)
- **Hosting / Deployment**: Vercel / Netlify / Node.js

---

## 📁 Project Structure

```
ff-sharing-community/
├── index.html                  # Homepage (Hero, Post Creator, Community Feed, Search)
├── post.html                   # Standalone Post View (/post/:id)
├── admin.html                  # Secure Admin Panel with User & Post Moderation
├── manifest.json               # PWA Web App Manifest
├── sw.js                       # Service Worker for PWA & Offline Cache
├── vercel.json                 # Vercel Deployment & Route Rewrites
├── netlify.toml                # Netlify Build, Routing & Security Headers
├── package.json                # Dependencies (mongodb)
├── .env.example                # Environment Variable Template
├── README.md                   # Documentation
├── api/                        # Production API Handlers
│   ├── _db.js                  # Centralized MongoDB connection pooling & GridFS bucket
│   ├── _auth.js                # HMAC-SHA256 Cryptographic Admin Authentication
│   ├── get-posts.js            # Feed Retrieval, Search, Aggregation & Pagination
│   ├── get-post.js             # Standalone Post Lookup
│   ├── create-post.js          # Post Creation & Atomic Sequential ID Generation
│   ├── like-post.js            # Like Counter with Fingerprint Deduplication
│   ├── upload.js               # Screenshot Upload to MongoDB GridFS
│   ├── image.js                # High-Performance GridFS Image Streaming
│   ├── admin-login.js          # Admin Passkey Verification & Token Generator
│   ├── admin-users.js          # Users Moderation List & Statistics
│   ├── admin-delete-post.js    # Single & Bulk Post Deletion Endpoint
│   ├── admin-delete-user.js    # User & Posts Cascade Deletion Endpoint
│   └── admin-delete-all.js     # Full Database Reset Endpoint
├── css/
│   └── style.css               # Design System, Themes, Animations & Components
├── js/
│   ├── utils.js                # Core Utilities (Toast, Fingerprint, Copy, apiCall)
│   ├── app.js                  # Homepage & Community Feed Controller
│   ├── post.js                 # Standalone Post Viewer Controller
│   └── admin.js                # Admin Dashboard Controller
└── scripts/
    ├── dev-server.js           # Local Development Server (Emulates /api/ routes)
    └── seed-community-posts.js # Seeding Script for MongoDB Atlas
```

---

## ⚡ Environment Variables Setup

Create a `.env` file in the root directory:

```env
# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=ff_sharing

# Admin Passkey for Moderation Dashboard
ADMIN_PASSWORD=your_secure_password_here

# Local Server Port (optional, default 3000)
PORT=3000
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Seed initial posts into MongoDB Atlas (optional)
node scripts/seed-community-posts.js

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Admin Panel Guide

- Access the admin panel at `/admin`.
- Enter your admin passkey configured in `ADMIN_PASSWORD`.
- **Admin Capabilities**:
  - View real-time statistics (Total Posts, Total Likes, Registered Authors).
  - Search posts by ID (#127), username, title, or settings content.
  - Delete individual posts with confirmation and duplicate-click protection.
  - Multi-select posts with checkboxes for one-click bulk deletion.
  - Delete any user along with all their shared posts in one atomic operation.
  - Purge all community posts with double-confirmation safety checks.

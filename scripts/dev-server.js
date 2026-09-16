/**
 * Development Server — Emulates Vercel /api/ routes locally
 *
 * Runs the same serverless functions that Vercel executes in production.
 * Serves static files from the project root.
 * Emulates Vercel rewrite rules from vercel.json.
 *
 * DEP0169 FIX: replaced legacy url.parse() with the WHATWG URL API (new URL()).
 * The WHATWG URL API has been stable since Node.js 10 and is the modern standard.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
// NOTE: 'url' module is NOT imported — we use the built-in WHATWG URL API (global `URL`) instead.

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// Set NODE_ENV for production-like behavior
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT_DIR = path.join(__dirname, '..');

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

// ── Load Vercel /api/ functions (same handlers used in production) ─────────
// This means local dev tests the exact same code path as Vercel.
const API_HANDLERS = {};
const apiDir = path.join(__dirname, '..', 'api');
for (const name of [
  'get-posts', 'get-post', 'create-post', 'like-post',
  'admin-login', 'admin-delete-post', 'admin-delete-user', 'admin-delete-all'
]) {
  const handlerPath = path.join(apiDir, `${name}.js`);
  if (fs.existsSync(handlerPath)) {
    try {
      API_HANDLERS[name] = require(handlerPath);
      console.log(`  ✓ Loaded /api/${name}`);
    } catch (err) {
      console.warn(`  ✗ Failed to load /api/${name}:`, err.message);
    }
  } else {
    console.warn(`  ✗ Missing: api/${name}.js`);
  }
}

// ── Vercel-style request/response shim ────────────────────────────────────
// Converts Node.js IncomingMessage/ServerResponse into the Vercel req/res shape
// that our /api/*.js handlers expect (Express-like interface).
function makeVercelReqRes(req, query, body, rawRes) {
  const vercelReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query,
    body
  };

  let statusCode = 200;
  const responseHeaders = {};

  const vercelRes = {
    statusCode,
    status(code) {
      statusCode = code;
      vercelRes.statusCode = code;
      return vercelRes;
    },
    setHeader(k, v) {
      responseHeaders[k] = v;
      return vercelRes;
    },
    json(data) {
      const body = JSON.stringify(data);
      rawRes.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...responseHeaders
      });
      rawRes.end(body);
    },
    end(data) {
      rawRes.writeHead(statusCode, responseHeaders);
      rawRes.end(data);
    }
  };

  return { vercelReq, vercelRes };
}

// ── Read request body ───────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) { resolve(null); return; }
      try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); }
    });
    req.on('error', () => resolve(null));
  });
}

// ── Main request handler ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // WHATWG URL API — replacement for the deprecated url.parse()
  // `req.url` is always a path+query string (no protocol/host), so we
  // provide a dummy base so `new URL()` can parse it correctly.
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsed.pathname;

  // Convert URLSearchParams to a plain object (equivalent to url.parse query)
  const query = Object.fromEntries(parsed.searchParams.entries());

  // ── CORS preflight ────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // ── 1. /api/:name — Vercel serverless functions ───────────────────────
  if (pathname.startsWith('/api/')) {
    const name = pathname.replace('/api/', '').split('/')[0];
    const handler = API_HANDLERS[name];

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: `API route /api/${name} not found` }));
      return;
    }

    const body = await readBody(req);
    const { vercelReq, vercelRes } = makeVercelReqRes(req, query, body, res);

    try {
      await handler(vercelReq, vercelRes);
    } catch (err) {
      console.error(`[/api/${name}] Unhandled error:`, err.message);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    }
    return;
  }

  // ── 2. Legacy: /.netlify/functions/:name (keep for backward compat) ───
  if (pathname.startsWith('/.netlify/functions/')) {
    // Redirect to the canonical /api/ equivalent
    const name = pathname.replace('/.netlify/functions/', '');
    const redirectTo = `/api/${name}${parsed.search}`;
    res.writeHead(307, { Location: redirectTo });
    res.end();
    return;
  }

  // ── 3. Vercel rewrite rules (from vercel.json) ────────────────────────
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin.html';
  } else if (pathname.startsWith('/post/')) {
    pathname = '/post.html';
  } else if (pathname === '/') {
    pathname = '/index.html';
  }

  // ── 4. Static file serving ────────────────────────────────────────────
  const filePath = path.join(ROOT_DIR, pathname);
  // Security: prevent path traversal outside ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR + path.sep) && filePath !== ROOT_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Kill the existing process or set PORT=<other> in .env\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`   NODE_ENV  : ${process.env.NODE_ENV}`);
  console.log(`   MONGODB   : ${process.env.MONGODB_URI ? '✓ configured' : '⚠ MONGODB_URI not set (using local cache fallback)'}`);
  console.log(`\n   API routes available at http://localhost:${PORT}/api/`);
  console.log(`   Static files served from: ${ROOT_DIR}`);
  console.log(`\n   DEP0169: FIXED — url.parse() replaced with WHATWG URL API\n`);
});

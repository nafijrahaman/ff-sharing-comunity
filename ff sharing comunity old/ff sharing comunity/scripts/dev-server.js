/**
 * Development Server with Netlify Functions & Redirect Emulation
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...val] = trimmed.split('=');
      const k = key.trim();
      const v = val.join('=').trim().replace(/^["'](.*)["']$/, '$1');
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain'
};

const functions = {
  'create-post': require('../netlify/functions/create-post').handler,
  'get-posts': require('../netlify/functions/get-posts').handler,
  'get-post': require('../netlify/functions/get-post').handler,
  'like-post': require('../netlify/functions/like-post').handler,
  'admin-login': require('../netlify/functions/admin-login').handler,
  'admin-delete-post': require('../netlify/functions/admin-delete-post').handler,
  'admin-delete-user': require('../netlify/functions/admin-delete-user').handler,
  'admin-delete-all': require('../netlify/functions/admin-delete-all').handler
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 1. Emulate Netlify Functions at /.netlify/functions/:name
  if (pathname.startsWith('/.netlify/functions/')) {
    const functionName = pathname.replace('/.netlify/functions/', '');
    const handler = functions[functionName];

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Function not found' }));
      return;
    }

    // Read body
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const event = {
          httpMethod: req.method,
          path: pathname,
          queryStringParameters: parsedUrl.query,
          headers: req.headers,
          body: body
        };

        const result = await handler(event, {});
        res.writeHead(result.statusCode, result.headers || {});
        res.end(result.body);
      } catch (err) {
        console.error(`Function ${functionName} error:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Route rewrites as in netlify.toml
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin.html';
  } else if (pathname.startsWith('/post/')) {
    pathname = '/post.html';
  } else if (pathname === '/') {
    pathname = '/index.html';
  }

  // 3. Serve Static Files
  const filePath = path.join(ROOT_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
});

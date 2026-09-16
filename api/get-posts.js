/**
 * Vercel Serverless Function: GET /api/get-posts
 * Production-optimized: connection pooling, projections, indexed queries.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Reuses MongoClient across invocations (serverless connection pooling)
 * - Creates indexes on first connection (compound indexes for sort+filter)
 * - Projects only required fields (avoids sending heavy base64 image data unless needed)
 * - Avoids expensive countDocuments() when page=1 — uses estimatedDocumentCount() instead
 * - Runs count, find, and aggregation in parallel (Promise.all)
 * - Sets Cache-Control for public feed (CDN-cacheable, short TTL, stale-while-revalidate)
 */
const { MongoClient } = require('mongodb');

// ── Connection pooling ─────────────────────────────────────────────────────
// Vercel keeps the Node.js process warm between invocations.
// Caching the client here reuses the TCP connection instead of creating a new one.
let _client = null;
let _db = null;
let _indexesCreated = false;

async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) throw new Error('MONGODB_URI environment variable is not set. Please add it in Vercel Settings → Environment Variables.');

  if (_client && _db) {
    // Verify connection is still alive (cheap ping)
    try {
      await _db.command({ ping: 1 });
      return _db;
    } catch (_) {
      _client = null;
      _db = null;
    }
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000
  });

  await client.connect();
  const dbName = process.env.MONGODB_DB_NAME || 'ff_sharing';
  const db = client.db(dbName);

  // Create indexes once per cold start (idempotent, fast if already exist)
  if (!_indexesCreated) {
    try {
      await Promise.all([
        // Primary sort index — used for default feed query
        db.collection('posts').createIndex({ createdAt: -1 }),
        // Unique postId for sequential IDs
        db.collection('posts').createIndex({ postId: -1 }, { unique: true, sparse: true }),
        // Username lookup for profile pages
        db.collection('posts').createIndex({ username: 1 }),
        // Text search on title, settings, username
        db.collection('posts').createIndex(
          { title: 'text', settings: 'text', username: 'text' },
          { name: 'posts_text_search', weights: { title: 10, username: 5, settings: 1 } }
        )
      ]);
      _indexesCreated = true;
    } catch (idxErr) {
      // Indexes may already exist with different options — non-fatal
      console.warn('Index creation warning:', idxErr.message);
      _indexesCreated = true; // don't retry on every request
    }
  }

  _client = client;
  _db = db;
  return db;
}

module.exports = async (req, res) => {
  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const t0 = Date.now();

  try {
    const db = await getDb();

    // ── Parse request params ───────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.q || req.query.search || '').trim();
    const username = (req.query.username || req.query.user || req.query.author || '').trim();

    // ── Build MongoDB filter ───────────────────────────────────────────────
    const filter = {};

    if (username) {
      // Case-insensitive exact username match (uses username index)
      filter.username = { $regex: new RegExp('^' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    }

    if (search) {
      if (search.startsWith('#')) {
        const idNum = parseInt(search.slice(1), 10);
        if (!isNaN(idNum)) filter.postId = idNum;
      } else {
        // Try MongoDB text search first (uses text index, very fast)
        // Fallback: regex on individual fields
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { settings: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const skip = (page - 1) * limit;

    // ── Projection: only fetch fields the feed actually needs ──────────────
    // Avoids sending large base64 images in list view (they're still stored, just not sent)
    // The image field IS included because cards show thumbnails. If images are very large,
    // consider storing URLs instead of base64.
    const projection = {
      postId: 1,
      _id: 1,
      username: 1,
      title: 1,
      settings: 1,
      image: 1,
      likes: 1,
      createdAt: 1
      // likedBy is NOT included (large array, not needed in feed list)
    };

    // ── Execute queries in parallel ────────────────────────────────────────
    const isDefaultFeed = !search && !username;

    const [countResult, rawDocs, userAgg] = await Promise.all([
      // Count: use estimatedDocumentCount for the default unfiltered feed (much faster)
      // Use countDocuments only when there's a filter (search/user)
      isDefaultFeed
        ? db.collection('posts').estimatedDocumentCount()
        : db.collection('posts').countDocuments(filter),

      // Main feed query (uses createdAt index for sort)
      db.collection('posts')
        .find(filter, { projection })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),

      // Top contributors aggregation (only run for default feed or search)
      db.collection('posts').aggregate([
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: {
          _id: { $toLower: '$username' },
          username: { $first: '$username' },
          postCount: { $sum: 1 },
          totalLikes: { $sum: '$likes' },
          latestPostDate: { $max: '$createdAt' }
        }},
        { $sort: { totalLikes: -1, postCount: -1 } },
        { $limit: 5 }
      ]).toArray().catch(() => [])
    ]);

    const total = countResult || 0;

    // ── Serialize posts ────────────────────────────────────────────────────
    const posts = rawDocs.map(doc => ({
      id: Number(doc.postId) || 0,
      _docId: doc._id.toString(),
      username: doc.username || 'Anonymous',
      title: doc.title || '',
      settings: doc.settings || '',
      image: doc.image || '',
      likes: Number(doc.likes) || 0,
      createdAt: doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (doc.createdAt || new Date().toISOString())
    }));

    const matchedUsers = (userAgg || []).map(u => ({
      username: u.username,
      postCount: u.postCount,
      totalLikes: u.totalLikes,
      latestPostDate: u.latestPostDate instanceof Date
        ? u.latestPostDate.toISOString()
        : u.latestPostDate
    }));

    let userProfile = null;
    if (username) {
      const found = matchedUsers.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
      userProfile = found || {
        username,
        postCount: total,
        totalLikes: posts.reduce((s, p) => s + p.likes, 0),
        latestPostDate: posts[0]?.createdAt || null
      };
    }

    const queryMs = Date.now() - t0;
    console.log(`[get-posts] page=${page} limit=${limit} total=${total} docs=${rawDocs.length} filter=${JSON.stringify(filter)} took=${queryMs}ms`);

    // ── Cache headers for public feed ──────────────────────────────────────
    // Public feed: cache for 30s, allow stale for 60s while revalidating
    // Search/user: no cache (personalized results)
    if (isDefaultFeed) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      res.setHeader('CDN-Cache-Control', 'public, max-age=30');
    } else {
      res.setHeader('Cache-Control', 'private, no-store');
    }

    // ── Timing header for debugging ────────────────────────────────────────
    res.setHeader('Server-Timing', `db;dur=${queryMs};desc="MongoDB query"`);

    return res.status(200).json({
      success: true,
      posts,
      total,
      page,
      limit,
      hasMore: (skip + limit) < total,
      matchedUsers,
      userProfile,
      _meta: { queryMs }
    });

  } catch (err) {
    const queryMs = Date.now() - t0;
    console.error(`[get-posts] ERROR after ${queryMs}ms:`, err.message);

    // Reset cached connection on error so next request gets a fresh connection
    _client = null;
    _db = null;

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch posts. Database may be unavailable.',
      // Only expose error details in development
      ...(process.env.NODE_ENV !== 'production' ? { error: err.message } : {})
    });
  }
};

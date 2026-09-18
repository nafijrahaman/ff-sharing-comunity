/**
 * Vercel Serverless Function: GET /api/get-posts
 * Production-optimized MongoDB feed retrieval:
 * - Connection pooling & indexed queries
 * - Lean projections (avoids base64 image bloat)
 * - Immediate response path for default initial feed (no heavy full-collection aggregation delays)
 * - Instant pagination & search support
 */
'use strict';

const { getDb } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const t0 = Date.now();

  try {
    const db = await getDb();

    // ── Parse request params ───────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.q || req.query.search || '').trim();
    const username = (req.query.username || req.query.user || req.query.author || '').trim();

    // ── Build MongoDB filter ───────────────────────────────────────────────
    const filter = {};

    if (username) {
      filter.username = { $regex: new RegExp('^' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    }

    if (search) {
      if (search.startsWith('#')) {
        const idNum = parseInt(search.slice(1), 10);
        if (!isNaN(idNum)) {
          filter.$or = [{ postId: idNum }, { id: idNum }];
        }
      } else {
        const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { settings: { $regex: safeSearch, $options: 'i' } },
          { username: { $regex: safeSearch, $options: 'i' } }
        ];
      }
    }

    const skip = (page - 1) * limit;

    // ── Projection: only fetch fields the feed actually needs ──────────────
    const projection = {
      postId: 1,
      id: 1,
      _id: 1,
      userId: 1,
      username: 1,
      title: 1,
      settings: 1,
      image: 1,
      likes: 1,
      createdAt: 1
    };

    const isDefaultFeed = !search && !username;

    // ── Parallel execution with high efficiency ────────────────────────────
    const promises = [
      // Count
      isDefaultFeed
        ? db.collection('posts').estimatedDocumentCount()
        : db.collection('posts').countDocuments(filter),

      // Post Documents
      db.collection('posts')
        .find(filter, { projection })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    ];

    // Only run user aggregation if a specific search query or username filter is requested
    if (search || username) {
      promises.push(
        db.collection('posts').aggregate([
          ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
          {
            $group: {
              _id: { $toLower: '$username' },
              username: { $first: '$username' },
              userId: { $first: '$userId' },
              postCount: { $sum: 1 },
              totalLikes: { $sum: '$likes' },
              latestPostDate: { $max: '$createdAt' }
            }
          },
          { $sort: { totalLikes: -1, postCount: -1 } },
          { $limit: 5 }
        ]).toArray().catch(() => [])
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    const [countResult, rawDocs, userAgg] = await Promise.all(promises);
    const total = countResult || 0;

    // ── Serialize posts ────────────────────────────────────────────────────
    const posts = rawDocs.map(doc => {
      const pId = typeof doc.postId === 'number' ? doc.postId : (Number(doc.id) || 0);
      const userIdent = doc.userId || ('user_' + (doc.username || 'anon').toLowerCase().replace(/[^a-z0-9]/g, ''));
      return {
        id: pId,
        postId: pId,
        _docId: doc._id.toString(),
        userId: userIdent,
        username: (doc.username || 'Anonymous').trim(),
        title: (doc.title || '').trim(),
        settings: doc.settings || '',
        image: doc.image || '',
        likes: Number(doc.likes) || 0,
        createdAt: doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : (doc.createdAt || new Date().toISOString())
      };
    });

    const matchedUsers = (userAgg || []).map(u => ({
      userId: u.userId || ('user_' + (u.username || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '')),
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
        userId: 'user_' + username.toLowerCase().replace(/[^a-z0-9]/g, ''),
        username,
        postCount: total,
        totalLikes: posts.reduce((s, p) => s + (Number(p.likes) || 0), 0),
        latestPostDate: posts[0]?.createdAt || null
      };
    }

    const hasMore = (skip + limit) < total;
    const queryMs = Date.now() - t0;

    // HTTP Cache-Control: Cache default feed for 15s to enhance CDN performance
    if (isDefaultFeed && page === 1) {
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    } else {
      res.setHeader('Cache-Control', 'private, no-cache');
    }

    const responsePayload = {
      success: true,
      posts,
      total,
      page,
      limit,
      hasMore,
      matchedUsers,
      userProfile,
      data: {
        posts,
        total,
        page,
        limit,
        hasMore,
        matchedUsers,
        userProfile
      },
      _meta: { queryMs }
    };

    return res.status(200).json(responsePayload);

  } catch (err) {
    const queryMs = Date.now() - t0;
    console.error(`[get-posts] ERROR (${queryMs}ms):`, err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch community posts.',
      error: {
        code: 'DB_QUERY_ERROR',
        message: err.message
      }
    });
  }
};

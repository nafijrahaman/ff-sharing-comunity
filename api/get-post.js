/**
 * Vercel Serverless Function: GET /api/get-post?id=<postId>
 * Fetches a single post by ID (numeric postId or MongoDB _id) from MongoDB.
 */
'use strict';

const { getDb, buildPostQuery } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const rawId = req.query.id || req.query.postId || '';
  const postQuery = buildPostQuery(rawId);

  if (!postQuery) {
    return res.status(400).json({
      success: false,
      message: 'Post ID is required',
      error: { code: 'POST_ID_REQUIRED', message: 'A valid numeric post ID or document ID is required.' }
    });
  }

  try {
    const db = await getDb();
    const doc = await db.collection('posts').findOne(postQuery);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Post Not Found',
        error: { code: 'NOT_FOUND', message: 'The requested settings post does not exist or was deleted.' }
      });
    }

    const pId = typeof doc.postId === 'number' ? doc.postId : (Number(doc.id) || 0);
    const post = {
      id: pId,
      postId: pId,
      _docId: doc._id.toString(),
      userId: doc.userId || ('user_' + (doc.username || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '')),
      username: (doc.username || 'Anonymous').trim(),
      title: (doc.title || '').trim(),
      settings: doc.settings || '',
      image: doc.image || '',
      likes: Number(doc.likes) || 0,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString())
    };

    return res.status(200).json({
      success: true,
      post,
      data: { post }
    });

  } catch (err) {
    console.error('GET /api/get-post error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch post.',
      error: { code: 'DB_ERROR', message: err.message }
    });
  }
};

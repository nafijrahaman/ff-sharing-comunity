/**
 * Vercel Serverless Function: POST /api/like-post
 * Production-optimized post liking in MongoDB Atlas:
 * - Connection pooling via api/_db.js
 * - Identifier normalization (supports numeric postId or document _id)
 * - Atomic $inc and $addToSet with client fingerprint to prevent duplicate likes
 */
'use strict';

const { getDb, buildPostQuery } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const body = req.body || {};
    const rawId = body.postId ?? body.id ?? body._id;
    const fingerprint = (body.fingerprint || '').trim();

    if (rawId === undefined || rawId === null || rawId === '') {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required.',
        error: { code: 'POST_ID_REQUIRED', message: 'Post ID is required.' }
      });
    }

    if (!fingerprint) {
      return res.status(400).json({
        success: false,
        message: 'Client fingerprint is required.',
        error: { code: 'FINGERPRINT_REQUIRED', message: 'Client fingerprint is required.' }
      });
    }

    const postQuery = buildPostQuery(rawId);
    if (!postQuery) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format.',
        error: { code: 'INVALID_ID', message: 'Invalid post ID format.' }
      });
    }

    const db = await getDb();

    // Check if user already liked this post
    const existing = await db.collection('posts').findOne({
      ...postQuery,
      likedBy: fingerprint
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        likes: Number(existing.likes) || 0,
        alreadyLiked: true,
        message: 'Post already liked.'
      });
    }

    // Atomically increment like count and record fingerprint
    const updated = await db.collection('posts').findOneAndUpdate(
      postQuery,
      {
        $inc: { likes: 1 },
        $addToSet: { likedBy: fingerprint }
      },
      { returnDocument: 'after' }
    );

    const post = updated?.value || updated;
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: 'POST_NOT_FOUND', message: 'Post not found.' }
      });
    }

    const currentLikes = Number(post.likes) || 1;

    return res.status(200).json({
      success: true,
      likes: currentLikes,
      alreadyLiked: false,
      message: 'Post liked successfully!'
    });

  } catch (err) {
    console.error('POST /api/like-post error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to like post.',
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
};
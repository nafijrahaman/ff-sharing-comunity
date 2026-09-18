/**
 * Vercel Serverless Function: POST /api/admin-delete-post & DELETE /api/admin-delete-post
 * Production-level post deletion from MongoDB Atlas:
 * - Cryptographic admin authentication required
 * - Deletes single post (by numeric postId or ObjectId _id)
 * - Deletes multiple selected posts in ONE atomic operation (bulk delete)
 * - Cleans up associated GridFS screenshots
 * - Never requires username
 */
'use strict';

const { getDb, getGridFSBucket, normalizePostId, ObjectId } = require('./_db');
const { requireAdminAuth } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed. Use POST or DELETE.' }
    });
  }

  // 1. Verify Admin Authentication
  if (!requireAdminAuth(req, res)) return;

  try {
    const db = await getDb();
    const body = req.body || {};
    const query = req.query || {};

    // ── Bulk Delete: Check if array of IDs was sent ─────────────────────────
    const rawList = body.selectedPostIds || body.postIds || body.ids || (Array.isArray(body) ? body : null);

    if (Array.isArray(rawList) && rawList.length > 0) {
      const orClauses = [];
      for (const item of rawList) {
        const norm = normalizePostId(item);
        if (norm) {
          if (norm.type === 'postId') {
            orClauses.push({ postId: norm.value }, { id: norm.value });
          } else {
            orClauses.push({ _id: norm.value });
          }
        }
      }

      if (orClauses.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid post identifiers provided in selection.',
          error: { code: 'INVALID_POST_IDS', message: 'No valid post identifiers provided in selection.' }
        });
      }

      // Find posts to see if any have GridFS screenshots to clean up
      const postsToDelete = await db.collection('posts').find({ $or: orClauses }).project({ image: 1 }).toArray();

      // Clean up associated GridFS images
      for (const p of postsToDelete) {
        if (p.image && p.image.includes('/api/image?id=')) {
          const imgId = p.image.split('id=')[1]?.split('&')[0];
          if (imgId && ObjectId.isValid(imgId)) {
            try {
              const bucket = await getGridFSBucket();
              await bucket.delete(new ObjectId(imgId));
            } catch (_) {}
          }
        }
      }

      const deleteResult = await db.collection('posts').deleteMany({ $or: orClauses });

      return res.status(200).json({
        success: true,
        deletedCount: deleteResult.deletedCount,
        message: `Successfully deleted ${deleteResult.deletedCount} selected post(s).`
      });
    }

    // ── Single Post Delete ──────────────────────────────────────────────────
    const rawId = body.postId ?? body.id ?? body._id ?? query.postId ?? query.id;

    if (rawId === undefined || rawId === null || rawId === '') {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required.',
        error: { code: 'POST_ID_REQUIRED', message: 'A valid numeric postId or document ID is required.' }
      });
    }

    const norm = normalizePostId(rawId);
    if (!norm) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post identifier format.',
        error: { code: 'INVALID_POST_ID', message: 'Invalid post identifier format.' }
      });
    }

    const filter = norm.type === 'postId'
      ? { $or: [{ postId: norm.value }, { id: norm.value }] }
      : { _id: norm.value };

    // Find post first to clean up GridFS image if present
    const postToDelete = await db.collection('posts').findOne(filter);
    if (!postToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or already deleted.',
        error: { code: 'POST_NOT_FOUND', message: 'Post not found or already deleted.' }
      });
    }

    // Delete associated GridFS image if applicable
    if (postToDelete.image && postToDelete.image.includes('/api/image?id=')) {
      const imgId = postToDelete.image.split('id=')[1]?.split('&')[0];
      if (imgId && ObjectId.isValid(imgId)) {
        try {
          const bucket = await getGridFSBucket();
          await bucket.delete(new ObjectId(imgId));
        } catch (_) {}
      }
    }

    const deleteResult = await db.collection('posts').deleteOne(filter);
    const deletedIdStr = postToDelete.postId ? `#${postToDelete.postId}` : postToDelete._id.toString();

    return res.status(200).json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      message: `Post ${deletedIdStr} permanently deleted.`
    });

  } catch (err) {
    console.error('Delete post error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete post.',
      error: { code: 'DB_ERROR', message: err.message }
    });
  }
};

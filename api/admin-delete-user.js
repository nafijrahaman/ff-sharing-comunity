/**
 * Vercel Serverless Function: POST /api/admin-delete-user & DELETE /api/admin-delete-user
 * Production-level user deletion from MongoDB Atlas:
 * - Cryptographic admin authentication required
 * - Accepts userId or username (never requires postId)
 * - Deletes all posts created by this user
 * - Deletes user record from users collection
 * - Cleans up associated GridFS screenshots
 */
'use strict';

const { getDb, getGridFSBucket, ObjectId } = require('./_db');
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

    const rawUserId = (body.userId || body.id || query.userId || query.id || '').trim();
    const rawUsername = (body.username || body.user || query.username || query.user || '').trim();

    if (!rawUserId && !rawUsername) {
      return res.status(400).json({
        success: false,
        message: 'User ID or username is required.',
        error: { code: 'USER_IDENTIFIER_REQUIRED', message: 'Please provide either userId or username.' }
      });
    }

    // Build query to match all posts by this user (by userId or case-insensitive username)
    const postFilterConditions = [];
    if (rawUserId) {
      postFilterConditions.push({ userId: rawUserId });
      // Also match synthetic userId
      const cleanUser = rawUserId.replace(/^user_/, '');
      postFilterConditions.push({ username: { $regex: new RegExp('^' + cleanUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    }
    if (rawUsername) {
      const safeName = rawUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      postFilterConditions.push({ username: { $regex: new RegExp('^' + safeName + '$', 'i') } });
      const syntheticId = 'user_' + rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      postFilterConditions.push({ userId: syntheticId });
    }

    const postFilter = { $or: postFilterConditions };

    // Find posts to delete to clean up GridFS images
    const userPosts = await db.collection('posts').find(postFilter).project({ image: 1 }).toArray();

    for (const p of userPosts) {
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

    // Delete posts
    const postDeleteResult = await db.collection('posts').deleteMany(postFilter);

    // Delete user from users collection
    const userFilterConditions = [];
    if (rawUserId) userFilterConditions.push({ userId: rawUserId });
    if (rawUsername) {
      userFilterConditions.push({ username: { $regex: new RegExp('^' + rawUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
      userFilterConditions.push({ userId: 'user_' + rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '') });
    }

    let userDeleted = false;
    if (userFilterConditions.length > 0) {
      const userDel = await db.collection('users').deleteMany({ $or: userFilterConditions });
      userDeleted = userDel.deletedCount > 0;
    }

    const displayName = rawUsername || rawUserId;

    return res.status(200).json({
      success: true,
      deletedCount: postDeleteResult.deletedCount,
      deletedPostsCount: postDeleteResult.deletedCount,
      userDeleted,
      message: `Deleted ${postDeleteResult.deletedCount} post(s) belonging to "${displayName}".`
    });

  } catch (err) {
    console.error('Delete user error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user and posts.',
      error: { code: 'DB_ERROR', message: err.message }
    });
  }
};

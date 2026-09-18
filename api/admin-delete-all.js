/**
 * Vercel Serverless Function: POST /api/admin-delete-all & DELETE /api/admin-delete-all
 * Purges ALL posts, users, GridFS screenshots and resets post sequence counter.
 */
'use strict';

const { getDb } = require('./_db');
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
    const body = req.body || {};
    if (body.confirm !== true && body.confirm !== 'CONFIRM_DELETE_ALL') {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation is required to wipe the database.',
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Set confirm: "CONFIRM_DELETE_ALL" in request body.' }
      });
    }

    const db = await getDb();

    // 1. Delete all posts
    const postsResult = await db.collection('posts').deleteMany({});

    // 2. Delete all users
    await db.collection('users').deleteMany({}).catch(() => {});

    // 3. Reset counter sequence to 0
    await db.collection('counters').updateOne(
      { _id: 'postId' },
      { $set: { seq: 0 } },
      { upsert: true }
    ).catch(() => {});

    // 4. Purge GridFS screenshot files & chunks
    await db.collection('screenshots.files').deleteMany({}).catch(() => {});
    await db.collection('screenshots.chunks').deleteMany({}).catch(() => {});

    return res.status(200).json({
      success: true,
      deletedCount: postsResult.deletedCount,
      message: `Database wiped clean. Purged ${postsResult.deletedCount} posts. Counter reset to #1.`
    });

  } catch (err) {
    console.error('Delete all error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to purge database.',
      error: { code: 'DB_ERROR', message: err.message }
    });
  }
};

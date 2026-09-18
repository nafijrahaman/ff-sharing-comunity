/**
 * Vercel Serverless Function: GET /api/admin-users
 * Returns list of registered authors/users with their post counts, total likes, and latest post dates.
 * Protected by admin authentication.
 */
'use strict';

const { getDb } = require('./_db');
const { requireAdminAuth } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  if (!requireAdminAuth(req, res)) return;

  try {
    const db = await getDb();

    // Aggregate user stats from posts collection
    const userStats = await db.collection('posts').aggregate([
      {
        $group: {
          _id: { $toLower: '$username' },
          username: { $first: '$username' },
          userId: { $first: '$userId' },
          postCount: { $sum: 1 },
          totalLikes: { $sum: '$likes' },
          firstPostDate: { $min: '$createdAt' },
          latestPostDate: { $max: '$createdAt' }
        }
      },
      { $sort: { totalLikes: -1, postCount: -1 } }
    ]).toArray();

    const users = userStats.map(u => ({
      userId: u.userId || ('user_' + (u.username || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '')),
      username: u.username || 'Anonymous',
      postCount: u.postCount,
      totalLikes: u.totalLikes,
      firstPostDate: u.firstPostDate,
      latestPostDate: u.latestPostDate
    }));

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
      data: users
    });

  } catch (err) {
    console.error('GET /api/admin-users error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users list.',
      error: { code: 'DB_ERROR', message: err.message }
    });
  }
};

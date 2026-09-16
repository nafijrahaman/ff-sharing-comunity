/**
 * Vercel Serverless Function: POST /api/like-post
 * Likes a post in MongoDB. Uses fingerprint to prevent duplicate likes.
 */
const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) throw new Error('MONGODB_URI is not configured');

  if (cachedClient && cachedDb) return cachedDb;

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  });

  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'ff_sharing');
  cachedClient = client;
  cachedDb = db;
  return db;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const db = await getDb();
    const body = req.body || {};
    const postId = Number(body.postId);
    const fingerprint = (body.fingerprint || '').trim();

    if (!postId || !fingerprint) {
      return res.status(400).json({ success: false, message: 'postId and fingerprint are required' });
    }

    // Check if already liked
    const existing = await db.collection('posts').findOne({
      $or: [{ postId }, { id: postId }],
      likedBy: fingerprint
    });

    if (existing) {
      return res.status(200).json({ success: true, likes: Number(existing.likes) || 0, alreadyLiked: true });
    }

    const updated = await db.collection('posts').findOneAndUpdate(
      { $or: [{ postId }, { id: postId }] },
      { $inc: { likes: 1 }, $addToSet: { likedBy: fingerprint } },
      { returnDocument: 'after' }
    );

    const post = updated?.value || updated;
    return res.status(200).json({
      success: true,
      likes: post ? Number(post.likes) : 1,
      alreadyLiked: false
    });
  } catch (err) {
    console.error('POST /api/like-post error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to like post: ' + err.message });
  }
};

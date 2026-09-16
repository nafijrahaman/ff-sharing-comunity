/**
 * Vercel Serverless Function: POST /api/admin-delete-user
 * Deletes all posts by a specific username from MongoDB.
 */
const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (cachedClient && cachedDb) return cachedDb;
  const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'ff_sharing');
  cachedClient = client;
  cachedDb = db;
  return db;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const db = await getDb();
    const body = req.body || {};
    const username = (body.username || '').trim();

    if (!username) return res.status(400).json({ success: false, message: 'username is required' });

    const result = await db.collection('posts').deleteMany({
      username: { $regex: new RegExp('^' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    });

    return res.status(200).json({ success: true, deletedCount: result.deletedCount, message: `Deleted ${result.deletedCount} posts by @${username}` });
  } catch (err) {
    console.error('POST /api/admin-delete-user error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete user posts: ' + err.message });
  }
};

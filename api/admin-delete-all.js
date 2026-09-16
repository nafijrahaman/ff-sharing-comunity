/**
 * Vercel Serverless Function: POST /api/admin-delete-all
 * Deletes ALL posts from MongoDB and resets the post counter.
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

    const result = await db.collection('posts').deleteMany({});
    await db.collection('counters').updateOne({ _id: 'postId' }, { $set: { seq: 0 } }, { upsert: true });

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `All ${result.deletedCount} posts purged. Database reset to new!`
    });
  } catch (err) {
    console.error('POST /api/admin-delete-all error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete all posts: ' + err.message });
  }
};

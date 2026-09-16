/**
 * Vercel Serverless Function: GET /api/get-post
 * Fetches a single post by ID from MongoDB.
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const postId = Number(req.query.id);
  if (!postId) return res.status(400).json({ success: false, message: 'Post ID is required' });

  try {
    const db = await getDb();
    const doc = await db.collection('posts').findOne({ $or: [{ postId }, { id: postId }] });

    if (!doc) return res.status(404).json({ success: false, message: 'Post Not Found' });

    return res.status(200).json({
      success: true,
      post: {
        id: Number(doc.postId || doc.id),
        _docId: doc._id.toString(),
        username: doc.username || 'Anonymous',
        title: doc.title || '',
        settings: doc.settings || '',
        image: doc.image || '',
        likes: Number(doc.likes) || 0,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt
      }
    });
  } catch (err) {
    console.error('GET /api/get-post error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch post: ' + err.message });
  }
};

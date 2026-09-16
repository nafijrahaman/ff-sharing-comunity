/**
 * Vercel Serverless Function: POST /api/create-post
 * Creates a new post in MongoDB with a sequential auto-incrementing postId.
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

  try {
    await db.collection('posts').createIndex({ createdAt: -1 });
    await db.collection('posts').createIndex({ postId: -1 }, { unique: true, sparse: true });
  } catch (_) {}

  cachedClient = client;
  cachedDb = db;
  return db;
}

async function getNextPostId(db) {
  try {
    const result = await db.collection('counters').findOneAndUpdate(
      { _id: 'postId' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = result?.seq ?? result?.value?.seq;
    if (typeof seq === 'number') return seq;
  } catch (_) {}

  // Fallback
  const highest = await db.collection('posts').find({}).sort({ postId: -1 }).limit(1).toArray();
  return (highest.length > 0 ? Number(highest[0].postId) || 0 : 0) + 1;
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
    const username = (body.username || '').trim();
    const title = (body.title || '').trim();
    const settings = (body.settings || '').trim();
    const image = (body.image || '').trim();

    if (!username) return res.status(400).json({ success: false, message: 'Username is required.' });
    if (!settings) return res.status(400).json({ success: false, message: 'Settings text is required.' });

    const nextId = await getNextPostId(db);

    const doc = {
      postId: nextId,
      username,
      title,
      settings,
      image,
      likes: 0,
      likedBy: [],
      createdAt: new Date()
    };

    const insertResult = await db.collection('posts').insertOne(doc);

    return res.status(201).json({
      success: true,
      message: 'Settings shared successfully!',
      post: {
        id: nextId,
        _docId: insertResult.insertedId.toString(),
        username,
        title,
        settings,
        image,
        likes: 0,
        createdAt: doc.createdAt.toISOString()
      }
    });
  } catch (err) {
    console.error('POST /api/create-post error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create post: ' + err.message });
  }
};

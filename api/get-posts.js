/**
 * Vercel Serverless Function: GET /api/get-posts
 * Fetches posts from MongoDB with pagination, search, and user aggregation.
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

  // Ensure indexes exist for fast queries
  try {
    await db.collection('posts').createIndex({ createdAt: -1 });
    await db.collection('posts').createIndex({ postId: -1 }, { unique: true, sparse: true });
    await db.collection('posts').createIndex({ username: 1 });
  } catch (_) {}

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

  try {
    const db = await getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.q || req.query.search || '').trim();
    const username = (req.query.username || req.query.user || req.query.author || '').trim();

    const filter = {};

    if (username) {
      filter.username = { $regex: new RegExp('^' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    }

    if (search) {
      if (search.startsWith('#')) {
        const idNum = parseInt(search.slice(1), 10);
        if (!isNaN(idNum)) filter.postId = idNum;
      } else {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { settings: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const skip = (page - 1) * limit;

    const [total, rawDocs, userAgg] = await Promise.all([
      db.collection('posts').countDocuments(filter),
      db.collection('posts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('posts').aggregate([
        { $group: { _id: { $toLower: '$username' }, username: { $first: '$username' }, postCount: { $sum: 1 }, totalLikes: { $sum: '$likes' }, latestPostDate: { $max: '$createdAt' } } },
        { $sort: { totalLikes: -1, postCount: -1 } },
        { $limit: 10 }
      ]).toArray().catch(() => [])
    ]);

    const posts = rawDocs.map(doc => ({
      id: Number(doc.postId || doc._id),
      _docId: doc._id.toString(),
      username: doc.username || 'Anonymous',
      title: doc.title || '',
      settings: doc.settings || '',
      image: doc.image || '',
      likes: Number(doc.likes) || 0,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString())
    }));

    const matchedUsers = (userAgg || []).slice(0, 5).map(u => ({
      username: u.username,
      postCount: u.postCount,
      totalLikes: u.totalLikes,
      latestPostDate: u.latestPostDate instanceof Date ? u.latestPostDate.toISOString() : u.latestPostDate
    }));

    let userProfile = null;
    if (username) {
      const found = matchedUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      userProfile = found || { username, postCount: total, totalLikes: posts.reduce((s, p) => s + p.likes, 0), latestPostDate: posts[0]?.createdAt };
    }

    return res.status(200).json({
      success: true,
      posts,
      total,
      page,
      limit,
      hasMore: (skip + limit) < total,
      matchedUsers,
      userProfile
    });
  } catch (err) {
    console.error('GET /api/get-posts error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts: ' + err.message });
  }
};

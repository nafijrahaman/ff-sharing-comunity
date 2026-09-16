/**
 * MongoDB Client & Data Operations
 * Provides high-speed connection pooling and indexing for ultra-fast queries (<20ms).
 */
const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || '';
}

function isMongoConfigured() {
  return Boolean(getMongoUri());
}

async function connectToMongo() {
  const uri = getMongoUri();
  if (!uri) return null;

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    await client.connect();
    const dbName = process.env.MONGODB_DB_NAME || 'ff_sharing';
    const db = client.db(dbName);

    // Create indexes for lightning performance
    try {
      await db.collection('posts').createIndex({ postId: -1 }, { unique: true, sparse: true });
      await db.collection('posts').createIndex({ createdAt: -1 });
      await db.collection('posts').createIndex({ username: 1 });
      await db.collection('counters').createIndex({ _id: 1 });
    } catch (idxErr) {
      // Non-fatal
    }

    cachedClient = client;
    cachedDb = db;
    return { client, db };
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return null;
  }
}

/**
 * Get next sequential post ID using atomic counter in MongoDB
 */
async function getMongoNextPostId(db) {
  try {
    const result = await db.collection('counters').findOneAndUpdate(
      { _id: 'postId' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = result?.seq || result?.value?.seq;
    if (typeof seq === 'number') return seq;

    // Fallback: max existing postId + 1
    const highest = await db.collection('posts').find({}).sort({ postId: -1 }).limit(1).toArray();
    const max = highest.length > 0 ? Number(highest[0].postId) || 0 : 0;
    const next = max + 1;
    await db.collection('counters').updateOne({ _id: 'postId' }, { $set: { seq: next } }, { upsert: true });
    return next;
  } catch (err) {
    console.error('MongoDB sequence error, fallback to timestamp:', err.message);
    return Date.now();
  }
}

/**
 * Insert post into MongoDB
 */
async function insertMongoPost(postData) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  let nextId = Number(postData.postId);
  if (!nextId) {
    nextId = await getMongoNextPostId(db);
  }

  const doc = {
    postId: nextId,
    username: (postData.username || 'Anonymous').trim(),
    title: (postData.title || '').trim(),
    settings: postData.settings || '',
    image: postData.image || '',
    likes: Number(postData.likes) || 0,
    likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
    createdAt: postData.createdAt ? new Date(postData.createdAt) : new Date()
  };

  const res = await db.collection('posts').insertOne(doc);
  return {
    ...doc,
    _docId: res.insertedId.toString(),
    id: nextId,
    createdAt: doc.createdAt.toISOString()
  };
}

/**
 * Get posts list from MongoDB with pagination, search, and user stats
 */
async function getMongoPostsList({ page = 1, limit = 20, search = '', username = '' } = {}) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const filter = {};

  if (username) {
    filter.username = { $regex: new RegExp('^' + username.trim() + '$', 'i') };
  }

  if (search) {
    const term = search.trim();
    if (term.startsWith('#')) {
      const idNum = parseInt(term.slice(1), 10);
      if (!isNaN(idNum)) {
        filter.postId = idNum;
      }
    } else {
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { settings: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } }
      ];
    }
  }

  const skip = (page - 1) * limit;

  // Execute count and find in parallel for maximum speed
  const [total, rawDocs, userAgg] = await Promise.all([
    db.collection('posts').countDocuments(filter),
    db.collection('posts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('posts').aggregate([
      {
        $group: {
          _id: { $toLower: '$username' },
          username: { $first: '$username' },
          postCount: { $sum: 1 },
          totalLikes: { $sum: '$likes' },
          latestPostDate: { $max: '$createdAt' }
        }
      },
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

  const matchedUsers = (userAgg || []).map(u => ({
    username: u.username,
    postCount: u.postCount,
    totalLikes: u.totalLikes,
    latestPostDate: u.latestPostDate instanceof Date ? u.latestPostDate.toISOString() : u.latestPostDate
  }));

  let userProfile = null;
  if (username) {
    const foundUser = matchedUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (foundUser) {
      userProfile = foundUser;
    } else {
      userProfile = {
        username: username,
        postCount: total,
        totalLikes: posts.reduce((s, p) => s + p.likes, 0),
        latestPostDate: posts[0]?.createdAt || new Date().toISOString()
      };
    }
  }

  const hasMore = (skip + limit) < total;

  return {
    posts,
    total,
    page,
    limit,
    hasMore,
    matchedUsers: matchedUsers.slice(0, 5),
    userProfile
  };
}

/**
 * Get single post by postId from MongoDB
 */
async function getMongoPostById(postId) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const num = Number(postId);

  const doc = await db.collection('posts').findOne({
    $or: [
      { postId: num },
      { id: num }
    ]
  });

  if (!doc) return null;

  return {
    id: Number(doc.postId || doc.id),
    _docId: doc._id.toString(),
    username: doc.username || 'Anonymous',
    title: doc.title || '',
    settings: doc.settings || '',
    image: doc.image || '',
    likes: Number(doc.likes) || 0,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt
  };
}

/**
 * Like a post in MongoDB
 */
async function likeMongoPostById(postId, fingerprint) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const num = Number(postId);

  // Check if already liked
  const existing = await db.collection('posts').findOne({
    $or: [{ postId: num }, { id: num }],
    likedBy: fingerprint
  });

  if (existing) {
    return { success: true, likes: existing.likes || 0, alreadyLiked: true };
  }

  const updated = await db.collection('posts').findOneAndUpdate(
    { $or: [{ postId: num }, { id: num }] },
    {
      $inc: { likes: 1 },
      $addToSet: { likedBy: fingerprint }
    },
    { returnDocument: 'after' }
  );

  const post = updated?.value || updated;
  return {
    success: true,
    likes: post ? (Number(post.likes) || 1) : 1,
    alreadyLiked: false
  };
}

/**
 * Delete a post from MongoDB
 */
async function deleteMongoPostById(postId) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const num = Number(postId);
  await db.collection('posts').deleteOne({ $or: [{ postId: num }, { id: num }] });
  return true;
}

/**
 * Delete all posts by username from MongoDB
 */
async function deleteMongoPostsByUsername(username) {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const res = await db.collection('posts').deleteMany({
    username: { $regex: new RegExp('^' + username.trim() + '$', 'i') }
  });
  return res.deletedCount;
}

/**
 * Delete all posts from MongoDB
 */
async function deleteMongoAllPosts() {
  const mongo = await connectToMongo();
  if (!mongo) return null;

  const { db } = mongo;
  const res = await db.collection('posts').deleteMany({});
  await db.collection('counters').updateOne({ _id: 'postId' }, { $set: { seq: 0 } }, { upsert: true });
  return res.deletedCount;
}

module.exports = {
  isMongoConfigured,
  connectToMongo,
  insertMongoPost,
  getMongoPostsList,
  getMongoPostById,
  likeMongoPostById,
  deleteMongoPostById,
  deleteMongoPostsByUsername,
  deleteMongoAllPosts
};

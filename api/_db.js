/**
 * Centralized MongoDB Connection Pooling, Indexing & GridFS Bucket Provider
 * Reuses MongoClient across invocations in serverless/Node environments.
 */
'use strict';

const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

let _client = null;
let _db = null;
let _bucket = null;
let _indexesInitialized = false;

function getMongoUri() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured.');
  }
  return uri;
}

async function getDb() {
  if (_client && _db) {
    try {
      await _db.command({ ping: 1 });
      return _db;
    } catch (_) {
      _client = null;
      _db = null;
      _bucket = null;
    }
  }

  const uri = getMongoUri();
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000
  });

  await client.connect();
  const dbName = process.env.MONGODB_DB_NAME || 'ff_sharing';
  const db = client.db(dbName);

  if (!_indexesInitialized) {
    try {
      await Promise.all([
        db.collection('posts').createIndex({ createdAt: -1 }),
        db.collection('posts').createIndex({ postId: -1 }, { unique: true, sparse: true }),
        db.collection('posts').createIndex({ username: 1 }),
        db.collection('posts').createIndex({ userId: 1 }),
        db.collection('counters').createIndex({ _id: 1 })
      ]);
      // Attempt text index for search (non-blocking if already exists)
      db.collection('posts').createIndex(
        { title: 'text', settings: 'text', username: 'text' },
        { name: 'posts_text_search', weights: { title: 10, username: 5, settings: 1 } }
      ).catch(() => {});
      _indexesInitialized = true;
    } catch (idxErr) {
      console.warn('MongoDB index initialization warning:', idxErr.message);
      _indexesInitialized = true;
    }
  }

  _client = client;
  _db = db;
  _bucket = new GridFSBucket(db, { bucketName: 'screenshots' });
  return db;
}

async function getGridFSBucket() {
  await getDb();
  return _bucket;
}

/**
 * Get next sequential post ID using atomic MongoDB counters
 */
async function getNextPostId(db) {
  try {
    const result = await db.collection('counters').findOneAndUpdate(
      { _id: 'postId' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = result?.seq ?? result?.value?.seq;
    if (typeof seq === 'number') return seq;
  } catch (err) {
    console.warn('Counters findOneAndUpdate warning:', err.message);
  }

  // Fallback: max existing postId + 1
  const highest = await db.collection('posts').find({}).sort({ postId: -1 }).limit(1).toArray();
  const max = (highest.length > 0 && typeof highest[0].postId === 'number') ? highest[0].postId : 0;
  const next = max + 1;
  await db.collection('counters').updateOne({ _id: 'postId' }, { $set: { seq: next } }, { upsert: true }).catch(() => {});
  return next;
}

/**
 * Normalizes a post identifier from query or body.
 * Accepts numeric postId (1, "1", "#1") or MongoDB ObjectId hex string.
 */
function normalizePostId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const str = String(raw).trim().replace(/^#/, '');
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (!isNaN(num) && num > 0) return { type: 'postId', value: num };
  }
  if (ObjectId.isValid(str)) {
    return { type: '_id', value: new ObjectId(str) };
  }
  return null;
}

/**
 * Builds MongoDB query filter matching a post by either postId or _id
 */
function buildPostQuery(rawId) {
  const norm = normalizePostId(rawId);
  if (!norm) return null;
  if (norm.type === 'postId') {
    return { $or: [{ postId: norm.value }, { id: norm.value }] };
  }
  return { _id: norm.value };
}

module.exports = {
  getDb,
  getGridFSBucket,
  getNextPostId,
  normalizePostId,
  buildPostQuery,
  ObjectId
};

/**
 * Vercel Serverless Function: POST /api/create-post
 * Creates a new community post in MongoDB with sequential auto-incrementing postId
 * and registers user record in MongoDB.
 * Ensures images are stored in GridFS (never as raw base64 inside documents).
 */
'use strict';

const { getDb, getNextPostId, getGridFSBucket, ObjectId } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const db = await getDb();
    const body = req.body || {};

    const rawUsername = (body.username || '').trim();
    const rawTitle = (body.title || '').trim();
    const rawSettings = (body.settings || '').trim();
    let imageRef = (body.image || '').trim();

    if (!rawUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is required.',
        error: { code: 'USERNAME_REQUIRED', message: 'Username is required.' }
      });
    }

    if (rawUsername.length > 35) {
      return res.status(400).json({
        success: false,
        message: 'Username cannot exceed 35 characters.',
        error: { code: 'USERNAME_TOO_LONG', message: 'Username cannot exceed 35 characters.' }
      });
    }

    if (!rawSettings) {
      return res.status(400).json({
        success: false,
        message: 'Settings text is required.',
        error: { code: 'SETTINGS_REQUIRED', message: 'Settings text is required.' }
      });
    }

    if (rawSettings.length > 3000) {
      return res.status(400).json({
        success: false,
        message: 'Settings text cannot exceed 3000 characters.',
        error: { code: 'SETTINGS_TOO_LONG', message: 'Settings text cannot exceed 3000 characters.' }
      });
    }

    if (rawTitle.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Post title cannot exceed 120 characters.',
        error: { code: 'TITLE_TOO_LONG', message: 'Post title cannot exceed 120 characters.' }
      });
    }

    // Defensive: If an image is passed as a base64 data URL, store in GridFS so document stays small
    if (imageRef.startsWith('data:image/')) {
      try {
        const matches = imageRef.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1].toLowerCase();
          const buffer = Buffer.from(matches[2], 'base64');
          if (buffer.length <= 5 * 1024 * 1024) {
            const bucket = await getGridFSBucket();
            const fileId = new ObjectId();
            const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
            const filename = `screenshot_${fileId.toString()}.${ext}`;

            await new Promise((resolve, reject) => {
              const uploadStream = bucket.openUploadStreamWithId(fileId, filename, {
                contentType: mimeType,
                metadata: { uploadedAt: new Date(), size: buffer.length }
              });
              uploadStream.on('error', reject);
              uploadStream.on('finish', resolve);
              uploadStream.end(buffer);
            });

            imageRef = `/api/image?id=${fileId.toString()}`;
          }
        }
      } catch (uploadErr) {
        console.warn('GridFS auto-conversion warning in create-post:', uploadErr.message);
      }
    }

    const nextId = await getNextPostId(db);
    const userId = 'user_' + rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

    const doc = {
      postId: nextId,
      userId,
      username: rawUsername,
      title: rawTitle,
      settings: rawSettings,
      image: imageRef,
      likes: 0,
      likedBy: [],
      createdAt: new Date()
    };

    const insertResult = await db.collection('posts').insertOne(doc);

    // Maintain user record in users collection
    await db.collection('users').updateOne(
      { userId },
      {
        $set: { username: rawUsername, lastActiveAt: new Date() },
        $inc: { postCount: 1 },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    ).catch(() => {});

    const createdPost = {
      id: nextId,
      postId: nextId,
      _docId: insertResult.insertedId.toString(),
      userId,
      username: rawUsername,
      title: rawTitle,
      settings: rawSettings,
      image: imageRef,
      likes: 0,
      createdAt: doc.createdAt.toISOString()
    };

    return res.status(201).json({
      success: true,
      message: 'Settings shared successfully!',
      post: createdPost,
      data: {
        post: createdPost
      }
    });

  } catch (err) {
    console.error('POST /api/create-post error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create post.',
      error: { code: 'POST_CREATION_FAILED', message: err.message }
    });
  }
};

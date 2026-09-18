/**
 * Vercel Serverless Function: GET /api/image?id=<fileId>
 * High-performance image streaming endpoint reading from MongoDB GridFS.
 * Provides immutable HTTP caching (1 year) and ETag 304 handling.
 */
'use strict';

const { getDb, getGridFSBucket, ObjectId } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const rawId = req.query.id || req.query.fileId || '';
  if (!rawId || !ObjectId.isValid(rawId)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Valid image ID is required.' } });
  }

  try {
    const fileId = new ObjectId(rawId);
    const db = await getDb();
    const file = await db.collection('screenshots.files').findOne({ _id: fileId });

    if (!file) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found.' } });
    }

    const etag = `"${fileId.toString()}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.status(200);
    const contentType = file.contentType || (file.metadata && file.metadata.contentType) || (file.filename && file.filename.endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);

    const bucket = await getGridFSBucket();
    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('error', (err) => {
      console.error('GridFS stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'STREAM_ERROR', message: 'Error streaming image.' } });
      }
    });

    downloadStream.pipe(res);

  } catch (err) {
    console.error('GET /api/image error:', err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error retrieving image.' } });
  }
};

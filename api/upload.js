/**
 * Vercel Serverless Function: POST /api/upload
 * High-speed image upload endpoint storing screenshots into MongoDB GridFS.
 * Avoids base64 bloat inside posts documents.
 */
'use strict';

const { getGridFSBucket, ObjectId } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const body = req.body || {};
    const rawImage = typeof body === 'string' ? body : (body.image || body.data || body.file || '');

    if (!rawImage || typeof rawImage !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE_PROVIDED', message: 'No image data provided for upload.' }
      });
    }

    // Parse data URL format: data:image/(jpeg|png|webp|jpg);base64,...
    const matches = rawImage.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = rawImage;

    if (matches) {
      mimeType = matches[1].toLowerCase();
      base64Data = matches[2];
    } else if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
      // Already an external URL reference
      return res.status(200).json({
        success: true,
        imageUrl: rawImage,
        data: { imageUrl: rawImage }
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Size limit: 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'Image exceeds maximum size of 5MB.' }
      });
    }

    const bucket = await getGridFSBucket();
    const fileId = new ObjectId();
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filename = `screenshot_${fileId.toString()}.${extension}`;

    await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStreamWithId(fileId, filename, {
        contentType: mimeType,
        metadata: {
          contentType: mimeType,
          uploadedAt: new Date(),
          size: buffer.length
        }
      });

      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(buffer);
    });

    const imageId = fileId.toString();
    const imageUrl = `/api/image?id=${imageId}`;

    return res.status(201).json({
      success: true,
      data: {
        imageId,
        imageUrl,
        filename,
        size: buffer.length,
        contentType: mimeType
      },
      imageId,
      imageUrl
    });

  } catch (err) {
    console.error('POST /api/upload error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: 'Failed to upload screenshot: ' + err.message }
    });
  }
};

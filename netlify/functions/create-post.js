const {
  checkRateLimit,
  recordRateLimit,
  getNextPostId,
  insertPost,
  sanitizeText,
  jsonResponse
} = require('./_nrdb');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1. IP Rate Limiting (Max 2 posts / min per IP)
    const clientIp =
      event.headers['x-forwarded-for']?.split(',')[0].trim() ||
      event.headers['client-ip'] ||
      event.headers['x-real-ip'] ||
      '127.0.0.1';

    const isAllowed = checkRateLimit(clientIp);
    if (!isAllowed) {
      return jsonResponse(429, {
        success: false,
        message: "You're posting too quickly. Please wait a moment and try again."
      });
    }

    // 2. Parse payload
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { success: false, message: 'Invalid JSON body' });
    }

    const rawUsername = (body.username || '').trim();
    const rawTitle = (body.title || '').trim();
    const rawSettings = (body.settings || '').trim();
    const rawImage = (body.image || '').trim();

    // 3. Validation
    if (!rawUsername) {
      return jsonResponse(400, { success: false, message: 'Username is required.' });
    }
    if (rawUsername.length > 35) {
      return jsonResponse(400, { success: false, message: 'Username cannot exceed 35 characters.' });
    }

    if (rawTitle.length > 120) {
      return jsonResponse(400, { success: false, message: 'Post title cannot exceed 120 characters.' });
    }

    if (!rawSettings) {
      return jsonResponse(400, { success: false, message: 'Settings / Sensitivity text is required.' });
    }
    if (rawSettings.length > 2500) {
      return jsonResponse(400, { success: false, message: 'Settings text cannot exceed 2500 characters.' });
    }

    // Image validation if provided
    let safeImage = '';
    if (rawImage) {
      // Validate data URL format: data:image/(jpeg|png|webp|gif|jpg);base64,...
      const isBase64Image = /^data:image\/(jpeg|png|webp|jpg);base64,/i.test(rawImage);
      const isHttpImage = /^https?:\/\//i.test(rawImage);

      if (!isBase64Image && !isHttpImage) {
        return jsonResponse(400, {
          success: false,
          message: 'Please upload a valid JPG, PNG, or WEBP image.'
        });
      }

      // Max image payload size (approx 1.5MB base64)
      if (rawImage.length > 2 * 1024 * 1024) {
        return jsonResponse(400, {
          success: false,
          message: 'Image size exceeds maximum limit (1.5MB).'
        });
      }
      safeImage = rawImage;
    }

    // 4. Record rate limit for valid submission
    recordRateLimit(clientIp);

    // 5. Generate next sequential ID
    const nextId = await getNextPostId();

    // 6. Create new post
    const newPost = {
      id: nextId,
      username: rawUsername,
      title: rawTitle,
      settings: rawSettings,
      image: safeImage,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString()
    };

    // 7. Save to NRDB
    await insertPost(newPost);

    return jsonResponse(201, {
      success: true,
      message: 'Settings shared successfully!',
      post: {
        id: newPost.id,
        username: newPost.username,
        title: newPost.title,
        settings: newPost.settings,
        image: newPost.image,
        likes: newPost.likes,
        createdAt: newPost.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating post:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to share settings right now. Please try again.'
    });
  }
};

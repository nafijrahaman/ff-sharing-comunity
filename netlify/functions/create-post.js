const { insertMongoPost, jsonResponse } = require('./_mongo');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
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
      return jsonResponse(400, { success: false, message: 'Settings text is required.' });
    }
    if (rawSettings.length > 3000) {
      return jsonResponse(400, { success: false, message: 'Settings text cannot exceed 3000 characters.' });
    }

    const created = await insertMongoPost({
      username: rawUsername,
      title: rawTitle,
      settings: rawSettings,
      image: rawImage,
      likes: 0
    });

    if (!created) {
      return jsonResponse(500, { success: false, message: 'Database unavailable' });
    }

    return jsonResponse(201, {
      success: true,
      message: 'Settings shared successfully!',
      post: created
    });
  } catch (err) {
    console.error('Error creating post:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to share settings right now. Please try again.'
    });
  }
};

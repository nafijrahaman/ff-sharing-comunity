const { likePostById, jsonResponse } = require('./_nrdb');

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

    const postId = body.postId;
    const fingerprint = (body.fingerprint || '').trim();

    if (!postId) {
      return jsonResponse(400, { success: false, message: 'Post ID is required' });
    }

    if (!fingerprint) {
      return jsonResponse(400, { success: false, message: 'Client fingerprint is required' });
    }

    const result = await likePostById(postId, fingerprint);

    if (!result.success && result.message === 'Post not found') {
      return jsonResponse(404, { success: false, message: 'Post not found' });
    }

    return jsonResponse(200, {
      success: true,
      likes: result.likes,
      alreadyLiked: result.alreadyLiked,
      message: result.alreadyLiked ? 'Already liked this post' : 'Post liked!'
    });
  } catch (err) {
    console.error('Error in like-post:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Failed to update like status.'
    });
  }
};

const { getMongoPostById, jsonResponse } = require('./_mongo');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
    const params = event.queryStringParameters || {};
    const postId = params.id || params.postId;

    if (!postId) {
      return jsonResponse(400, { success: false, message: 'Post ID is required' });
    }

    const post = await getMongoPostById(postId);

    if (!post) {
      return jsonResponse(404, { success: false, message: 'Post Not Found' });
    }

    return jsonResponse(200, {
      success: true,
      post,
      data: { post }
    });
  } catch (err) {
    console.error('Error fetching single post:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to load post details. Please try again.'
    });
  }
};

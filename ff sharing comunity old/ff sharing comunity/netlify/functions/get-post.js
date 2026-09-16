const { getPostById, jsonResponse } = require('./_nrdb');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
    const params = event.queryStringParameters || {};
    const postId = params.id;

    if (!postId) {
      return jsonResponse(400, { success: false, message: 'Post ID is required' });
    }

    const post = await getPostById(postId);

    if (!post) {
      return jsonResponse(404, { success: false, message: 'Post Not Found' });
    }

    return jsonResponse(200, {
      success: true,
      post: {
        id: Number(post.id),
        username: post.username || 'Anonymous',
        settings: post.settings || '',
        image: post.image || '',
        likes: Number(post.likes) || 0,
        createdAt: post.createdAt || new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching single post:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to load post details. Please try again.'
    });
  }
};

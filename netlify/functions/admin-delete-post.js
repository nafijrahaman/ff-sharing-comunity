const { deleteMongoPostById, jsonResponse } = require('./_mongo');
const { verifyAdminToken } = require('./admin-login');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  // Check admin authorization
  const authHeader = event.headers['authorization'] || event.headers['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!verifyAdminToken(token)) {
    return jsonResponse(401, { success: false, message: 'Unauthorized. Admin access required.' });
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      body = {};
    }

    const rawId = body.postId ?? body.id ?? body._id ?? event.queryStringParameters?.postId ?? event.queryStringParameters?.id;

    if (rawId === undefined || rawId === null || rawId === '') {
      return jsonResponse(400, { success: false, message: 'Post ID is required' });
    }

    await deleteMongoPostById(rawId);

    return jsonResponse(200, {
      success: true,
      message: `Post ${rawId} permanently deleted.`
    });
  } catch (err) {
    console.error('Error in admin-delete-post:', err);
    return jsonResponse(500, { success: false, message: 'Failed to delete post.' });
  }
};

const { deleteAllPosts, jsonResponse } = require('./_nrdb');
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

    // Require explicit confirmation flag in body
    if (body.confirm !== true && body.confirm !== 'CONFIRM_DELETE_ALL') {
      return jsonResponse(400, {
        success: false,
        message: 'Destructive action requires explicit confirmation.'
      });
    }

    const count = await deleteAllPosts();

    return jsonResponse(200, {
      success: true,
      message: `All posts (${count}) have been permanently deleted.`,
      count
    });
  } catch (err) {
    console.error('Error in admin-delete-all:', err);
    return jsonResponse(500, { success: false, message: 'Failed to delete all posts.' });
  }
};

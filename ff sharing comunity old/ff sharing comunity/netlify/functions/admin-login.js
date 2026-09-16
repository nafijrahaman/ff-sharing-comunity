const crypto = require('crypto');
const { jsonResponse } = require('./_nrdb');

// Hardcoded admin password as specified in requirements
const DEFAULT_ADMIN_PASSWORD = 'nafijthepro';

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

// Generate admin auth token valid for 24 hours
function generateAdminToken() {
  const secret = getAdminPassword() + '_community_secret_salt_2026';
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`admin:${expiresAt}`)
    .digest('hex');
  return Buffer.from(`${expiresAt}:${signature}`).toString('base64');
}

exports.verifyAdminToken = function (token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [expiresAtStr, signature] = decoded.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() > expiresAt) return false;

    const secret = getAdminPassword() + '_community_secret_salt_2026';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`admin:${expiresAt}`)
      .digest('hex');

    return signature === expectedSignature;
  } catch (e) {
    return false;
  }
};

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
      return jsonResponse(400, { success: false, message: 'Invalid JSON' });
    }

    const inputPassword = (body.password || '').trim();
    const correctPassword = getAdminPassword();

    if (!inputPassword) {
      return jsonResponse(400, { success: false, message: 'Password is required' });
    }

    if (inputPassword !== correctPassword) {
      return jsonResponse(401, { success: false, message: 'Invalid admin credentials' });
    }

    const token = generateAdminToken();

    return jsonResponse(200, {
      success: true,
      message: 'Admin authenticated successfully',
      token
    });
  } catch (err) {
    console.error('Error in admin-login:', err);
    return jsonResponse(500, { success: false, message: 'Server error' });
  }
};

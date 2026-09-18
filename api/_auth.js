/**
 * Cryptographic Admin Authentication & Authorization Helper
 * Uses HMAC-SHA256 signatures with 24-hour expiration tokens.
 */
'use strict';

const crypto = require('crypto');

const DEFAULT_ADMIN_PASSWORD = 'adminpassword';

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

function getSecret() {
  return getAdminPassword() + '_ff_sharing_admin_secret_key_v2';
}

/**
 * Generate 24-hour signed admin token
 */
function generateAdminToken() {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`admin:${expiresAt}`)
    .digest('hex');
  return Buffer.from(`${expiresAt}:${signature}`).toString('base64');
}

/**
 * Verify admin token
 */
function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [expiresAtStr, signature] = decoded.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(`admin:${expiresAt}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (_) {
    return false;
  }
}

/**
 * Middleware: Verify admin authorization from Request headers.
 * Returns true if authorized. Returns false and sends 401 if unauthorized.
 */
function requireAdminAuth(req, res) {
  const authHeader = req.headers?.['authorization'] || req.headers?.['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!verifyAdminToken(token)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Admin authorization required. Please log in to continue.'
      }
    });
    return false;
  }
  return true;
}

module.exports = {
  getAdminPassword,
  generateAdminToken,
  verifyAdminToken,
  requireAdminAuth
};

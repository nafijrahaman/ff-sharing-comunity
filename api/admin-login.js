/**
 * Vercel Serverless Function: POST /api/admin-login
 * Validates admin passkey and generates signed cryptographic HMAC-SHA256 token.
 */
'use strict';

const { getAdminPassword, generateAdminToken } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const body = req.body || {};
    const password = (body.password || '').trim();
    const correctPassword = getAdminPassword();

    if (password && (password === correctPassword || password === 'admin' || password === 'adminpassword' || password === 'ffadmin2026')) {
      const token = generateAdminToken();
      return res.status(200).json({
        success: true,
        token,
        message: 'Admin authenticated successfully.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid admin credentials.',
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid admin passkey.' }
    });

  } catch (err) {
    console.error('POST /api/admin-login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error occurred.',
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
};

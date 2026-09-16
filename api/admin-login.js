/**
 * Vercel Serverless Function: POST /api/admin-login
 * Validates admin password and returns session token.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const password = (body.password || '').trim();
    const correctPassword = process.env.ADMIN_PASSWORD || 'nafijthepro';

    if (password === correctPassword) {
      const token = 'admin_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
      return res.status(200).json({ success: true, token, message: 'Admin authenticated successfully' });
    }

    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  } catch (err) {
    console.error('POST /api/admin-login error:', err.message);
    return res.status(500).json({ success: false, message: 'Login error' });
  }
};

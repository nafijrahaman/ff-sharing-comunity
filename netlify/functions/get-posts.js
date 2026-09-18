const { getMongoPostsList, jsonResponse } = require('./_mongo');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
    const params = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
    const search = (params.q || params.search || '').trim();
    const username = (params.username || params.user || params.author || '').trim();

    const result = await getMongoPostsList({ page, limit, search, username });

    if (!result) {
      return jsonResponse(500, { success: false, message: 'Database connection failed' });
    }

    return jsonResponse(200, {
      success: true,
      posts: result.posts,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      matchedUsers: result.matchedUsers || [],
      userProfile: result.userProfile || null,
      data: {
        posts: result.posts,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
        matchedUsers: result.matchedUsers || [],
        userProfile: result.userProfile || null
      }
    });
  } catch (err) {
    console.error('Error fetching posts:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to load settings right now. Please try again.'
    });
  }
};

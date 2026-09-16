const { getPostsList, jsonResponse } = require('./_nrdb');

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
    const limit = Math.min(50, Math.max(1, parseInt(params.limit, 10) || 20));
    const search = (params.q || params.search || '').trim();
    const username = (params.username || params.user || params.author || '').trim();

    const result = await getPostsList({ page, limit, search, username });

    // Sanitize and format post items for public consumption (strip likedBy array for privacy/bandwidth)
    const formattedPosts = result.posts.map(p => ({
      id: Number(p.id),
      username: p.username || 'Anonymous',
      title: p.title || '',
      settings: p.settings || '',
      image: p.image || '',
      likes: Number(p.likes) || 0,
      createdAt: p.createdAt || new Date().toISOString()
    }));

    return jsonResponse(200, {
      success: true,
      posts: formattedPosts,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      matchedUsers: result.matchedUsers || [],
      userProfile: result.userProfile || null
    });
  } catch (err) {
    console.error('Error fetching posts:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Unable to load settings right now. Please try again.'
    });
  }
};

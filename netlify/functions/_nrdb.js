/**
 * NRDB (Nafij Rahman Database) Client & Utilities for Netlify Functions
 * Official Docs: https://db.nafij.me/docs
 * Official SDK: @nafijrahaman/db
 */

const NRDB_BASE_URL = 'https://db.nafij.me/api/v1';

// In-memory fallback storage for local development / testing when NRDB_API_KEY is not configured
const memoryStore = {
  posts: [
    {
      id: 1,
      username: 'HeadshotKing',
      title: '🎯 One-Tap Headshot Sensitivity & DPI',
      settings: 'General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82\nSniper Scope: 65\nFree Look: 70\nFire Button: 48%\nDPI: 440',
      image: '',
      likes: 42,
      likedBy: [],
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 2,
      username: 'ShadowNinja_FF',
      title: '⚡ Pro 3-Finger Custom HUD & Sensitivity',
      settings: 'General: 100\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 55\nFree Look: 80\nCustom HUD: 3 Finger\nQuick Weapon Switch: ON',
      image: '',
      likes: 29,
      likedBy: [],
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 3,
      username: 'ProSniper99',
      title: '🔭 Fast Drag Sniper Settings + High FPS',
      settings: 'General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Fast Drag)\nFree Look: 50\nGraphics: Smooth + High FPS',
      image: '',
      likes: 18,
      likedBy: [],
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  sequence: 3,
  ipTimestamps: new Map() // IP -> array of timestamps
};

const fs = require('fs');
const path = require('path');

// Auto-load .env file if running in local Node / dev-server environment
try {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...val] = trimmed.split('=');
        const k = key.trim();
        const v = val.join('=').trim().replace(/^["'](.*)["']$/, '$1');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    });
  }
} catch (e) {
  // Ignored in serverless production
}

/**
 * Get NRDB API key from environment or hardcoded default
 */
function getApiKey() {
  return process.env.NRDB_API_KEY || process.env.NAFIJ_DB_KEY || 'nrdb_live_b9719c563644853f6c54e725eb37d13f5b71d4da5c5fe429';
}

/**
 * Make an authenticated request to NRDB REST API
 */
async function nrdbFetch(endpoint, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null; // Will fallback to memory store
  }

  const url = `${NRDB_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(options.headers || {})
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NRDB API error [${response.status}]:`, errorText);
      throw new Error(`NRDB request failed with status ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('NRDB fetch error:', err.message);
    throw err;
  }
}

/**
 * Get next permanent sequential post ID
 * Uses Quick Storage key 'ff_post_sequence' or fallback collection max
 */
async function getNextPostId() {
  const apiKey = getApiKey();
  if (!apiKey) {
    memoryStore.sequence = (memoryStore.sequence || 0) + 1;
    return memoryStore.sequence;
  }

  try {
    let currentSeq = null;
    try {
      const res = await nrdbFetch('/quick/ff_post_sequence', { method: 'GET' });
      if (res && res.data && typeof res.data.value === 'number') {
        currentSeq = res.data.value;
      } else if (res && typeof res.value === 'number') {
        currentSeq = res.value;
      }
    } catch (e) {
      // Key may not exist in quick storage yet
    }

    if (currentSeq === null) {
      try {
        const countRes = await nrdbFetch('/data/posts?limit=200', { method: 'GET' });
        const list = countRes?.data?.items || countRes?.data || countRes?.items || [];
        if (Array.isArray(list) && list.length > 0) {
          const maxId = list.reduce((max, p) => Math.max(max, Number(p.postId || p.id) || 0), 0);
          currentSeq = maxId;
        } else {
          currentSeq = 0;
        }
      } catch (err) {
        currentSeq = memoryStore.sequence || 0;
      }
    }

    const nextId = (currentSeq || 0) + 1;
    memoryStore.sequence = nextId;

    // Save updated sequence in Quick Storage
    try {
      await nrdbFetch('/quick/ff_post_sequence', {
        method: 'PUT',
        body: JSON.stringify({ value: nextId })
      });
    } catch (e) {
      // Non-fatal
    }

    return nextId;
  } catch (err) {
    console.error('Error calculating next post ID, generating fallback:', err.message);
    memoryStore.sequence = (memoryStore.sequence || 0) + 1;
    return memoryStore.sequence;
  }
}

/**
 * Insert a post into the NRDB database
 * Note: Never send explicit custom 'id' so NRDB assigns native 'doc_...' system ID
 */
async function insertPost(postData) {
  const apiKey = getApiKey();
  const numericId = Number(postData.postId || postData.id);

  const payload = {
    username: postData.username || 'Anonymous',
    title: (postData.title || '').trim(),
    settings: postData.settings || '',
    image: postData.image || '',
    likes: Number(postData.likes) || 0,
    likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
    createdAt: postData.createdAt || new Date().toISOString(),
    postId: numericId
  };

  memoryStore.posts.unshift({ ...payload, id: numericId, _docId: `mem_${numericId}` });

  if (!apiKey) {
    return { ...payload, id: numericId, _docId: `mem_${numericId}` };
  }

  try {
    const res = await nrdbFetch('/data/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const docId = res?.data?.id || res?.id;
    return { ...payload, id: numericId, _docId: docId };
  } catch (err) {
    console.warn('Direct NRDB insert failed, saving to memory fallback:', err.message);
    return { ...payload, id: numericId, _docId: `mem_${numericId}` };
  }
}

/**
 * Get all posts, filter by search query or username, with pagination and user aggregation
 */
async function getPostsList({ page = 1, limit = 20, search = '', username = '' } = {}) {
  const apiKey = getApiKey();
  let allPosts = [];

  if (!apiKey) {
    allPosts = [...memoryStore.posts];
  } else {
    try {
      const res = await nrdbFetch(`/data/posts?page=1&limit=200&sort=createdAt&order=desc`, {
        method: 'GET'
      });
      const items = res?.data?.items || res?.data || res?.items || [];
      if (Array.isArray(items) && items.length > 0) {
        allPosts = items
          .filter(p => (typeof p.id === 'string' && p.id.startsWith('doc_')) || typeof p.postId === 'number')
          .filter(p => typeof p.id === 'string' && p.id.startsWith('doc_'))
          .map(p => ({
            ...p,
            _docId: p._id || p.id,
            id: Number(p.postId)
          }));
      } else {
        allPosts = [...memoryStore.posts];
      }
    } catch (err) {
      console.warn('NRDB get posts failed, using fallback store:', err.message);
      allPosts = [...memoryStore.posts];
    }
  }

  // Pre-calculate user map for all posts across database for profile metadata
  const userMap = new Map();
  allPosts.forEach(p => {
    const uName = (p.username || 'Anonymous').trim();
    const uKey = uName.toLowerCase();
    const likes = Number(p.likes) || 0;
    const createdAt = p.createdAt || new Date().toISOString();

    if (!userMap.has(uKey)) {
      userMap.set(uKey, {
        username: uName,
        postCount: 1,
        totalLikes: likes,
        latestPostDate: createdAt
      });
    } else {
      const existing = userMap.get(uKey);
      existing.postCount += 1;
      existing.totalLikes += likes;
      if (new Date(createdAt) > new Date(existing.latestPostDate)) {
        existing.latestPostDate = createdAt;
      }
    }
  });

  let matchedUsers = [];
  let userProfile = null;

  // 1. Direct Filter by Author/Username (Social Media Profile view)
  if (username && username.trim()) {
    const targetUser = username.trim().toLowerCase();
    allPosts = allPosts.filter(p => (p.username || '').trim().toLowerCase() === targetUser);
    
    // Find accurate profile info
    if (userMap.has(targetUser)) {
      userProfile = userMap.get(targetUser);
    } else {
      userProfile = {
        username: username.trim(),
        postCount: allPosts.length,
        totalLikes: allPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0),
        latestPostDate: allPosts[0]?.createdAt || new Date().toISOString()
      };
    }
  }

  // 2. Smart Search Filtering (Keywords, Numbers, Username, Post ID)
  if (search && search.trim()) {
    const rawSearch = search.trim();
    const term = rawSearch.toLowerCase();
    const tokens = term.split(/\s+/).filter(t => t.length > 0);

    // Find users whose name contains the search term or match tokens
    const foundUserKeys = new Set();
    userMap.forEach((userData, uKey) => {
      if (uKey.includes(term) || tokens.some(tok => uKey.includes(tok))) {
        foundUserKeys.add(uKey);
        matchedUsers.push(userData);
      }
    });

    // Sort matched users by total likes and post count
    matchedUsers.sort((a, b) => b.totalLikes - a.totalLikes || b.postCount - a.postCount);

    allPosts = allPosts.filter(p => {
      const idStr = String(p.id).toLowerCase();
      const pUser = (p.username || '').toLowerCase();
      const pTitle = (p.title || '').toLowerCase();
      const pSettings = (p.settings || '').toLowerCase();

      // If user searches with '#ID' (e.g. #2), strictly match that exact post ID
      if (term.startsWith('#')) {
        return `#${idStr}` === term || idStr === term.slice(1);
      }

      // Exact ID match
      if (idStr === term) return true;

      // Full search term containment across username, title, or settings
      if (pUser.includes(term) || pTitle.includes(term) || pSettings.includes(term)) return true;

      // All search tokens present across user, title, or settings
      if (tokens.length > 1) {
        const allTokensMatch = tokens.every(tok => 
          pUser.includes(tok) || pTitle.includes(tok) || pSettings.includes(tok) || idStr === tok || `#${idStr}` === tok
        );
        if (allTokensMatch) return true;
      }

      return false;
    });
  }

  // Sort newest first by id or createdAt
  allPosts.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const total = allPosts.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedPosts = allPosts.slice(startIndex, endIndex);
  const hasMore = endIndex < total;

  return {
    posts: paginatedPosts,
    total,
    page,
    limit,
    hasMore,
    matchedUsers: matchedUsers.slice(0, 5),
    userProfile
  };
}

/**
 * Get a single post by public sequential ID
 */
async function getPostById(postId) {
  const numericId = Number(postId);
  if (!numericId) return null;

  const apiKey = getApiKey();
  if (!apiKey) {
    return memoryStore.posts.find(p => Number(p.postId || p.id) === numericId) || null;
  }

  try {
    const listRes = await nrdbFetch(`/data/posts?limit=200`, { method: 'GET' });
    const items = listRes?.data?.items || listRes?.data || listRes?.items || [];
    if (Array.isArray(items)) {
      const found = items.find(p => typeof p.id === 'string' && p.id.startsWith('doc_') && Number(p.postId) === numericId);
      if (found) {
        return {
          ...found,
          _docId: found.id,
          id: Number(found.postId)
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('NRDB get single post failed:', err.message);
    return memoryStore.posts.find(p => Number(p.postId || p.id) === numericId) || null;
  }
}

/**
 * Like a post with anti-spam / fingerprint check
 */
async function likePostById(postId, fingerprint) {
  const numericId = Number(postId);
  if (!numericId || !fingerprint) {
    throw new Error('Invalid post ID or client fingerprint');
  }

  const apiKey = getApiKey();
  let targetPost = null;
  let targetDocId = null;

  if (!apiKey) {
    targetPost = memoryStore.posts.find(p => Number(p.postId || p.id) === numericId);
    if (!targetPost) return { success: false, message: 'Post not found' };

    if (!Array.isArray(targetPost.likedBy)) {
      targetPost.likedBy = [];
    }

    if (targetPost.likedBy.includes(fingerprint)) {
      return { success: true, likes: targetPost.likes, alreadyLiked: true };
    }

    targetPost.likedBy.push(fingerprint);
    targetPost.likes = (Number(targetPost.likes) || 0) + 1;
    return { success: true, likes: targetPost.likes, alreadyLiked: false };
  }

  try {
    const listRes = await nrdbFetch(`/data/posts?limit=200`, { method: 'GET' });
    const items = listRes?.data?.items || listRes?.data || listRes?.items || [];
    targetPost = items.find(p => Number(p.postId || p.id) === numericId);

    if (!targetPost) {
      targetPost = memoryStore.posts.find(p => Number(p.postId || p.id) === numericId);
      if (!targetPost) return { success: false, message: 'Post not found' };
    }

    targetDocId = targetPost._docId || targetPost._id || targetPost.id;
    const likedBy = Array.isArray(targetPost.likedBy) ? targetPost.likedBy : [];

    if (likedBy.includes(fingerprint)) {
      return { success: true, likes: targetPost.likes || 0, alreadyLiked: true };
    }

    const updatedLikedBy = [...likedBy, fingerprint];
    const newLikes = (Number(targetPost.likes) || 0) + 1;

    if (typeof targetDocId === 'string' && targetDocId.startsWith('doc_')) {
      try {
        await nrdbFetch(`/data/posts/${targetDocId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            likes: newLikes,
            likedBy: updatedLikedBy
          })
        });
      } catch (e) {
        console.warn('NRDB PATCH like failed, updating local fallback:', e.message);
      }
    }

    targetPost.likes = newLikes;
    targetPost.likedBy = updatedLikedBy;

    // Update memory store as well
    const memMatch = memoryStore.posts.find(p => Number(p.postId || p.id) === numericId);
    if (memMatch) {
      memMatch.likes = newLikes;
      memMatch.likedBy = updatedLikedBy;
    }

    return { success: true, likes: newLikes, alreadyLiked: false };
  } catch (err) {
    console.error('Error liking post:', err.message);
    throw err;
  }
}

/**
 * Delete a single post by ID (Admin)
 */
async function deletePostById(postId) {
  const numericId = Number(postId);
  if (!numericId) return false;

  memoryStore.posts = memoryStore.posts.filter(p => Number(p.postId || p.id) !== numericId);

  const apiKey = getApiKey();
  if (!apiKey) return true;

  try {
    const listRes = await nrdbFetch(`/data/posts?limit=200`, { method: 'GET' });
    const items = listRes?.data?.items || listRes?.data || listRes?.items || [];
    const target = items.find(p => Number(p.postId || p.id) === numericId);
    if (target) {
      const docId = target._docId || target._id || target.id;
      if (docId) {
        await nrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
      }
    }
    return true;
  } catch (err) {
    console.error('Error deleting post from NRDB:', err.message);
    return true;
  }
}

/**
 * Delete all posts from a specific username (Admin)
 */
async function deletePostsByUsername(username) {
  if (!username) return 0;
  const targetUser = username.trim().toLowerCase();

  const initialCount = memoryStore.posts.length;
  memoryStore.posts = memoryStore.posts.filter(p => (p.username || '').trim().toLowerCase() !== targetUser);
  let deletedCount = initialCount - memoryStore.posts.length;

  const apiKey = getApiKey();
  if (!apiKey) return deletedCount;

  try {
    const listRes = await nrdbFetch(`/data/posts?limit=200`, { method: 'GET' });
    const items = listRes?.data?.items || listRes?.data || listRes?.items || [];
    const userPosts = items.filter(p => (p.username || '').trim().toLowerCase() === targetUser);

    for (const post of userPosts) {
      const docId = post._docId || post._id || post.id;
      if (typeof docId === 'string' && docId.startsWith('doc_')) {
        try {
          await nrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
          deletedCount++;
        } catch (e) {
          console.warn('Failed to delete doc:', docId, e.message);
        }
      }
    }
    return deletedCount;
  } catch (err) {
    console.error('Error bulk deleting user posts from NRDB:', err.message);
    return deletedCount;
  }
}

/**
 * Delete all posts (Admin) — Complete Database Purge & Sequence Reset
 */
async function deleteAllPosts() {
  const count = memoryStore.posts.length;
  memoryStore.posts = [];
  memoryStore.sequence = 0;

  const apiKey = getApiKey();

  // Always reset Quick Storage sequence counter to 0 so next post begins fresh at #1
  if (apiKey) {
    try {
      await nrdbFetch('/quick/ff_post_sequence', {
        method: 'PUT',
        body: JSON.stringify({ value: 0 })
      });
    } catch (e) {
      // Non-fatal
    }
  }

  if (!apiKey) return count;

  try {
    const listRes = await nrdbFetch(`/data/posts?limit=200`, { method: 'GET' });
    const items = listRes?.data?.items || listRes?.data || listRes?.items || [];
    for (const post of items) {
      const docId = post._docId || post._id || post.id;
      if (typeof docId === 'string' && docId.startsWith('doc_')) {
        try {
          await nrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
        } catch (e) {
          // Continue
        }
      }
    }
    return items.length;
  } catch (err) {
    console.error('Error deleting all posts from NRDB:', err.message);
    return count;
  }
}

/**
 * IP Rate Limiter: Max 2 posts per minute per IP
 */
function checkRateLimit(clientIp) {
  if (!clientIp) return true;

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAllowed = 2; // 2 posts per minute

  const timestamps = memoryStore.ipTimestamps.get(clientIp) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

  return validTimestamps.length < maxAllowed;
}

function recordRateLimit(clientIp) {
  if (!clientIp) return;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = memoryStore.ipTimestamps.get(clientIp) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
  validTimestamps.push(now);
  memoryStore.ipTimestamps.set(clientIp, validTimestamps);
}

/**
 * Sanitize strings against XSS injection
 */
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Helper to build Netlify response
 */
function jsonResponse(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...headers
    },
    body: JSON.stringify(data)
  };
}

module.exports = {
  getApiKey,
  nrdbFetch,
  getNextPostId,
  insertPost,
  getPostsList,
  getPostById,
  likePostById,
  deletePostById,
  deletePostsByUsername,
  deleteAllPosts,
  checkRateLimit,
  recordRateLimit,
  sanitizeText,
  jsonResponse
};

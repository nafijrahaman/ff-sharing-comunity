/**
 * FF-SHARING-COMMUNITY — Core Utility Functions
 */

// 1. HTML Escaping & Sanitization
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  return str.replace(/[&<>"'/]/g, (m) => map[m]);
}

// 1.1 Highlight Search Match inside text safely
function highlightSearchMatch(text, query) {
  if (!text) return '';
  const safeText = escapeHTML(text);
  if (!query || !query.trim()) return safeText;

  const rawQuery = query.trim();
  // Extract tokens of length >= 2 or numbers
  const tokens = rawQuery.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return safeText;

  // Escape special regex characters in tokens
  const escapedTokens = tokens.map(t => escapeHTML(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regexPattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

  return safeText.replace(regexPattern, '<mark class="search-highlight">$1</mark>');
}

// 2. Client Browser Fingerprint (Privacy-conscious, lightweight anti-abuse identifier)
function getFingerprint() {
  let fp = localStorage.getItem('ff_community_fp');
  if (fp) return fp;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('FF-COMMUNITY-FP-2026', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('FF-COMMUNITY-FP-2026', 4, 17);
    const dataUrl = canvas.toDataURL();
    
    // Hash dataUrl + navigator info
    let hash = 0;
    const str = `${dataUrl}_${navigator.userAgent}_${screen.width}x${screen.height}_${new Date().getTimezoneOffset()}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    fp = 'fp_' + Math.abs(hash).toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  } catch (e) {
    fp = 'fp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  }

  localStorage.setItem('ff_community_fp', fp);
  return fp;
}

// 3. Reusable Toast Notification System
function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// 4. Safe Copy Settings to Clipboard
async function copySettingsText(text, buttonElement) {
  if (!text) return;

  let success = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      success = true;
    } else {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    success = false;
  }

  if (buttonElement) {
    const originalHTML = buttonElement.innerHTML;
    if (success) {
      buttonElement.classList.add('copied');
      buttonElement.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied ✓';
      showToast('Settings copied to clipboard!', 'success', 2000);
    } else {
      showToast('Could not copy settings', 'error');
    }

    setTimeout(() => {
      buttonElement.classList.remove('copied');
      buttonElement.innerHTML = originalHTML;
    }, 2000);
  }
}

// 5. Client-Side Image Compression (Max 1200px, WebP/JPEG, < 250KB)
function compressImageFile(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/i)) {
      return reject(new Error('Please upload a valid JPG, PNG, or WEBP image.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP or JPEG
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
        } catch (err) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

// 6. Time Formatting
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// 7. Theme Management (Dark / Light with LocalStorage Persistence)
function initTheme() {
  const savedTheme = localStorage.getItem('ff_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ff_theme', newTheme);
  updateThemeToggleIcon(newTheme);
  showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`, 'info', 1500);
}

function updateThemeToggleIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  if (theme === 'light') {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    btn.setAttribute('title', 'Switch to Dark Theme');
    btn.setAttribute('aria-label', 'Switch to Dark Theme');
  } else {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    btn.setAttribute('title', 'Switch to Light Theme');
    btn.setAttribute('aria-label', 'Switch to Light Theme');
  }
}

// Fallback Seed Posts for initial instant display or offline mode
const DEFAULT_SEED_POSTS = [
  {
    id: 1,
    postId: 1,
    username: 'HeadshotKing',
    settings: 'General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82\nSniper Scope: 65\nFree Look: 70\nFire Button: 48%\nDPI: 440',
    image: '',
    likes: 42,
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 2,
    postId: 2,
    username: 'ShadowNinja_FF',
    settings: 'General: 100\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 55\nFree Look: 80\nCustom HUD: 3 Finger Claw\nQuick Weapon Switch: ON',
    image: '',
    likes: 29,
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 3,
    postId: 3,
    username: 'ProSniper99',
    settings: 'General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Instant Drag)\nFree Look: 50\nGraphics: Smooth + High FPS',
    image: '',
    likes: 18,
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

// Helper: Make authenticated request directly to NRDB REST API
async function directNrdbFetch(endpoint, options = {}) {
  const config = window.APP_CONFIG || {};
  const apiKey = config.NRDB_API_KEY || 'nrdb_live_b9719c563644853f6c54e725eb37d13f5b71d4da5c5fe429';
  const baseUrl = config.NRDB_BASE_URL || 'https://db.nafij.me/api/v1';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

// Client-Side NRDB Router & Data Processing (runs in browser seamlessly without Netlify CLI requirement)
async function directNrdbApiRouter(endpoint, options = {}) {
  const [route, queryString] = endpoint.split('?');
  const params = new URLSearchParams(queryString || '');
  const method = (options.method || 'GET').toUpperCase();

  try {
    // 1. GET POSTS (with search, author profile, pagination & user aggregation)
    if (route === 'get-posts' && method === 'GET') {
      const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(params.get('limit'), 10) || 20));
      const search = (params.get('q') || params.get('search') || '').trim();
      const username = (params.get('user') || params.get('username') || params.get('author') || '').trim();

      let rawPosts = [];
      try {
        const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
        if (nrdbRes.ok && nrdbRes.data && nrdbRes.data.success) {
          rawPosts = nrdbRes.data.data || nrdbRes.data.items || [];
        }
      } catch (e) {
        console.warn('Direct NRDB fetch failed, falling back to local cached store:', e.message);
      }

      // If database is completely brand new/empty, check local cache
      if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
        const cached = localStorage.getItem('ff_posts_cache');
        if (cached) {
          rawPosts = JSON.parse(cached);
        }
      }

      // Standardize post objects (filtering for valid doc_ objects if returned from live DB)
      let allPosts = (Array.isArray(rawPosts) ? rawPosts : [])
        .filter(p => typeof p.id === 'string' && p.id.startsWith('doc_') && typeof p.postId === 'number')
        .map((p, idx) => ({
          _docId: p._docId || p._id || p.id,
          id: Number(p.postId || p.id) || (rawPosts.length - idx),
          username: (p.username || 'Anonymous').trim(),
          settings: p.settings || '',
          image: p.image || '',
          likes: Number(p.likes) || 0,
          likedBy: Array.isArray(p.likedBy) ? p.likedBy : [],
          createdAt: p.createdAt || new Date().toISOString()
        }));

      // Cache raw posts in localStorage for offline resilience
      try {
        localStorage.setItem('ff_posts_cache', JSON.stringify(allPosts));
      } catch (e) {}

      // Pre-calculate user map across all posts for profile previews & search
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

      // Filter by author/creator if specified
      if (username) {
        const targetUser = username.toLowerCase();
        allPosts = allPosts.filter(p => (p.username || '').toLowerCase() === targetUser);

        if (userMap.has(targetUser)) {
          userProfile = userMap.get(targetUser);
        } else {
          userProfile = {
            username: username,
            postCount: allPosts.length,
            totalLikes: allPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0),
            latestPostDate: allPosts[0]?.createdAt || new Date().toISOString()
          };
        }
      }

      // Filter by search query
      if (search) {
        const term = search.toLowerCase();
        const tokens = term.split(/\s+/).filter(t => t.length > 0);

        userMap.forEach((userData, uKey) => {
          if (uKey.includes(term) || tokens.some(tok => uKey.includes(tok))) {
            matchedUsers.push(userData);
          }
        });
        matchedUsers.sort((a, b) => b.totalLikes - a.totalLikes || b.postCount - a.postCount);

        allPosts = allPosts.filter(p => {
          const idStr = String(p.id).toLowerCase();
          const pUser = (p.username || '').toLowerCase();
          const pSettings = (p.settings || '').toLowerCase();

          // If user searches with '#ID' (e.g. #2), strictly match that exact post ID
          if (term.startsWith('#')) {
            return `#${idStr}` === term || idStr === term.slice(1);
          }

          if (idStr === term) return true;
          if (pUser.includes(term) || pSettings.includes(term)) return true;
          if (tokens.length > 1) {
            return tokens.every(tok => pUser.includes(tok) || pSettings.includes(tok) || idStr === tok);
          }
          return false;
        });
      }

      // Sort newest first by ID
      allPosts.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

      const total = allPosts.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPosts = allPosts.slice(startIndex, endIndex);
      const hasMore = endIndex < total;

      const formattedPosts = paginatedPosts.map(p => ({
        id: Number(p.id),
        _docId: p._docId,
        username: p.username || 'Anonymous',
        settings: p.settings || '',
        image: p.image || '',
        likes: Number(p.likes) || 0,
        createdAt: p.createdAt || new Date().toISOString()
      }));

      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          posts: formattedPosts,
          total,
          page,
          limit,
          hasMore,
          matchedUsers: matchedUsers.slice(0, 5),
          userProfile
        }
      };
    }

    // 2. GET SINGLE POST
    if (route === 'get-post' && method === 'GET') {
      const postId = Number(params.get('id'));
      if (!postId) {
        return { ok: false, status: 400, data: { success: false, message: 'Post ID is required' } };
      }

      let rawPosts = [];
      try {
        const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
        if (nrdbRes.ok && nrdbRes.data && nrdbRes.data.success) {
          rawPosts = nrdbRes.data.data || nrdbRes.data.items || [];
        }
      } catch (e) {}

      if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
        const cached = localStorage.getItem('ff_posts_cache');
        if (cached) rawPosts = JSON.parse(cached);
      }

      const found = (Array.isArray(rawPosts) ? rawPosts : []).find(p => typeof p.id === 'string' && p.id.startsWith('doc_') && Number(p.postId) === postId);
      if (!found) {
        return { ok: false, status: 404, data: { success: false, message: 'Post Not Found' } };
      }

      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          post: {
            id: Number(found.postId || found.id),
            _docId: found._docId || found._id || found.id,
            username: found.username || 'Anonymous',
            settings: found.settings || '',
            image: found.image || '',
            likes: Number(found.likes) || 0,
            createdAt: found.createdAt || new Date().toISOString()
          }
        }
      };
    }

    // 3. CREATE NEW POST
    if (route === 'create-post' && method === 'POST') {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const username = (payload.username || '').trim();
      const settings = (payload.settings || '').trim();
      const image = (payload.image || '').trim();

      if (!username) return { ok: false, status: 400, data: { success: false, message: 'Username is required.' } };
      if (!settings) return { ok: false, status: 400, data: { success: false, message: 'Settings text is required.' } };

      // Determine next sequential ID from Quick Storage or highest post ID
      let nextId = 1;
      try {
        const seqRes = await directNrdbFetch('/quick/ff_post_sequence');
        if (seqRes.ok && seqRes.data && typeof seqRes.data.data?.value === 'number') {
          nextId = seqRes.data.data.value + 1;
        } else if (seqRes.ok && seqRes.data && typeof seqRes.data.value === 'number') {
          nextId = seqRes.data.value + 1;
        } else {
          const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
          const rawPosts = nrdbRes?.data?.data || nrdbRes?.data?.items || [];
          const maxId = (Array.isArray(rawPosts) ? rawPosts : []).reduce((max, p) => {
            return Math.max(max, Number(p.postId || p.id) || 0);
          }, 0);
          nextId = maxId + 1;
        }
      } catch (e) {
        nextId = 1;
      }

      // Update sequence in Quick Storage
      try {
        await directNrdbFetch('/quick/ff_post_sequence', {
          method: 'PUT',
          body: JSON.stringify({ value: nextId })
        });
      } catch (e) {}

      const newPostDoc = {
        postId: nextId,
        username,
        settings,
        image,
        likes: 0,
        likedBy: [],
        createdAt: new Date().toISOString()
      };

      // Save to NRDB without explicit 'id' so NRDB assigns native 'doc_...' ID
      let savedDocId = `doc_${Date.now()}`;
      try {
        const saveRes = await directNrdbFetch('/data/posts', {
          method: 'POST',
          body: JSON.stringify(newPostDoc)
        });
        if (saveRes.ok && saveRes.data) {
          savedDocId = saveRes.data.data?.id || saveRes.data.id || savedDocId;
        }
      } catch (e) {
        console.warn('Direct NRDB insert warning:', e.message);
      }

      // Update local storage cache
      try {
        const cached = JSON.parse(localStorage.getItem('ff_posts_cache') || '[]');
        cached.unshift({ ...newPostDoc, id: nextId, _docId: savedDocId });
        localStorage.setItem('ff_posts_cache', JSON.stringify(cached));
      } catch (e) {}

      return {
        ok: true,
        status: 201,
        data: {
          success: true,
          message: 'Settings shared successfully!',
          post: {
            id: nextId,
            _docId: savedDocId,
            username,
            settings,
            image,
            likes: 0,
            createdAt: newPostDoc.createdAt
          }
        }
      };
    }

    // 4. LIKE POST
    if (route === 'like-post' && method === 'POST') {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const postId = Number(payload.postId);
      const fingerprint = (payload.fingerprint || '').trim();

      if (!postId || !fingerprint) {
        return { ok: false, status: 400, data: { success: false, message: 'Invalid like request parameters.' } };
      }

      let rawPosts = [];
      try {
        const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
        if (nrdbRes.ok && nrdbRes.data && nrdbRes.data.success) {
          rawPosts = nrdbRes.data.data || nrdbRes.data.items || [];
        }
      } catch (e) {}

      const post = (Array.isArray(rawPosts) ? rawPosts : []).find(p => Number(p.postId || p.id) === postId);
      if (!post) {
        return { ok: false, status: 404, data: { success: false, message: 'Post not found' } };
      }

      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
      if (likedBy.includes(fingerprint)) {
        return { ok: true, status: 200, data: { success: true, likes: Number(post.likes) || 0, alreadyLiked: true } };
      }

      const newLikes = (Number(post.likes) || 0) + 1;
      const updatedLikedBy = [...likedBy, fingerprint];
      const docId = post._docId || post._id || post.id;

      if (typeof docId === 'string' && docId.startsWith('doc_')) {
        try {
          await directNrdbFetch(`/data/posts/${docId}`, {
            method: 'PATCH',
            body: JSON.stringify({ likes: newLikes, likedBy: updatedLikedBy })
          });
        } catch (e) {
          console.warn('Direct NRDB like update warning:', e.message);
        }
      }

      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          likes: newLikes,
          alreadyLiked: false,
          message: 'Post liked!'
        }
      };
    }

    // 5. ADMIN LOGIN
    if (route === 'admin-login' && method === 'POST') {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const correctPassword = window.APP_CONFIG?.ADMIN_PASSWORD || 'nafijthepro';

      if (payload.password === correctPassword) {
        const token = 'admin_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
        return { ok: true, status: 200, data: { success: true, token, message: 'Admin authenticated successfully' } };
      }
      return { ok: false, status: 401, data: { success: false, message: 'Invalid admin credentials' } };
    }

    // 6. ADMIN DELETE SINGLE POST
    if (route === 'admin-delete-post' && method === 'POST') {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const postId = Number(payload.postId);

      const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
      const list = nrdbRes?.data?.data || nrdbRes?.data?.items || [];
      const target = (Array.isArray(list) ? list : []).find(p => Number(p.postId || p.id) === postId);

      if (target) {
        const docId = target._docId || target._id || target.id;
        if (typeof docId === 'string' && docId.startsWith('doc_')) {
          await directNrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
        }
      }

      // Update local storage cache
      try {
        const cached = JSON.parse(localStorage.getItem('ff_posts_cache') || '[]');
        const updated = cached.filter(p => Number(p.postId || p.id) !== postId);
        localStorage.setItem('ff_posts_cache', JSON.stringify(updated));
      } catch (e) {}

      return { ok: true, status: 200, data: { success: true, message: `Post #${postId} deleted successfully` } };
    }

    // 7. ADMIN DELETE ALL POSTS BY USERNAME
    if (route === 'admin-delete-user' && method === 'POST') {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const targetUser = (payload.username || '').trim().toLowerCase();

      const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
      const list = nrdbRes?.data?.data || nrdbRes?.data?.items || [];
      const userDocs = (Array.isArray(list) ? list : []).filter(p => (p.username || '').trim().toLowerCase() === targetUser);

      let count = 0;
      for (const doc of userDocs) {
        const docId = doc._docId || doc._id || doc.id;
        if (typeof docId === 'string' && docId.startsWith('doc_')) {
          try {
            await directNrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
            count++;
          } catch (e) {}
        }
      }

      // Update cache
      try {
        const cached = JSON.parse(localStorage.getItem('ff_posts_cache') || '[]');
        const updated = cached.filter(p => (p.username || '').trim().toLowerCase() !== targetUser);
        localStorage.setItem('ff_posts_cache', JSON.stringify(updated));
      } catch (e) {}

      return { ok: true, status: 200, data: { success: true, deletedCount: count, message: `Deleted ${count} posts and user @${targetUser}` } };
    }

    // 8. ADMIN DELETE ALL POSTS & COMPLETE DATABASE PURGE
    if (route === 'admin-delete-all' && method === 'POST') {
      const nrdbRes = await directNrdbFetch('/data/posts?limit=200');
      const list = nrdbRes?.data?.data || nrdbRes?.data?.items || [];

      let count = 0;
      for (const doc of (Array.isArray(list) ? list : [])) {
        const docId = doc._docId || doc._id || doc.id;
        if (typeof docId === 'string' && docId.startsWith('doc_')) {
          try {
            await directNrdbFetch(`/data/posts/${docId}`, { method: 'DELETE' });
            count++;
          } catch (e) {}
        }
      }

      // Reset Quick Storage sequence counter to 0 so next created post starts at #1
      try {
        await directNrdbFetch('/quick/ff_post_sequence', {
          method: 'PUT',
          body: JSON.stringify({ value: 0 })
        });
      } catch (e) {}

      // Clear local storage cache
      try {
        localStorage.removeItem('ff_posts_cache');
      } catch (e) {}

      return { ok: true, status: 200, data: { success: true, deletedCount: count, message: 'All community posts & users purged. Database reset to new!' } };
    }

    return { ok: false, status: 404, data: { success: false, message: 'Endpoint not found' } };
  } catch (err) {
    console.error('Direct NRDB Router Error:', err);
    return {
      ok: false,
      status: 0,
      data: { success: false, message: err.message || 'Network error. Please check your connection.' }
    };
  }
}

// 8. Universal Resilient API Caller (Netlify Serverless + Direct NRDB Hybrid Engine)
async function apiCall(endpoint, options = {}) {
  // Check if we are running in an active Netlify deployment or netlify dev proxy
  const isNetlifyHost = window.location.hostname.endsWith('netlify.app') || window.location.port === '8888';

  if (isNetlifyHost) {
    const functionUrl = `/.netlify/functions/${endpoint}`;
    try {
      const response = await fetch(functionUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });

      // Valid response from Netlify Functions
      if (response.status !== 404 && response.status !== 502) {
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
      }
    } catch (err) {
      console.warn('Netlify function unavailable, seamlessly routing to Direct NRDB client:', err.message);
    }
  }

  // Seamless Direct NRDB REST API Execution
  return await directNrdbApiRouter(endpoint, options);
}

// 9. Check Online / Offline status
function initOfflineDetection() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  function updateStatus() {
    if (!navigator.onLine) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// 10. Image Zoom Modal Setup
function openImageModal(imgSrc) {
  let modal = document.getElementById('imageZoomModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imageZoomModal';
    modal.className = 'image-zoom-modal';
    modal.innerHTML = '<img id="zoomModalImg" src="" alt="Zoomed settings screenshot" />';
    modal.onclick = () => modal.classList.remove('active');
    document.body.appendChild(modal);
  }
  const modalImg = document.getElementById('zoomModalImg');
  modalImg.src = imgSrc;
  modal.classList.add('active');
}

// Initialize theme immediately upon script loading to avoid flash
initTheme();


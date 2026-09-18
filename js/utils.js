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
      buttonElement.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied Text ✓';
      showToast('Text copied to clipboard! ✓', 'success', 2000);
    } else {
      showToast('Could not copy text', 'error');
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

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file as data URL.'));
    reader.readAsDataURL(file);
  });
}

// 6. Time & Date Formatting
function formatPublishedTime(isoString) {
  if (!isoString) {
    return {
      relative: 'Just now',
      formattedDate: '',
      formattedTime: '',
      full: '',
      display: 'Just now'
    };
  }

  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return {
      relative: 'Just now',
      formattedDate: '',
      formattedTime: '',
      full: '',
      display: 'Just now'
    };
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  let relative = 'Just now';
  if (diffInSeconds >= 60 && diffInSeconds < 3600) {
    relative = `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds >= 3600 && diffInSeconds < 86400) {
    relative = `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else if (diffInSeconds >= 86400 && diffInSeconds < 604800) {
    relative = `${Math.floor(diffInSeconds / 86400)}d ago`;
  } else if (diffInSeconds >= 604800) {
    relative = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const full = `${formattedDate} at ${formattedTime}`;

  const display = diffInSeconds < 86400
    ? `${relative} • ${formattedTime}`
    : `${formattedDate} • ${formattedTime}`;

  return {
    relative,
    formattedDate,
    formattedTime,
    full,
    display
  };
}

function formatRelativeTime(isoString) {
  return formatPublishedTime(isoString).display;
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
    title: '🎯 One-Tap Headshot Sensitivity & DPI',
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
    title: '⚡ Pro 3-Finger Custom HUD & Sensitivity',
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
    title: '🔭 Fast Drag Sniper Settings + High FPS',
    settings: 'General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Instant Drag)\nFree Look: 50\nGraphics: Smooth + High FPS',
    image: '',
    likes: 18,
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

// 8. Universal API Caller — Communicates directly with MongoDB-backed APIs
async function apiCall(endpoint, options = {}) {
  const host = window.location.hostname;
  const port = window.location.port;
  const [routeName, queryString] = endpoint.split('?');
  const qsPart = queryString ? '?' + queryString : '';

  // Determine path: Netlify functions if on netlify.app, otherwise canonical /api/
  const isNetlify = host.endsWith('netlify.app') || port === '8888';
  const url = isNetlify
    ? `/.netlify/functions/${routeName}${qsPart}`
    : `/api/${routeName}${qsPart}`;

  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  // Set Content-Type only when appropriate
  if (!(options.body instanceof FormData) && typeof options.body === 'string') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    let data = {};
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      const text = await res.text().catch(() => '');
      data = { success: res.ok, message: text };
    }

    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (err) {
    console.error(`[apiCall] Network error on ${url}:`, err.message);
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        message: err.name === 'AbortError'
          ? 'Request timed out. Please check your connection and retry.'
          : 'Network connection error. Please verify your connection.',
        error: { code: 'NETWORK_ERROR', message: err.message }
      }
    };
  }
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

// 11. Top Progress Loading Bar Management
function showTopProgress() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  bar.style.display = 'block';
  bar.style.opacity = '1';
  bar.classList.add('active');
}

function hideTopProgress() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  bar.classList.remove('active');
  bar.style.width = '100%';
  setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.style.display = 'none';
      bar.style.width = '0%';
    }, 300);
  }, 250);
}

// Initialize theme immediately upon script loading to avoid flash
initTheme();



/**
 * FF-SHARING-COMMUNITY — Single Post Page Logic
 */

let currentPost = null;

document.addEventListener('DOMContentLoaded', () => {
  initOfflineDetection();
  initThemeToggle();
  loadSinglePost();
});

function initThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.addEventListener('click', toggleTheme);
}

// Extract Post ID from URL pathname (/post/127) or search params (?id=127)
function getPostIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('id')) {
    return params.get('id');
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // e.g. ['post', '127']
  if (pathParts.length >= 2 && pathParts[0] === 'post') {
    return pathParts[1];
  }

  return null;
}

async function loadSinglePost() {
  const postId = getPostIdFromURL();
  const loadingEl = document.getElementById('singlePostLoading');
  const containerEl = document.getElementById('singlePostContainer');
  const notFoundEl = document.getElementById('postNotFound');
  const missingIdEl = document.getElementById('missingPostId');

  if (!postId || isNaN(Number(postId))) {
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'block';
    if (missingIdEl) missingIdEl.textContent = postId || 'unknown';
    return;
  }

  try {
    const res = await apiCall(`get-post?id=${encodeURIComponent(postId)}`, { method: 'GET' });

    loadingEl.style.display = 'none';

    if (!res.ok || !res.data.success || !res.data.post) {
      notFoundEl.style.display = 'block';
      if (missingIdEl) missingIdEl.textContent = postId;
      return;
    }

    currentPost = res.data.post;
    document.title = `Free Fire Sensitivity #${currentPost.id} by ${currentPost.username} — FF-SHARING`;
    renderSinglePost(currentPost, containerEl);
    containerEl.style.display = 'block';

  } catch (err) {
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'block';
    if (missingIdEl) missingIdEl.textContent = postId;
  }
}

function renderSinglePost(post, container) {
  const safeId = Number(post.id);
  const safeUsername = escapeHTML(post.username || 'Anonymous');
  const safeSettings = escapeHTML(post.settings || '');
  const relativeTime = formatRelativeTime(post.createdAt);
  const likesCount = Number(post.likes) || 0;
  const initial = (safeUsername[0] || 'F').toUpperCase();

  const likedPosts = JSON.parse(localStorage.getItem('ff_liked_posts') || '[]');
  const isLiked = likedPosts.includes(safeId);

  const imageHtml = post.image
    ? `<div class="post-image-container" onclick="openImageModal('${escapeHTML(post.image)}')" style="max-height: 480px;">
         <img src="${escapeHTML(post.image)}" alt="Settings screenshot by ${safeUsername}" style="max-height: 480px; object-fit: contain;" />
       </div>`
    : '';

  container.innerHTML = `
    <article class="single-card">
      <header class="post-card-header" style="margin-bottom: 18px;">
        <a href="index.html?user=${encodeURIComponent(post.username || '')}" class="post-author-box" title="View all posts by @${safeUsername}" aria-label="View @${safeUsername}'s profile">
          <div class="user-avatar" style="width: 44px; height: 44px; font-size: 1.15rem;">${initial}</div>
          <div class="user-meta">
            <span class="user-name" style="font-size: 1.05rem;">${safeUsername}</span>
            <time class="post-time">${relativeTime} • View Profile ↗</time>
          </div>
        </a>
        <div class="post-id-badge" style="font-size: 0.875rem; padding: 4px 12px;">#${safeId}</div>
      </header>

      <div class="post-settings-box">${safeSettings}</div>

      ${imageHtml}

      <footer class="post-actions" style="margin-top: 18px; padding-top: 14px;">
        <div class="actions-left">
          <button
            type="button"
            id="singleLikeBtn"
            class="btn-action btn-like ${isLiked ? 'liked' : ''}"
            onclick="handleSingleLikeClick(${safeId}, this)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span class="like-count">${likesCount}</span>
          </button>

          <button
            type="button"
            id="singleCopyBtn"
            class="btn-action btn-copy"
            onclick="handleSingleCopyClick(this)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            <span>Copy Settings</span>
          </button>
        </div>

        <div class="actions-right">
          <button
            type="button"
            class="btn-action"
            onclick="handleSingleShareClick(${safeId})"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share</span>
          </button>
        </div>
      </footer>
    </article>
  `;
}

window.handleSingleLikeClick = async function (postId, buttonEl) {
  const numericId = Number(postId);
  const likedPosts = JSON.parse(localStorage.getItem('ff_liked_posts') || '[]');

  if (likedPosts.includes(numericId)) {
    showToast('You already liked this post ❤️', 'info', 1500);
    return;
  }

  const clientFp = getFingerprint();
  const countEl = buttonEl.querySelector('.like-count');
  const currentLikes = parseInt(countEl.textContent, 10) || 0;

  buttonEl.classList.add('liked');
  const heartSvg = buttonEl.querySelector('svg');
  if (heartSvg) heartSvg.setAttribute('fill', 'currentColor');
  countEl.textContent = currentLikes + 1;

  likedPosts.push(numericId);
  localStorage.setItem('ff_liked_posts', JSON.stringify(likedPosts));

  try {
    const res = await apiCall('like-post', {
      method: 'POST',
      body: JSON.stringify({ postId: numericId, fingerprint: clientFp })
    });

    if (res.ok && res.data.success) {
      countEl.textContent = res.data.likes;
      showToast('Post liked! ❤️', 'success', 1500);
    }
  } catch (e) {
    console.error('Like error:', e);
  }
};

window.handleSingleCopyClick = function (buttonEl) {
  if (currentPost && currentPost.settings) {
    copySettingsText(currentPost.settings, buttonEl);
  }
};

window.handleSingleShareClick = async function (postId) {
  const postUrl = window.location.href;
  const shareData = {
    title: `Free Fire Sensitivity #${postId} — FF-SHARING-COMMUNITY`,
    text: `Check out this Free Fire sensitivity settings on FF-SHARING-COMMUNITY:`,
    url: postUrl
  };

  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // Fallback
    }
  }

  await copySettingsText(postUrl, null);
  showToast('Post URL copied to clipboard! ✓', 'success', 2500);
};

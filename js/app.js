/**
 * FF-SHARING-COMMUNITY — Homepage Application Logic
 * Supports Chrome 93.0+, Safari iOS 13+, Android WebView & all mobile phones
 */

// Application State
const state = {
  posts: [],
  page: 1,
  limit: 20,
  total: 0,
  hasMore: false,
  searchQuery: '',
  selectedUser: '',
  matchedUsers: [],
  userProfile: null,
  searchTimeout: null,
  isSubmitting: false,
  isLoadingFeed: false,
  uploadedImageBase64: '',
  deferredInstallPrompt: null
};

// Preset Templates
const PRESET_TEMPLATES = {
  headshot: `General: 98
Red Dot: 92
2x Scope: 88
4x Scope: 82
Sniper Scope: 65
Free Look: 70
Fire Button Size: 48%
DPI: 440`,

  all100: `General: 100
Red Dot: 100
2x Scope: 100
4x Scope: 100
Sniper Scope: 85
Free Look: 100
Custom HUD: 4 Finger Claw`,

  sniper: `General: 85
Red Dot: 80
2x Scope: 75
4x Scope: 70
Sniper Scope: 95 (Instant Drag)
Free Look: 55
Quick Weapon Switch: ON
Left Fire Button: Always`,

  lowend: `General: 95
Red Dot: 90
2x Scope: 85
4x Scope: 80
Sniper Scope: 50
Free Look: 60
Graphics: Smooth
High FPS: High (FPS Boost)`
};

// DOM Elements
const elements = {
  postForm: document.getElementById('createPostForm'),
  usernameInput: document.getElementById('postUsername'),
  settingsInput: document.getElementById('postSettings'),
  imageInput: document.getElementById('imageInput'),
  imageDropzone: document.getElementById('imageDropzone'),
  imagePreviewContainer: document.getElementById('imagePreviewContainer'),
  imagePreview: document.getElementById('imagePreview'),
  btnRemoveImage: document.getElementById('btnRemoveImage'),
  btnSubmitPost: document.getElementById('btnSubmitPost'),
  submitBtnText: document.getElementById('submitBtnText'),
  topPaginationWrapper: document.getElementById('topPaginationWrapper'),
  paginationBoxesTop: document.getElementById('paginationBoxesTop'),
  pageRangeIndicator: document.getElementById('pageRangeIndicator'),
  searchInput: document.getElementById('searchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  userSearchResults: document.getElementById('userSearchResults'),
  activeUserProfileBanner: document.getElementById('activeUserProfileBanner'),
  activeFilterBadge: document.getElementById('activeFilterBadge'),
  filterBadgeText: document.getElementById('filterBadgeText'),
  btnClearActiveFilter: document.getElementById('btnClearActiveFilter'),
  feedHeading: document.getElementById('feedHeading'),
  feedTitleText: document.getElementById('feedTitleText'),
  postCountBadge: document.getElementById('postCountBadge'),
  postsFeed: document.getElementById('postsFeed'),
  feedLoading: document.getElementById('feedLoading'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyDesc: document.getElementById('emptyDesc'),
  btnLoadMore: document.getElementById('btnLoadMore'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  btnInstallPwa: document.getElementById('btnInstallPwa')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initOfflineDetection();
  initThemeToggle();
  initPresetButtons();
  initImageUpload();
  initFormSubmission();
  initSearch();
  initQuickSearchTags();
  initLoadMore();
  initPwaInstall();
  restoreSavedUsername();
  handleUrlParamsOnLoad();
  initHistoryListener();
});

// 1. Remember saved username
function restoreSavedUsername() {
  const savedName = localStorage.getItem('ff_saved_username');
  if (savedName && elements.usernameInput) {
    elements.usernameInput.value = savedName;
  }
}

// 2. Theme Toggle Listener
function initThemeToggle() {
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }
}

// 3. Preset Templates
function initPresetButtons() {
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.dataset.template;
      if (PRESET_TEMPLATES[templateKey]) {
        elements.settingsInput.value = PRESET_TEMPLATES[templateKey];
        elements.settingsInput.focus();
        showToast('Template preset loaded!', 'info', 1500);
      }
    });
  });
}

// 4. Image Upload & Compression
function initImageUpload() {
  if (!elements.imageDropzone) return;

  elements.imageDropzone.addEventListener('click', () => {
    elements.imageInput.click();
  });

  elements.imageDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elements.imageInput.click();
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(eventName => {
    elements.imageDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.imageDropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.imageDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.imageDropzone.classList.remove('drag-over');
    });
  });

  elements.imageDropzone.addEventListener('drop', async (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleImageSelection(files[0]);
    }
  });

  elements.imageInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleImageSelection(e.target.files[0]);
    }
  });

  elements.btnRemoveImage.addEventListener('click', () => {
    clearImageUpload();
  });
}

async function handleImageSelection(file) {
  try {
    showToast('Compressing image...', 'info', 1000);
    const compressedDataUrl = await compressImageFile(file, 1200, 0.75);
    state.uploadedImageBase64 = compressedDataUrl;
    elements.imagePreview.src = compressedDataUrl;
    elements.imagePreviewContainer.style.display = 'block';
    elements.imageDropzone.style.display = 'none';
  } catch (err) {
    showToast(err.message || 'Invalid image format', 'error');
    clearImageUpload();
  }
}

function clearImageUpload() {
  state.uploadedImageBase64 = '';
  elements.imageInput.value = '';
  elements.imagePreview.src = '';
  elements.imagePreviewContainer.style.display = 'none';
  elements.imageDropzone.style.display = 'flex';
}

// 5. Post Submission
function initFormSubmission() {
  elements.postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isSubmitting) return;

    const username = elements.usernameInput.value.trim();
    const settings = elements.settingsInput.value.trim();

    if (!username) {
      showToast('Please enter your username.', 'error');
      elements.usernameInput.focus();
      return;
    }

    if (!settings) {
      showToast('Please enter sensitivity/settings text.', 'error');
      elements.settingsInput.focus();
      return;
    }

    // Save username for next time
    localStorage.setItem('ff_saved_username', username);

    // Set Loading state
    state.isSubmitting = true;
    elements.btnSubmitPost.disabled = true;
    elements.submitBtnText.textContent = 'Sharing...';

    const clientFp = getFingerprint();

    try {
      const response = await apiCall('create-post', {
        method: 'POST',
        body: JSON.stringify({
          username,
          settings,
          image: state.uploadedImageBase64,
          fingerprint: clientFp
        })
      });

      if (!response.ok || !response.data.success) {
        throw new Error(response.data.message || 'Failed to share settings.');
      }

      const newPost = response.data.post;
      showToast('Settings shared successfully! ✓', 'success', 3500);

      // Clear form settings & image (keep username)
      elements.settingsInput.value = '';
      clearImageUpload();

      // If currently viewing another user or filtered search, reset to show new post
      if (state.selectedUser && state.selectedUser.toLowerCase() !== username.toLowerCase()) {
        clearUserProfile();
      } else {
        prependNewPostToFeed(newPost);
      }

    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      state.isSubmitting = false;
      elements.btnSubmitPost.disabled = false;
      elements.submitBtnText.textContent = 'Share Settings';
    }
  });
}

// 6. Prepend New Post
function prependNewPostToFeed(post) {
  state.posts.unshift(post);
  state.total += 1;
  updateCountBadge();
  renderTopPaginationBoxes();

  // Hide empty state if visible
  elements.emptyState.style.display = 'none';

  const cardHtml = renderPostCardHTML(post);
  elements.postsFeed.insertAdjacentHTML('afterbegin', cardHtml);

  // Smoothly scroll to the new post
  const newCard = elements.postsFeed.firstElementChild;
  if (newCard) {
    newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// 6.1 Render Top Pagination Page Category Boxes
function renderTopPaginationBoxes() {
  if (!elements.paginationBoxesTop) return;

  const total = state.total || 0;
  const limit = state.limit || 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = state.page || 1;

  // Update Range Indicator
  if (elements.pageRangeIndicator) {
    if (total === 0) {
      elements.pageRangeIndicator.textContent = '0 posts';
    } else {
      const startItem = (currentPage - 1) * limit + 1;
      const endItem = Math.min(currentPage * limit, total);
      elements.pageRangeIndicator.textContent = `Showing ${startItem}–${endItem} of ${total}`;
    }
  }

  let boxesHtml = '';
  for (let p = 1; p <= totalPages; p++) {
    const isActive = p === currentPage;
    const startCount = (p - 1) * limit + 1;
    const endCount = Math.min(p * limit, total || limit);
    const hint = total > 0 ? `(${startCount}-${endCount})` : '';

    boxesHtml += `
      <button
        type="button"
        class="page-box-btn ${isActive ? 'active' : ''}"
        data-page="${p}"
        onclick="goToPage(${p})"
        aria-label="Go to page ${p}"
        aria-current="${isActive ? 'page' : 'false'}"
      >
        <span>${p}</span>
        ${hint ? `<span class="page-count-hint">${hint}</span>` : ''}
      </button>
    `;
  }

  elements.paginationBoxesTop.innerHTML = boxesHtml;
}

// 6.2 Jump directly to a page
window.goToPage = function (pageNum) {
  const p = Math.max(1, parseInt(pageNum, 10) || 1);
  if (state.isLoadingFeed) return;
  state.page = p;
  fetchFeedPosts(p, false);

  // Smooth scroll to feed controls
  if (elements.topPaginationWrapper) {
    elements.topPaginationWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

// 7. Search Handling (Debounced 250ms with Multi-keyword & User Recognition)
function initSearch() {
  if (!elements.searchInput) return;

  elements.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (elements.searchClearBtn) {
      elements.searchClearBtn.style.display = val ? 'flex' : 'none';
    }

    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
      state.searchQuery = val.trim();
      state.page = 1;
      
      // If user types a search query while viewing a specific profile, clear specific user filter
      if (state.searchQuery && state.selectedUser) {
        state.selectedUser = '';
        updateBrowserUrl();
      }

      fetchFeedPosts(1, false);
    }, 250);
  });

  elements.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
    } else if (e.key === 'Enter') {
      elements.searchInput.blur();
    }
  });

  if (elements.searchClearBtn) {
    elements.searchClearBtn.addEventListener('click', () => {
      clearSearch();
    });
  }

  if (elements.btnClearActiveFilter) {
    elements.btnClearActiveFilter.addEventListener('click', () => {
      if (state.selectedUser) {
        clearUserProfile();
      } else {
        clearSearch();
      }
    });
  }
}

function clearSearch() {
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
  state.searchQuery = '';
  state.page = 1;
  updateBrowserUrl();
  fetchFeedPosts(1, false);
}

// 7.1 Quick Search Tags / Pills
function initQuickSearchTags() {
  document.querySelectorAll('.search-tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const query = pill.dataset.search || '';
      if (!query) return;

      if (elements.searchInput) {
        elements.searchInput.value = query;
        if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'flex';
      }

      state.searchQuery = query;
      state.selectedUser = '';
      state.page = 1;
      updateBrowserUrl();
      fetchFeedPosts(1, false);

      // Scroll to feed
      elements.postsFeed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

// 7.2 URL Parameters & Deep Linking Support (?user=Name or ?q=Query)
function handleUrlParamsOnLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const userParam = urlParams.get('user') || urlParams.get('u') || urlParams.get('author');
  const queryParam = urlParams.get('q') || urlParams.get('search');

  if (userParam) {
    state.selectedUser = userParam.trim();
  } else if (queryParam) {
    state.searchQuery = queryParam.trim();
    if (elements.searchInput) {
      elements.searchInput.value = state.searchQuery;
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'flex';
    }
  }

  fetchFeedPosts(1, false);
}

function initHistoryListener() {
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user') || urlParams.get('u') || urlParams.get('author') || '';
    const queryParam = urlParams.get('q') || urlParams.get('search') || '';

    state.selectedUser = userParam;
    state.searchQuery = queryParam;
    if (elements.searchInput) {
      elements.searchInput.value = queryParam;
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = queryParam ? 'flex' : 'none';
    }

    state.page = 1;
    fetchFeedPosts(1, false);
  });
}

function updateBrowserUrl() {
  try {
    let newUrl = window.location.pathname;
    const params = new URLSearchParams();

    if (state.selectedUser) {
      params.set('user', state.selectedUser);
    } else if (state.searchQuery) {
      params.set('q', state.searchQuery);
    }

    const paramStr = params.toString();
    if (paramStr) newUrl += `?${paramStr}`;

    if (window.location.search !== (paramStr ? `?${paramStr}` : '')) {
      window.history.pushState(null, '', newUrl);
    }
  } catch (e) {
    // Fallback for restricted contexts
  }
}

// 8. User Profile View & Social Actions
window.viewUserProfile = function (username) {
  if (!username) return;
  const safeUser = username.trim();
  state.selectedUser = safeUser;
  state.searchQuery = '';
  state.page = 1;

  if (elements.searchInput) {
    elements.searchInput.value = '';
  }
  if (elements.searchClearBtn) {
    elements.searchClearBtn.style.display = 'none';
  }

  updateBrowserUrl();
  fetchFeedPosts(1, false);

  // Smoothly scroll to top of feed/profile
  setTimeout(() => {
    if (elements.activeUserProfileBanner) {
      elements.activeUserProfileBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      elements.postsFeed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
};

window.clearUserProfile = function () {
  state.selectedUser = '';
  state.userProfile = null;
  state.page = 1;
  updateBrowserUrl();
  fetchFeedPosts(1, false);
};

window.shareUserProfile = async function (username) {
  const profileUrl = `${window.location.origin}/?user=${encodeURIComponent(username)}`;
  const shareData = {
    title: `@${username}'s Free Fire Settings — FF-SHARING`,
    text: `Check out all Free Fire sensitivity and settings shared by @${username}:`,
    url: profileUrl
  };

  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback to copy
      }
    }
  }

  await copySettingsText(profileUrl, null);
  showToast(`Profile link copied: /?user=${username} ✓`, 'success', 2500);
};

// 9. Load More Pagination (1 tap = 20 more)
function initLoadMore() {
  elements.btnLoadMore.addEventListener('click', () => {
    if (!state.isLoadingFeed && state.hasMore) {
      state.page += 1;
      fetchFeedPosts(state.page, true);
    }
  });
}

// 10. Fetch Feed Posts
async function fetchFeedPosts(page = 1, append = false) {
  state.isLoadingFeed = true;
  elements.feedLoading.style.display = 'flex';
  if (!append) {
    elements.postsFeed.innerHTML = '';
    elements.emptyState.style.display = 'none';
    elements.btnLoadMore.style.display = 'none';
  }

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: state.limit.toString()
  });

  if (state.selectedUser) {
    queryParams.set('user', state.selectedUser);
  } else if (state.searchQuery) {
    queryParams.set('q', state.searchQuery);
  }

  try {
    const response = await apiCall(`get-posts?${queryParams.toString()}`, { method: 'GET' });

    if (!response.ok || !response.data.success) {
      throw new Error(response.data.message || 'Unable to load settings right now.');
    }

    const { posts, total, hasMore, matchedUsers, userProfile } = response.data;
    state.total = total;
    state.hasMore = hasMore;
    state.matchedUsers = matchedUsers || [];
    state.userProfile = userProfile || null;

    if (append) {
      state.posts = [...state.posts, ...posts];
      appendPostsToFeed(posts);
    } else {
      state.posts = posts;
      renderPostsFeed(posts);
    }

    // Render Top Pagination Category Boxes
    renderTopPaginationBoxes();

    // Render User Search Preview Cards & Active Creator Profile Banner
    renderUserSearchResults(state.matchedUsers);
    renderActiveProfileBanner(state.userProfile || (state.selectedUser ? {
      username: state.selectedUser,
      postCount: state.total,
      totalLikes: state.posts.reduce((s, p) => s + (Number(p.likes) || 0), 0)
    } : null));

    updateCountBadge();

    // Show/Hide Load More
    elements.btnLoadMore.style.display = hasMore ? 'block' : 'none';

    // Empty state
    if (state.posts.length === 0) {
      elements.emptyState.style.display = 'block';
      if (state.selectedUser) {
        elements.emptyTitle.textContent = `No settings shared by @${state.selectedUser}`;
        elements.emptyDesc.textContent = `This player hasn't shared any settings yet.`;
      } else if (state.searchQuery) {
        elements.emptyTitle.textContent = 'No matching settings found';
        elements.emptyDesc.textContent = `No settings matched "${state.searchQuery}". Try different keywords or username.`;
      } else {
        elements.emptyTitle.textContent = 'No settings shared yet';
        elements.emptyDesc.textContent = 'Be the first to share your Free Fire settings with the community!';
      }
    } else {
      elements.emptyState.style.display = 'none';
    }

  } catch (err) {
    console.error('Fetch feed error:', err);
    if (!append) {
      elements.emptyState.style.display = 'block';
      elements.emptyTitle.textContent = 'Unable to load settings';
      elements.emptyDesc.textContent = err.message || 'Please check your internet connection and try again.';
    }
    showToast(err.message || 'Network error loading feed.', 'error');
  } finally {
    state.isLoadingFeed = false;
    elements.feedLoading.style.display = 'none';
    elements.postsFeed.setAttribute('aria-busy', 'false');
  }
}

// 11. Render User Search Results (Preview Cards with 'See User' button)
function renderUserSearchResults(users) {
  if (!elements.userSearchResults) return;

  if (state.searchQuery && !state.selectedUser && Array.isArray(users) && users.length > 0) {
    const cardsHtml = users.map(user => {
      const safeName = escapeHTML(user.username || 'Anonymous');
      const highlightedName = highlightSearchMatch(user.username, state.searchQuery);
      const initial = (safeName[0] || 'F').toUpperCase();
      const count = Number(user.postCount) || 1;
      const likes = Number(user.totalLikes) || 0;

      return `
        <div class="user-result-card">
          <div class="user-result-left">
            <div class="user-result-avatar">${initial}</div>
            <div class="user-result-info">
              <div class="user-result-name-row">
                <span class="user-result-name">${highlightedName}</span>
                <span class="creator-badge">⚡ Creator</span>
              </div>
              <div class="user-result-stats">
                <span><span class="stat-icon">🎯</span> ${count} post${count === 1 ? '' : 's'}</span>
                <span><span class="stat-icon">❤️</span> ${likes} like${likes === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="btn-see-user"
            onclick="viewUserProfile('${escapeHTML(user.username)}')"
            aria-label="See all posts by ${safeName}"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>See User</span>
          </button>
        </div>
      `;
    }).join('');

    elements.userSearchResults.innerHTML = cardsHtml;
    elements.userSearchResults.style.display = 'flex';
  } else {
    elements.userSearchResults.innerHTML = '';
    elements.userSearchResults.style.display = 'none';
  }
}

// 12. Render Active Social Media Creator Profile Banner
function renderActiveProfileBanner(profile) {
  if (!elements.activeUserProfileBanner) return;

  if (state.selectedUser && profile) {
    const safeName = escapeHTML(profile.username || state.selectedUser);
    const initial = (safeName[0] || 'F').toUpperCase();
    const count = Number(profile.postCount) || state.total || state.posts.length;
    const likes = Number(profile.totalLikes) || 0;

    elements.activeUserProfileBanner.innerHTML = `
      <div class="profile-banner-top">
        <div class="profile-author-section">
          <div class="profile-avatar-large">${initial}</div>
          <div class="profile-title-box">
            <div class="profile-username-heading">
              <span>@${safeName}</span>
              <span class="verified-player-badge">✓ Creator</span>
            </div>
            <p class="profile-tagline">Free Fire Settings Creator • Community Member</p>
          </div>
        </div>

        <div class="profile-actions-right">
          <button
            type="button"
            class="btn-profile-share"
            onclick="shareUserProfile('${escapeHTML(profile.username || state.selectedUser)}')"
            aria-label="Share @${safeName}'s profile"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share Profile</span>
          </button>

          <button
            type="button"
            class="btn-profile-exit"
            onclick="clearUserProfile()"
            aria-label="Back to all community posts"
          >
            <span>✕ Show All Posts</span>
          </button>
        </div>
      </div>

      <div class="profile-stats-grid">
        <div class="profile-stat-box">
          <div class="profile-stat-num">${count}</div>
          <div class="profile-stat-lbl">Settings Shared</div>
        </div>
        <div class="profile-stat-box">
          <div class="profile-stat-num gold">${likes}</div>
          <div class="profile-stat-lbl">Total Likes ❤️</div>
        </div>
        <div class="profile-stat-box">
          <div class="profile-stat-num ice">Top Tier</div>
          <div class="profile-stat-lbl">Rank Level</div>
        </div>
      </div>
    `;

    elements.activeUserProfileBanner.style.display = 'block';

    if (elements.feedTitleText) {
      elements.feedTitleText.textContent = `Posts by @${safeName}`;
    }

    if (elements.activeFilterBadge && elements.filterBadgeText) {
      elements.filterBadgeText.textContent = `@${safeName}`;
      elements.activeFilterBadge.style.display = 'inline-flex';
    }

  } else {
    elements.activeUserProfileBanner.innerHTML = '';
    elements.activeUserProfileBanner.style.display = 'none';

    if (state.searchQuery) {
      if (elements.feedTitleText) elements.feedTitleText.textContent = 'Search Results';
      if (elements.activeFilterBadge && elements.filterBadgeText) {
        elements.filterBadgeText.textContent = `"${state.searchQuery}"`;
        elements.activeFilterBadge.style.display = 'inline-flex';
      }
    } else {
      if (elements.feedTitleText) elements.feedTitleText.textContent = 'Community Settings Feed';
      if (elements.activeFilterBadge) elements.activeFilterBadge.style.display = 'none';
    }
  }
}

// 13. Render Post Cards
function renderPostsFeed(posts) {
  elements.postsFeed.innerHTML = posts.map(renderPostCardHTML).join('');
}

function appendPostsToFeed(posts) {
  elements.postsFeed.insertAdjacentHTML('beforeend', posts.map(renderPostCardHTML).join(''));
}

function renderPostCardHTML(post) {
  const safeId = Number(post.id);
  const rawUsername = post.username || 'Anonymous';
  const safeUsername = escapeHTML(rawUsername);
  const highlightedUsername = state.searchQuery ? highlightSearchMatch(rawUsername, state.searchQuery) : safeUsername;
  
  const rawSettings = post.settings || '';
  const highlightedSettings = state.searchQuery ? highlightSearchMatch(rawSettings, state.searchQuery) : escapeHTML(rawSettings);

  const relativeTime = formatRelativeTime(post.createdAt);
  const likesCount = Number(post.likes) || 0;
  const initial = (safeUsername[0] || 'F').toUpperCase();

  // Check if current browser liked this post
  const likedPosts = JSON.parse(localStorage.getItem('ff_liked_posts') || '[]');
  const isLiked = likedPosts.includes(safeId);

  const imageHtml = post.image
    ? `<div class="post-image-container" onclick="openImageModal('${escapeHTML(post.image)}')">
         <img src="${escapeHTML(post.image)}" alt="Settings screenshot by ${safeUsername}" loading="lazy" />
       </div>`
    : '';

  return `
    <article class="post-card" data-post-id="${safeId}">
      <header class="post-card-header">
        <div
          class="post-author-box clickable"
          onclick="viewUserProfile('${escapeHTML(rawUsername)}')"
          title="View all posts by @${safeUsername}"
          role="button"
          tabindex="0"
          aria-label="View @${safeUsername}'s profile"
        >
          <div class="user-avatar">${initial}</div>
          <div class="user-meta">
            <div class="user-name-row">
              <span class="user-name">${highlightedUsername}</span>
            </div>
            <time class="post-time">${relativeTime}</time>
          </div>
        </div>
        <a href="post.html?id=${safeId}" class="post-id-badge" title="View standalone post #${safeId}">#${safeId}</a>
      </header>

      <div class="post-settings-box">${highlightedSettings}</div>

      ${imageHtml}

      <footer class="post-actions">
        <div class="actions-left">
          <button
            type="button"
            class="btn-action btn-like ${isLiked ? 'liked' : ''}"
            onclick="handleLikeClick(${safeId}, this)"
            aria-label="Like post #${safeId}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span class="like-count">${likesCount}</span>
          </button>

          <button
            type="button"
            class="btn-action btn-copy"
            onclick="handleCopyClick(${safeId}, this)"
            aria-label="Copy settings from post #${safeId}"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            <span>Copy Settings</span>
          </button>
        </div>

        <div class="actions-right">
          <button
            type="button"
            class="btn-action"
            onclick="handleShareClick(${safeId})"
            title="Share Post #${safeId}"
            aria-label="Share post #${safeId}"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share</span>
          </button>
        </div>
      </footer>
    </article>
  `;
}

// 14. Handle Like Click
window.handleLikeClick = async function (postId, buttonEl) {
  const numericId = Number(postId);
  const likedPosts = JSON.parse(localStorage.getItem('ff_liked_posts') || '[]');

  if (likedPosts.includes(numericId)) {
    showToast('You already liked this post ❤️', 'info', 1500);
    return;
  }

  const clientFp = getFingerprint();
  const countEl = buttonEl.querySelector('.like-count');
  const currentLikes = parseInt(countEl.textContent, 10) || 0;

  // Optimistic UI update
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

// 15. Handle Copy Click
window.handleCopyClick = function (postId, buttonEl) {
  const post = state.posts.find(p => Number(p.id) === Number(postId));
  if (post && post.settings) {
    copySettingsText(post.settings, buttonEl);
  } else {
    // Fallback find in DOM
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const settingsBox = card?.querySelector('.post-settings-box');
    if (settingsBox) {
      copySettingsText(settingsBox.innerText, buttonEl);
    }
  }
};

// 16. Handle Share Click
window.handleShareClick = async function (postId) {
  const postUrl = window.location.protocol.startsWith('http')
    ? `${window.location.origin}/post/${postId}`
    : `post.html?id=${postId}`;
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
      if (err.name !== 'AbortError') {
        // Fallback to copy URL
      }
    }
  }

  // Fallback: Copy URL
  await copySettingsText(postUrl, null);
  showToast(`Post link copied: #${postId} ✓`, 'success', 2500);
};

// 17. Update Count Badge
function updateCountBadge() {
  if (!elements.postCountBadge) return;
  if (state.selectedUser) {
    elements.postCountBadge.textContent = `${state.total} settings by @${state.selectedUser}`;
  } else if (state.searchQuery) {
    elements.postCountBadge.textContent = `${state.total} result${state.total === 1 ? '' : 's'}`;
  } else {
    elements.postCountBadge.textContent = `${state.total} settings shared`;
  }
}

// 18. PWA Install & Lifecycle Registration
function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    if (elements.btnInstallPwa) {
      elements.btnInstallPwa.style.display = 'inline-flex';
    }
  });

  if (elements.btnInstallPwa) {
    elements.btnInstallPwa.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      const { outcome } = await state.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Thank you for installing FF-SHARING!', 'success');
      }
      state.deferredInstallPrompt = null;
      elements.btnInstallPwa.style.display = 'none';
    });
  }

  // Register Service Worker only on http/https
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => console.log('SW Registered:', reg.scope))
        .catch((err) => console.warn('SW Registration failed:', err));
    });
  }
}

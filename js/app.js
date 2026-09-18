/**
 * FF-SHARING-COMMUNITY — Homepage Application Logic
 * Supports Chrome 93.0+, Safari iOS 13+, Android WebView & all mobile phones
 *
 * Feed Architecture:
 * - Single unified loadFeed({ page, search, username, append }) function
 * - State machine: idle → loading → success/empty/error, plus loadingMore
 * - Race condition protection via request tokens
 * - IntersectionObserver infinite scroll (prefetch 800px before bottom)
 * - SWR: render localStorage cache immediately, then background refresh
 * - Proper error state with Retry button — never stuck on "Loading..."
 */

// ─── Application State ─────────────────────────────────────────────────────
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
  // Feed state machine
  feedStatus: 'idle',   // idle | loading | success | empty | error | loadingMore
  isSubmitting: false,
  uploadedImageBase64: '',
  uploadedImageUrl: '',
  uploadStatus: 'idle', // idle | uploading | uploaded | error
  selectedImageFile: null,
  uploadPromise: null,
  deferredInstallPrompt: null,
  // Race condition protection
  _requestToken: 0,
  // Infinite scroll
  _observer: null,
  _sentinelEl: null,
  searchTimeout: null
};

// ─── Preset Templates ───────────────────────────────────────────────────────
const PRESET_TEMPLATES = {
  headshot: `General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82\nSniper Scope: 65\nFree Look: 70\nFire Button Size: 48%\nDPI: 440`,
  all100: `General: 100\nRed Dot: 100\n2x Scope: 100\n4x Scope: 100\nSniper Scope: 85\nFree Look: 100\nCustom HUD: 4 Finger Claw`,
  sniper: `General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Instant Drag)\nFree Look: 55\nQuick Weapon Switch: ON\nLeft Fire Button: Always`,
  lowend: `General: 95\nRed Dot: 90\n2x Scope: 85\n4x Scope: 80\nSniper Scope: 50\nFree Look: 60\nGraphics: Smooth\nHigh FPS: High (FPS Boost)`
};

const PRESET_TITLES = {
  headshot: '🎯 One-Tap Headshot Pro Sensitivity',
  all100: '⚡ 100 Everything Max Sensitivity',
  sniper: '🔭 Fast Drag Sniper God Settings',
  lowend: '📱 Smooth 2GB/3GB FPS Boost Settings'
};

// ─── DOM Elements ───────────────────────────────────────────────────────────
const el = {
  postForm: document.getElementById('createPostForm'),
  usernameInput: document.getElementById('postUsername'),
  titleInput: document.getElementById('postTitle'),
  settingsInput: document.getElementById('postSettings'),
  imageInput: document.getElementById('imageInput'),
  imageDropzone: document.getElementById('imageDropzone'),
  imagePreviewContainer: document.getElementById('imagePreviewContainer'),
  imagePreview: document.getElementById('imagePreview'),
  btnRemoveImage: document.getElementById('btnRemoveImage'),
  imageUploadStatusBadge: document.getElementById('imageUploadStatusBadge'),
  btnRetryUpload: document.getElementById('btnRetryUpload'),
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
// backward compat alias
const elements = el;

// ─── Initialization ─────────────────────────────────────────────────────────
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
  handleUrlParamsOnLoad();   // calls loadFeed() at the end
  initHistoryListener();
  initInfiniteScroll();
});

// ─── 1. Saved username ───────────────────────────────────────────────────────
function restoreSavedUsername() {
  const saved = localStorage.getItem('ff_saved_username');
  if (saved && el.usernameInput) el.usernameInput.value = saved;
}

// ─── 2. Theme toggle ─────────────────────────────────────────────────────────
function initThemeToggle() {
  if (el.themeToggleBtn) el.themeToggleBtn.addEventListener('click', toggleTheme);
}

// ─── 3. Preset buttons ───────────────────────────────────────────────────────
function initPresetButtons() {
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.template;
      if (!PRESET_TEMPLATES[key]) return;
      el.settingsInput.value = PRESET_TEMPLATES[key];
      if (el.titleInput && (!el.titleInput.value.trim() || Object.values(PRESET_TITLES).includes(el.titleInput.value.trim()))) {
        el.titleInput.value = PRESET_TITLES[key] || '';
      }
      el.settingsInput.focus();
      showToast('Template preset loaded!', 'info', 1500);
    });
  });
}

// ─── 4. Image upload ─────────────────────────────────────────────────────────
function initImageUpload() {
  if (!el.imageDropzone) return;

  el.imageDropzone.addEventListener('click', () => el.imageInput.click());
  el.imageDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.imageInput.click(); }
  });

  ['dragenter', 'dragover'].forEach(ev => {
    el.imageDropzone.addEventListener(ev, (e) => { e.preventDefault(); el.imageDropzone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    el.imageDropzone.addEventListener(ev, (e) => { e.preventDefault(); el.imageDropzone.classList.remove('drag-over'); });
  });

  el.imageDropzone.addEventListener('drop', async (e) => {
    if (e.dataTransfer.files.length > 0) await handleImageSelection(e.dataTransfer.files[0]);
  });
  el.imageInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) await handleImageSelection(e.target.files[0]);
  });
  if (el.btnRemoveImage) el.btnRemoveImage.addEventListener('click', clearImageUpload);

  if (el.btnRetryUpload) {
    el.btnRetryUpload.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.selectedImageFile) {
        updateUploadBadgeUI('uploading');
        state.uploadStatus = 'uploading';
        state.uploadPromise = executeImageUpload(state.selectedImageFile).catch(() => {});
      }
    });
  }
}

async function handleImageSelection(file) {
  if (!file) return;

  // Validate type
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, WebP).', 'error');
    return;
  }

  // Validate size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showToast('Image exceeds 10MB maximum limit.', 'error');
    return;
  }

  state.selectedImageFile = file;
  state.uploadedImageUrl = '';
  state.uploadStatus = 'uploading';

  // 1. Instant local preview (URL.createObjectURL)
  try {
    el.imagePreview.src = URL.createObjectURL(file);
  } catch (_) {}
  el.imagePreviewContainer.style.display = 'block';
  el.imageDropzone.style.display = 'none';
  updateUploadBadgeUI('uploading');

  // 2. Begin upload immediately in background
  state.uploadPromise = executeImageUpload(file);
}

function updateUploadBadgeUI(status, message) {
  if (!el.imageUploadStatusBadge) return;
  el.imageUploadStatusBadge.className = `upload-status-badge ${status}`;

  const textSpan = el.imageUploadStatusBadge.querySelector('.status-text') || el.imageUploadStatusBadge;

  if (status === 'uploading') {
    el.imageUploadStatusBadge.style.display = 'inline-flex';
    textSpan.innerHTML = '<span class="badge-spinner"></span> Uploading screenshot...';
    if (el.btnRetryUpload) el.btnRetryUpload.style.display = 'none';
  } else if (status === 'uploaded') {
    el.imageUploadStatusBadge.style.display = 'inline-flex';
    textSpan.textContent = '✓ Uploaded to storage';
    if (el.btnRetryUpload) el.btnRetryUpload.style.display = 'none';
  } else if (status === 'error') {
    el.imageUploadStatusBadge.style.display = 'inline-flex';
    textSpan.textContent = message || '⚠️ Upload failed. Retry';
    if (el.btnRetryUpload) el.btnRetryUpload.style.display = 'inline-block';
  } else {
    el.imageUploadStatusBadge.style.display = 'none';
    if (el.btnRetryUpload) el.btnRetryUpload.style.display = 'none';
  }
}

async function executeImageUpload(file) {
  try {
    let payload = '';
    // Compress if file > 500KB to ensure ultra-fast network transfer
    if (file.size > 500 * 1024) {
      payload = await compressImageFile(file, 1400, 0.82);
    } else {
      payload = await fileToDataURL(file);
    }

    state.uploadedImageBase64 = payload;

    const res = await apiCall('upload', {
      method: 'POST',
      body: JSON.stringify({ image: payload })
    });

    if (!res.ok || !res.data || !res.data.success) {
      throw new Error((res.data && res.data.error && res.data.error.message) || (res.data && res.data.message) || 'Upload failed');
    }

    const url = res.data.imageUrl || (res.data.data && res.data.data.imageUrl) || res.data.url;
    state.uploadedImageUrl = url;
    state.uploadStatus = 'uploaded';
    updateUploadBadgeUI('uploaded');
    return url;
  } catch (err) {
    console.error('Upload failed:', err);
    state.uploadStatus = 'error';
    updateUploadBadgeUI('error', '⚠️ Upload failed. Retry');
    throw err;
  }
}

function clearImageUpload() {
  state.uploadedImageBase64 = '';
  state.uploadedImageUrl = '';
  state.uploadStatus = 'idle';
  state.selectedImageFile = null;
  state.uploadPromise = null;
  if (el.imageInput) el.imageInput.value = '';
  if (el.imagePreview) el.imagePreview.src = '';
  if (el.imagePreviewContainer) el.imagePreviewContainer.style.display = 'none';
  if (el.imageDropzone) el.imageDropzone.style.display = 'flex';
  updateUploadBadgeUI('idle');
}

// ─── 5. Form submission ───────────────────────────────────────────────────────
function initFormSubmission() {
  el.postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isSubmitting) return;

    const username = el.usernameInput.value.trim();
    const title = el.titleInput ? el.titleInput.value.trim() : '';
    const settings = el.settingsInput.value.trim();

    if (!username) { showToast('Please enter your username.', 'error'); el.usernameInput.focus(); return; }
    if (!settings) { showToast('Please enter sensitivity/settings text.', 'error'); el.settingsInput.focus(); return; }

    // If an image was chosen and upload is still processing in background, wait for it
    let finalImageUrl = state.uploadedImageUrl;
    if (state.selectedImageFile && !finalImageUrl) {
      if (state.uploadStatus === 'uploading' && state.uploadPromise) {
        showToast('Finishing screenshot upload...', 'info', 2000);
        try {
          finalImageUrl = await state.uploadPromise;
        } catch (_) {
          showToast('Screenshot upload failed. Retrying upload...', 'info', 2000);
          try {
            finalImageUrl = await executeImageUpload(state.selectedImageFile);
          } catch (retryErr) {
            showToast('Could not upload screenshot. Please retry or remove it.', 'error');
            return;
          }
        }
      } else if (state.uploadStatus === 'error') {
        showToast('Please retry uploading screenshot or remove it before sharing.', 'error');
        return;
      }
    }

    localStorage.setItem('ff_saved_username', username);
    state.isSubmitting = true;
    showTopProgress();
    el.btnSubmitPost.disabled = true;
    el.submitBtnText.textContent = 'Sharing...';

    try {
      const response = await apiCall('create-post', {
        method: 'POST',
        body: JSON.stringify({
          username,
          title,
          settings,
          image: finalImageUrl || state.uploadedImageBase64 || '',
          fingerprint: getFingerprint()
        })
      });

      if (!response.ok || !response.data.success) throw new Error(response.data.message || 'Failed to share settings.');

      const newPost = response.data.post;
      showToast('Settings shared successfully! ✓', 'success', 3500);

      if (el.titleInput) el.titleInput.value = '';
      el.settingsInput.value = '';
      clearImageUpload();

      // If viewing another user's profile, reset. Otherwise optimistically prepend.
      if (state.selectedUser && state.selectedUser.toLowerCase() !== username.toLowerCase()) {
        clearUserProfile();
      } else {
        prependNewPostToFeed(newPost);
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      state.isSubmitting = false;
      hideTopProgress();
      el.btnSubmitPost.disabled = false;
      el.submitBtnText.textContent = 'Share Settings';
    }
  });
}

// ─── 6. Prepend new post (optimistic UI) ─────────────────────────────────────
function prependNewPostToFeed(post) {
  // Remove from state if already there (avoid duplicate)
  state.posts = state.posts.filter(p => Number(p.id) !== Number(post.id));
  state.posts.unshift(post);
  state.total = Math.max(state.total + 1, state.posts.length);

  updateCountBadge();
  renderTopPaginationBoxes();
  if (el.emptyState) el.emptyState.style.display = 'none';

  // Update localStorage cache
  try {
    const cached = JSON.parse(localStorage.getItem('ff_posts_cache') || '[]');
    const filtered = cached.filter(p => Number(p.id) !== Number(post.id));
    filtered.unshift(post);
    localStorage.setItem('ff_posts_cache', JSON.stringify(filtered.slice(0, 200)));
  } catch (_) {}

  el.postsFeed.insertAdjacentHTML('afterbegin', renderPostCardHTML(post));
  const newCard = el.postsFeed.firstElementChild;
  if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── 6.1 Pagination boxes ────────────────────────────────────────────────────
function renderTopPaginationBoxes() {
  if (!el.paginationBoxesTop) return;

  const total = state.total || 0;
  const limit = state.limit || 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = state.page || 1;

  if (el.pageRangeIndicator) {
    if (total === 0) {
      el.pageRangeIndicator.textContent = '0 posts';
    } else {
      const start = (currentPage - 1) * limit + 1;
      const end = Math.min(currentPage * limit, total);
      el.pageRangeIndicator.textContent = `Showing ${start}–${end} of ${total}`;
    }
  }

  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    const active = p === currentPage;
    const s = (p - 1) * limit + 1;
    const e = Math.min(p * limit, total || limit);
    const hint = total > 0 ? `(${s}-${e})` : '';
    html += `<button type="button" class="page-box-btn ${active ? 'active' : ''}" data-page="${p}" onclick="goToPage(${p})" aria-label="Page ${p}" aria-current="${active ? 'page' : 'false'}">
      <span>${p}</span>${hint ? `<span class="page-count-hint">${hint}</span>` : ''}
    </button>`;
  }
  el.paginationBoxesTop.innerHTML = html;
}

window.goToPage = function (pageNum) {
  const p = Math.max(1, parseInt(pageNum, 10) || 1);
  if (state.feedStatus === 'loading') return;
  state.page = p;
  loadFeed({ page: p, append: false });
  if (el.topPaginationWrapper) el.topPaginationWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ─── 7. Search ────────────────────────────────────────────────────────────────
function initSearch() {
  if (!el.searchInput) return;

  el.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (el.searchClearBtn) el.searchClearBtn.style.display = val ? 'flex' : 'none';

    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
      const q = val.trim();
      if (q === state.searchQuery) return; // no change
      state.searchQuery = q;
      state.page = 1;

      if (q && state.selectedUser) {
        state.selectedUser = '';
        updateBrowserUrl();
      }

      loadFeed({ page: 1, append: false });
    }, 250);
  });

  el.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSearch();
    else if (e.key === 'Enter') el.searchInput.blur();
  });

  if (el.searchClearBtn) el.searchClearBtn.addEventListener('click', clearSearch);
  if (el.btnClearActiveFilter) {
    el.btnClearActiveFilter.addEventListener('click', () => {
      if (state.selectedUser) clearUserProfile();
      else clearSearch();
    });
  }
}

function clearSearch() {
  if (el.searchInput) el.searchInput.value = '';
  if (el.searchClearBtn) el.searchClearBtn.style.display = 'none';
  if (state.searchQuery === '' && state.page === 1 && !state.selectedUser) return;
  state.searchQuery = '';
  state.page = 1;
  updateBrowserUrl();
  loadFeed({ page: 1, append: false });
}

// ─── 7.1 Quick search tags ────────────────────────────────────────────────────
function initQuickSearchTags() {
  document.querySelectorAll('.search-tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.dataset.search || '';
      if (!q) return;
      if (el.searchInput) {
        el.searchInput.value = q;
        if (el.searchClearBtn) el.searchClearBtn.style.display = 'flex';
      }
      state.searchQuery = q;
      state.selectedUser = '';
      state.page = 1;
      updateBrowserUrl();
      loadFeed({ page: 1, append: false });
      if (el.postsFeed) el.postsFeed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

// ─── 7.2 URL params & deep linking ───────────────────────────────────────────
function handleUrlParamsOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const userParam = params.get('user') || params.get('u') || params.get('author');
  const queryParam = params.get('q') || params.get('search');

  if (userParam) {
    state.selectedUser = userParam.trim();
  } else if (queryParam) {
    state.searchQuery = queryParam.trim();
    if (el.searchInput) {
      el.searchInput.value = state.searchQuery;
      if (el.searchClearBtn) el.searchClearBtn.style.display = 'flex';
    }
  }

  // Always load feed on page load — the core entry point
  loadFeed({ page: 1, append: false });
}

function initHistoryListener() {
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    state.selectedUser = params.get('user') || params.get('u') || params.get('author') || '';
    state.searchQuery = params.get('q') || params.get('search') || '';
    if (el.searchInput) {
      el.searchInput.value = state.searchQuery;
      if (el.searchClearBtn) el.searchClearBtn.style.display = state.searchQuery ? 'flex' : 'none';
    }
    state.page = 1;
    loadFeed({ page: 1, append: false });
  });
}

function updateBrowserUrl() {
  try {
    let url = window.location.pathname;
    const params = new URLSearchParams();
    if (state.selectedUser) params.set('user', state.selectedUser);
    else if (state.searchQuery) params.set('q', state.searchQuery);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    if (window.location.search !== (qs ? `?${qs}` : '')) {
      window.history.pushState(null, '', url);
    }
  } catch (_) {}
}

// ─── 8. User profile ─────────────────────────────────────────────────────────
window.viewUserProfile = function (username) {
  if (!username) return;
  state.selectedUser = username.trim();
  state.searchQuery = '';
  state.page = 1;
  if (el.searchInput) el.searchInput.value = '';
  if (el.searchClearBtn) el.searchClearBtn.style.display = 'none';
  updateBrowserUrl();
  loadFeed({ page: 1, append: false });
  setTimeout(() => {
    const target = el.activeUserProfileBanner || el.postsFeed;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
};

window.clearUserProfile = function () {
  state.selectedUser = '';
  state.userProfile = null;
  state.page = 1;
  updateBrowserUrl();
  loadFeed({ page: 1, append: false });
};

window.shareUserProfile = async function (username) {
  const url = `${window.location.origin}/?user=${encodeURIComponent(username)}`;
  const data = { title: `@${username}'s Free Fire Settings`, text: `Check out @${username} on FF-SHARING`, url };
  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try { await navigator.share(data); return; } catch (_) {}
  }
  await copySettingsText(url, null);
  showToast(`Profile link copied ✓`, 'success', 2500);
};

// ─── 9. Load More (manual button fallback) ────────────────────────────────────
function initLoadMore() {
  if (!el.btnLoadMore) return;
  el.btnLoadMore.addEventListener('click', () => {
    if (state.feedStatus !== 'loadingMore' && state.hasMore) {
      const nextPage = state.page + 1;
      state.page = nextPage;
      loadFeed({ page: nextPage, append: true });
    }
  });
}

// ─── 10. Infinite Scroll (IntersectionObserver) ───────────────────────────────
function initInfiniteScroll() {
  // Create sentinel element at bottom of feed
  const sentinel = document.createElement('div');
  sentinel.id = 'feedSentinel';
  sentinel.style.cssText = 'height:1px;width:100%;';
  if (el.postsFeed && el.postsFeed.parentNode) {
    el.postsFeed.parentNode.insertBefore(sentinel, el.postsFeed.nextSibling);
  }
  state._sentinelEl = sentinel;
  // Sentinel observer is attached only after initial page renders with content
}

function _attachObserver() {
  if (state._observer) state._observer.disconnect();
  if (!state._sentinelEl) return;
  if (!state.hasMore || state.posts.length === 0) return;

  state._observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry.isIntersecting) return;
    if (!state.hasMore) return;
    if (state.feedStatus === 'loading' || state.feedStatus === 'loadingMore') return;

    const nextPage = state.page + 1;
    loadFeed({ page: nextPage, append: true });
  }, {
    rootMargin: '0px 0px 800px 0px',  // Prefetch 800px before bottom
    threshold: 0
  });

  state._observer.observe(state._sentinelEl);
}

// ─── 11. CORE: loadFeed — unified, single entry point for ALL feed operations ─
/**
 * loadFeed({ page, append, search, username })
 *
 * This is the ONLY function that loads posts. All paths call this:
 * - initial page load
 * - search
 * - filter
 * - pagination
 * - infinite scroll
 * - clear search
 *
 * Race condition protection: each non-append call increments _requestToken.
 * If a newer root call starts before an older one finishes, the older one's
 * result is discarded.
 */
async function loadFeed({ page = 1, append = false } = {}) {
  // ── Race condition protection ──────────────────────────────────────────────
  let myToken;
  if (!append) {
    myToken = ++state._requestToken;
  } else {
    // Append is a continuation of current view; do not start if already loading page 1
    if (state.feedStatus === 'loading') return;
    myToken = state._requestToken;
  }

  // ── Update status ──────────────────────────────────────────────────────────
  if (append) {
    state.feedStatus = 'loadingMore';
    setLoadingMoreUI(true);
  } else {
    state.feedStatus = 'loading';
    setFeedLoadingUI();

    // ── SWR: render cached posts immediately for instant first paint ──────────
    if (page === 1 && !state.searchQuery && !state.selectedUser) {
      try {
        const cachedStr = localStorage.getItem('ff_posts_cache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Array.isArray(cached) && cached.length > 0) {
            const slice = cached.slice(0, state.limit);
            renderPostsFeed(slice);
            state.posts = slice;
            state.total = cached.length;
            // Prevent prefetching page 2 before server confirms live data
            state.hasMore = false;
            updateCountBadge();
            renderTopPaginationBoxes();
            setLoadingMoreUI(false);
            hideLoadingSpinner();
          }
        }
      } catch (_) {}
    }
  }

  showTopProgress();

  // ── Build request ──────────────────────────────────────────────────────────
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(state.limit)
  });
  if (state.selectedUser) queryParams.set('user', state.selectedUser);
  else if (state.searchQuery) queryParams.set('q', state.searchQuery);

  const t0 = Date.now();

  try {
    const response = await apiCall(`get-posts?${queryParams.toString()}`, { method: 'GET' });

    // ── Stale response guard ───────────────────────────────────────────────
    if (myToken !== state._requestToken) {
      console.debug('[feed] discarding stale response (token mismatch)', myToken, '!==', state._requestToken);
      return;
    }

    const dt = Date.now() - t0;
    console.debug(`[feed] /api/get-posts responded in ${dt}ms (page=${page})`);

    if (!response || !response.data || !response.data.success) {
      throw new Error((response && response.data && response.data.message) || 'Failed to load feed');
    }

    const { posts, total, hasMore, matchedUsers, userProfile } = response.data;

    state.total = total;
    state.hasMore = !!hasMore;
    state.matchedUsers = matchedUsers || [];
    state.userProfile = userProfile || null;
    state.page = page;

    if (append) {
      // Dedup by id before appending
      const existingIds = new Set(state.posts.map(p => Number(p.id)));
      const newPosts = (posts || []).filter(p => !existingIds.has(Number(p.id)));
      state.posts = [...state.posts, ...newPosts];
      if (newPosts.length > 0) appendPostsToFeed(newPosts);
    } else {
      state.posts = posts || [];
      renderPostsFeed(state.posts);

      // Update localStorage cache for SWR (only for default feed)
      if (page === 1 && !state.searchQuery && !state.selectedUser) {
        try {
          localStorage.setItem('ff_posts_cache', JSON.stringify(state.posts));
        } catch (_) {}
      }
    }

    state.feedStatus = state.posts.length === 0 ? 'empty' : 'success';

    // ── Update UI ────────────────────────────────────────────────────────────
    renderTopPaginationBoxes();
    renderUserSearchResults(state.matchedUsers);
    renderActiveProfileBanner(state.userProfile || (state.selectedUser ? {
      username: state.selectedUser,
      postCount: state.total,
      totalLikes: state.posts.reduce((s, p) => s + (Number(p.likes) || 0), 0)
    } : null));
    updateCountBadge();

    // Load More button — show only if not using infinite scroll OR as fallback
    if (el.btnLoadMore) el.btnLoadMore.style.display = 'none';

    // Empty state
    if (state.feedStatus === 'empty') {
      showEmptyState();
    } else {
      hideEmptyState();
    }

    // Reconnect observer now that DOM is updated
    _attachObserver();

  } catch (err) {
    if (myToken !== state._requestToken) return; // stale, ignore

    console.error('[feed] loadFeed error:', err);
    state.feedStatus = 'error';

    if (!append) {
      // If we have cached/SWR content already shown, don't replace with error
      if (state.posts.length === 0) {
        showErrorState(err.message);
      } else {
        showToast('Could not refresh feed — showing cached data', 'info', 3000);
      }
    } else {
      setLoadingMoreUI(false);
      showToast('Could not load more posts. Try again.', 'error', 3000);
      // Decrement page so retry works correctly
      state.page = Math.max(1, state.page - 1);
      if (el.btnLoadMore) {
        el.btnLoadMore.style.display = state.hasMore ? 'block' : 'none';
      }
    }
  } finally {
    if (myToken === state._requestToken) {
      hideTopProgress();
      hideLoadingSpinner();
      setLoadingMoreUI(false);
    }
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setFeedLoadingUI() {
  hideEmptyState();
  hideErrorState();
  // Show spinner only if no content yet
  if (state.posts.length === 0) {
    if (el.postsFeed) el.postsFeed.innerHTML = '';
    showLoadingSpinner();
  }
  if (el.btnLoadMore) el.btnLoadMore.style.display = 'none';
}

function showLoadingSpinner() {
  if (el.feedLoading) {
    el.feedLoading.style.display = 'flex';
    el.feedLoading.innerHTML = `
      <div class="feed-spinner-wrap">
        <div class="feed-spinner"></div>
        <span class="feed-spinner-text">Loading community settings...</span>
      </div>`;
  }
}

function hideLoadingSpinner() {
  if (el.feedLoading) el.feedLoading.style.display = 'none';
}

function setLoadingMoreUI(show) {
  // Inline bottom loader — doesn't block existing content
  let indicator = document.getElementById('loadMoreIndicator');
  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'loadMoreIndicator';
      indicator.className = 'load-more-indicator';
      indicator.innerHTML = `<div class="load-more-dots"><span></span><span></span><span></span></div>`;
      if (el.postsFeed && el.postsFeed.parentNode) {
        el.postsFeed.parentNode.insertBefore(indicator, el.postsFeed.nextSibling);
      }
    }
    indicator.style.display = 'flex';
  } else {
    if (indicator) indicator.style.display = 'none';
  }
}

function showEmptyState() {
  if (!el.emptyState) return;
  el.emptyState.style.display = 'block';
  if (state.selectedUser) {
    if (el.emptyTitle) el.emptyTitle.textContent = `No settings shared by @${state.selectedUser}`;
    if (el.emptyDesc) el.emptyDesc.textContent = `This player hasn't shared any settings yet.`;
  } else if (state.searchQuery) {
    if (el.emptyTitle) el.emptyTitle.textContent = 'No matching settings found';
    if (el.emptyDesc) el.emptyDesc.textContent = `No settings matched "${state.searchQuery}". Try different keywords.`;
  } else {
    if (el.emptyTitle) el.emptyTitle.textContent = 'No settings shared yet';
    if (el.emptyDesc) el.emptyDesc.textContent = 'Be the first to share your Free Fire settings!';
  }
}

function hideEmptyState() {
  if (el.emptyState) el.emptyState.style.display = 'none';
}

function showErrorState(message) {
  if (!el.emptyState) return;
  el.emptyState.style.display = 'block';
  if (el.emptyTitle) el.emptyTitle.textContent = '⚠️ Unable to load settings';
  if (el.emptyDesc) {
    el.emptyDesc.innerHTML = `${escapeHTML(message || 'Network error. Please check your connection.')}
      <br><br>
      <button
        type="button"
        class="btn-retry"
        onclick="loadFeed({page:1,append:false})"
        style="margin-top:8px;padding:8px 20px;background:var(--accent-ff);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;"
      >🔄 Retry</button>`;
  }
}

function hideErrorState() {
  // Error is shown via emptyState — hideEmptyState covers this
}

// ─── 12. Render functions ─────────────────────────────────────────────────────
function renderPostsFeed(posts) {
  if (!el.postsFeed) return;
  el.postsFeed.innerHTML = posts.map(renderPostCardHTML).join('');
}

function appendPostsToFeed(posts) {
  if (!el.postsFeed) return;
  el.postsFeed.insertAdjacentHTML('beforeend', posts.map(renderPostCardHTML).join(''));
}

// ─── 13. User search results ──────────────────────────────────────────────────
function renderUserSearchResults(users) {
  if (!el.userSearchResults) return;
  if (state.searchQuery && !state.selectedUser && Array.isArray(users) && users.length > 0) {
    el.userSearchResults.innerHTML = users.map(user => {
      const safe = escapeHTML(user.username || 'Anonymous');
      const highlighted = highlightSearchMatch(user.username, state.searchQuery);
      const initial = (safe[0] || 'F').toUpperCase();
      const count = Number(user.postCount) || 1;
      const likes = Number(user.totalLikes) || 0;
      return `<div class="user-result-card">
        <div class="user-result-left">
          <div class="user-result-avatar">${initial}</div>
          <div class="user-result-info">
            <div class="user-result-name-row">
              <span class="user-result-name">${highlighted}</span>
              <span class="creator-badge">⚡ Creator</span>
            </div>
            <div class="user-result-stats">
              <span><span class="stat-icon">🎯</span> ${count} post${count === 1 ? '' : 's'}</span>
              <span><span class="stat-icon">❤️</span> ${likes} like${likes === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-see-user" onclick="viewUserProfile('${escapeHTML(user.username)}')" aria-label="See posts by ${safe}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span>See User</span>
        </button>
      </div>`;
    }).join('');
    el.userSearchResults.style.display = 'flex';
  } else {
    el.userSearchResults.innerHTML = '';
    el.userSearchResults.style.display = 'none';
  }
}

// ─── 14. Active profile banner ────────────────────────────────────────────────
function renderActiveProfileBanner(profile) {
  if (!el.activeUserProfileBanner) return;

  if (state.selectedUser && profile) {
    const safe = escapeHTML(profile.username || state.selectedUser);
    const initial = (safe[0] || 'F').toUpperCase();
    const count = Number(profile.postCount) || state.total || state.posts.length;
    const likes = Number(profile.totalLikes) || 0;

    el.activeUserProfileBanner.innerHTML = `
      <div class="profile-banner-top">
        <div class="profile-author-section">
          <div class="profile-avatar-large">${initial}</div>
          <div class="profile-title-box">
            <div class="profile-username-heading">
              <span>@${safe}</span>
              <span class="verified-player-badge">✓ Creator</span>
            </div>
            <p class="profile-tagline">Free Fire Settings Creator • Community Member</p>
          </div>
        </div>
        <div class="profile-actions-right">
          <button type="button" class="btn-profile-share" onclick="shareUserProfile('${escapeHTML(profile.username || state.selectedUser)}')" aria-label="Share @${safe}'s profile">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share Profile</span>
          </button>
          <button type="button" class="btn-profile-exit" onclick="clearUserProfile()" aria-label="Back to all posts">
            <span>✕ Show All Posts</span>
          </button>
        </div>
      </div>
      <div class="profile-stats-grid">
        <div class="profile-stat-box"><div class="profile-stat-num">${count}</div><div class="profile-stat-lbl">Settings Shared</div></div>
        <div class="profile-stat-box"><div class="profile-stat-num gold">${likes}</div><div class="profile-stat-lbl">Total Likes ❤️</div></div>
        <div class="profile-stat-box"><div class="profile-stat-num ice">Top Tier</div><div class="profile-stat-lbl">Rank Level</div></div>
      </div>`;

    el.activeUserProfileBanner.style.display = 'block';
    if (el.feedTitleText) el.feedTitleText.textContent = `Posts by @${safe}`;
    if (el.activeFilterBadge && el.filterBadgeText) {
      el.filterBadgeText.textContent = `@${safe}`;
      el.activeFilterBadge.style.display = 'inline-flex';
    }
  } else {
    el.activeUserProfileBanner.innerHTML = '';
    el.activeUserProfileBanner.style.display = 'none';
    if (state.searchQuery) {
      if (el.feedTitleText) el.feedTitleText.textContent = 'Search Results';
      if (el.activeFilterBadge && el.filterBadgeText) {
        el.filterBadgeText.textContent = `"${state.searchQuery}"`;
        el.activeFilterBadge.style.display = 'inline-flex';
      }
    } else {
      if (el.feedTitleText) el.feedTitleText.textContent = 'Community Settings Feed';
      if (el.activeFilterBadge) el.activeFilterBadge.style.display = 'none';
    }
  }
}

// ─── 15. Post card renderer ───────────────────────────────────────────────────
function renderPostCardHTML(post) {
  const safeId = Number(post.id);
  const rawUsername = post.username || 'Anonymous';
  const safeUsername = escapeHTML(rawUsername);
  const rawTitle = (post.title || '').trim();
  const rawSettings = post.settings || '';

  const highlightedUsername = state.searchQuery ? highlightSearchMatch(rawUsername, state.searchQuery) : safeUsername;
  const highlightedTitle = state.searchQuery ? highlightSearchMatch(rawTitle, state.searchQuery) : escapeHTML(rawTitle);
  const highlightedSettings = state.searchQuery ? highlightSearchMatch(rawSettings, state.searchQuery) : escapeHTML(rawSettings);

  const timeInfo = formatPublishedTime(post.createdAt);
  const likesCount = Number(post.likes) || 0;
  const initial = (safeUsername[0] || 'F').toUpperCase();

  let matchBadgesHtml = '';
  if (state.searchQuery) {
    const term = state.searchQuery.toLowerCase().trim();
    const tokens = term.split(/\s+/).filter(t => t.length > 0);
    const badges = [];
    if (rawTitle && (rawTitle.toLowerCase().includes(term) || tokens.some(t => rawTitle.toLowerCase().includes(t)))) {
      badges.push('<span class="match-tag tag-title" title="Match in Post Title">✓ In Title</span>');
    }
    if (rawSettings.toLowerCase().includes(term) || tokens.some(t => rawSettings.toLowerCase().includes(t))) {
      badges.push('<span class="match-tag tag-settings" title="Match in Text">✓ In Text</span>');
    }
    if (rawUsername.toLowerCase().includes(term) || tokens.some(t => rawUsername.toLowerCase().includes(t))) {
      badges.push('<span class="match-tag tag-user" title="Match in Author">✓ In Author</span>');
    }
    if (badges.length > 0) matchBadgesHtml = `<div class="search-match-badges">${badges.join('')}</div>`;
  }

  const likedPosts = (() => { try { return JSON.parse(localStorage.getItem('ff_liked_posts') || '[]'); } catch (_) { return []; } })();
  const isLiked = likedPosts.includes(safeId);

  const titleHtml = rawTitle
    ? `<h3 class="post-card-title">
        <svg class="title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>
        <span>${highlightedTitle}</span>
       </h3>`
    : '';

  const imageHtml = post.image
    ? `<div class="post-image-container" onclick="openImageModal('${escapeHTML(post.image)}')">
        <img src="${escapeHTML(post.image)}" alt="Settings screenshot by ${safeUsername}" loading="lazy" decoding="async" />
       </div>`
    : '';

  return `
    <article class="post-card" data-post-id="${safeId}">
      <header class="post-card-header">
        <div class="post-author-box clickable" onclick="viewUserProfile('${escapeHTML(rawUsername)}')" title="View @${safeUsername}" role="button" tabindex="0" aria-label="View @${safeUsername}'s profile">
          <div class="user-avatar">${initial}</div>
          <div class="user-meta">
            <div class="user-name-row"><span class="user-name">${highlightedUsername}</span></div>
            <time class="post-time" datetime="${escapeHTML(post.createdAt || '')}" title="${escapeHTML(timeInfo.full)}">
              <svg class="post-time-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Published: ${timeInfo.display}</span>
            </time>
          </div>
        </div>
        <div class="post-header-right">
          ${matchBadgesHtml}
          <a href="post.html?id=${safeId}" class="post-id-badge" title="View standalone post #${safeId}">#${safeId}</a>
        </div>
      </header>
      ${titleHtml}
      <div class="post-settings-box">${highlightedSettings}</div>
      ${imageHtml}
      <footer class="post-actions">
        <div class="actions-left">
          <button type="button" class="btn-action btn-like ${isLiked ? 'liked' : ''}" onclick="handleLikeClick(${safeId}, this)" aria-label="Like post #${safeId}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span class="like-count">${likesCount}</span>
          </button>
          <button type="button" class="btn-action btn-copy" onclick="handleCopyClick(${safeId}, this)" title="Copy text" aria-label="Copy text from post #${safeId}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            <span>Copy Text</span>
          </button>
        </div>
        <div class="actions-right">
          <button type="button" class="btn-action" onclick="handleShareClick(${safeId})" title="Share Post #${safeId}" aria-label="Share post #${safeId}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share</span>
          </button>
        </div>
      </footer>
    </article>`;
}

// ─── 16. Like / Copy / Share handlers ────────────────────────────────────────
window.handleLikeClick = async function (postId, buttonEl) {
  const numericId = Number(postId);
  const likedPosts = (() => { try { return JSON.parse(localStorage.getItem('ff_liked_posts') || '[]'); } catch (_) { return []; } })();

  if (likedPosts.includes(numericId)) {
    showToast('You already liked this post ❤️', 'info', 1500);
    return;
  }

  const fp = getFingerprint();
  const countEl = buttonEl.querySelector('.like-count');
  const currentLikes = parseInt(countEl ? countEl.textContent : '0', 10) || 0;

  // Optimistic update
  buttonEl.classList.add('liked');
  const heart = buttonEl.querySelector('svg');
  if (heart) heart.setAttribute('fill', 'currentColor');
  if (countEl) countEl.textContent = currentLikes + 1;
  likedPosts.push(numericId);
  try { localStorage.setItem('ff_liked_posts', JSON.stringify(likedPosts)); } catch (_) {}

  try {
    const res = await apiCall('like-post', { method: 'POST', body: JSON.stringify({ postId: numericId, fingerprint: fp }) });
    if (res.ok && res.data && res.data.success) {
      if (countEl) countEl.textContent = res.data.likes;
      showToast('Post liked! ❤️', 'success', 1500);
    }
  } catch (e) {
    console.error('Like error:', e);
  }
};

window.handleCopyClick = function (postId, buttonEl) {
  const post = state.posts.find(p => Number(p.id) === Number(postId));
  if (post && post.settings) {
    copySettingsText(post.settings, buttonEl);
  } else {
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const box = card && card.querySelector('.post-settings-box');
    if (box) copySettingsText(box.innerText, buttonEl);
  }
};

window.handleShareClick = async function (postId) {
  const postUrl = window.location.protocol.startsWith('http')
    ? `${window.location.origin}/post/${postId}`
    : `post.html?id=${postId}`;
  const shareData = {
    title: `Free Fire Sensitivity #${postId} — FF-SHARING-COMMUNITY`,
    text: `Check out this Free Fire settings on FF-SHARING-COMMUNITY:`,
    url: postUrl
  };

  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try { await navigator.share(shareData); return; } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  await copySettingsText(postUrl, null);
  showToast(`Post link copied: #${postId} ✓`, 'success', 2500);
};

// ─── 17. Count badge ──────────────────────────────────────────────────────────
function updateCountBadge() {
  if (!el.postCountBadge) return;
  if (state.selectedUser) {
    el.postCountBadge.textContent = `${state.total} settings by @${state.selectedUser}`;
  } else if (state.searchQuery) {
    el.postCountBadge.textContent = `${state.total} result${state.total === 1 ? '' : 's'}`;
  } else {
    el.postCountBadge.textContent = `${state.total} settings shared`;
  }
}

// ─── 18. PWA ──────────────────────────────────────────────────────────────────
function initPwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    if (el.btnInstallPwa) el.btnInstallPwa.style.display = 'inline-flex';
  });

  if (el.btnInstallPwa) {
    el.btnInstallPwa.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      const { outcome } = await state.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') showToast('Thank you for installing FF-SHARING!', 'success');
      state.deferredInstallPrompt = null;
      el.btnInstallPwa.style.display = 'none';
    });
  }

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Registered:', reg.scope))
        .catch(err => console.warn('SW Registration failed:', err));
    });
  }
}

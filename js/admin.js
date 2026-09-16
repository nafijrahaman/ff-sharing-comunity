/**
 * FF-SHARING-COMMUNITY — Admin Panel Application Logic
 */

let adminToken = sessionStorage.getItem('ff_admin_token') || '';
let adminPosts = [];
let pendingAction = null; // Store callback for modal confirmation

// DOM Elements
const authView = document.getElementById('adminLoginView');
const dashboardView = document.getElementById('adminDashboardView');
const loginForm = document.getElementById('adminLoginForm');
const passwordInput = document.getElementById('adminPassword');
const logoutBtn = document.getElementById('adminLogoutBtn');

const statPostsEl = document.getElementById('statTotalPosts');
const statLikesEl = document.getElementById('statTotalLikes');

const deleteUserForm = document.getElementById('deleteUserForm');
const targetUserInput = document.getElementById('targetUsernameInput');
const btnDeleteAll = document.getElementById('btnDeleteAllPosts');
const btnRefresh = document.getElementById('btnRefreshAdminPosts');
const searchInput = document.getElementById('adminSearchInput');
const postsListEl = document.getElementById('adminPostsList');
const loadingEl = document.getElementById('adminLoading');

// Modal Elements
const confirmModal = document.getElementById('adminConfirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const btnModalCancel = document.getElementById('btnModalCancel');
const btnModalConfirm = document.getElementById('btnModalConfirm');

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
  initModalListeners();
});

function initAuth() {
  if (adminToken) {
    showDashboard();
  } else {
    showLogin();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) return;

    try {
      const res = await apiCall('admin-login', {
        method: 'POST',
        body: JSON.stringify({ password })
      });

      if (!res.ok || !res.data.success || !res.data.token) {
        throw new Error(res.data.message || 'Invalid admin credentials');
      }

      adminToken = res.data.token;
      sessionStorage.setItem('ff_admin_token', adminToken);
      passwordInput.value = '';
      showToast('Admin access granted ✓', 'success');
      showDashboard();
    } catch (err) {
      showToast(err.message || 'Authentication failed', 'error');
    }
  });

  logoutBtn.addEventListener('click', () => {
    adminToken = '';
    sessionStorage.removeItem('ff_admin_token');
    showLogin();
    showToast('Logged out of admin panel', 'info');
  });
}

function showLogin() {
  authView.style.display = 'block';
  dashboardView.style.display = 'none';
  logoutBtn.style.display = 'none';
}

function showDashboard() {
  authView.style.display = 'none';
  dashboardView.style.display = 'block';
  logoutBtn.style.display = 'inline-flex';
  initDashboardFeatures();
  loadAdminData();
}

function initDashboardFeatures() {
  btnRefresh.addEventListener('click', () => loadAdminData());

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderAdminPosts(e.target.value.trim());
    }, 250);
  });

  // Delete All from User
  deleteUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = targetUserInput.value.trim();
    if (!username) return;

    openConfirmModal(
      'Delete All Posts by User',
      `Are you sure you want to permanently delete ALL posts created by <strong>"${escapeHTML(username)}"</strong>? This cannot be undone.`,
      async () => {
        try {
          const res = await apiCall('admin-delete-user', {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ username })
          });

          if (!res.ok || !res.data.success) {
            throw new Error(res.data.message || 'Failed to delete user posts');
          }

          showToast(res.data.message, 'success');
          targetUserInput.value = '';
          loadAdminData();
        } catch (err) {
          showToast(err.message || 'Delete operation failed', 'error');
        }
      }
    );
  });

  // Delete All Posts (Double Confirmation)
  btnDeleteAll.addEventListener('click', () => {
    // 1st confirmation
    openConfirmModal(
      '⚠️ Delete ALL Posts & Users',
      'Are you sure you want to delete ALL posts and users in the community database? This will permanently wipe all shared settings and reset the database to start new!',
      () => {
        // 2nd confirmation
        openConfirmModal(
          '🚨 FINAL CONFIRMATION: Reset Database',
          'This is your final warning. Type of action: PERMANENT PURGE. All posts and user records will be deleted, and post numbering will start fresh at #1. Do you wish to execute now?',
          async () => {
            try {
              const res = await apiCall('admin-delete-all', {
                method: 'POST',
                headers: { Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify({ confirm: 'CONFIRM_DELETE_ALL' })
              });

              if (!res.ok || !res.data.success) {
                throw new Error(res.data.message || 'Failed to delete all posts');
              }

              showToast(res.data.message || 'All community data deleted and reset', 'success');
              loadAdminData();
            } catch (err) {
              showToast(err.message || 'Purge failed', 'error');
            }
          }
        );
      }
    );
  });
}

// Fetch all posts for admin moderation
async function loadAdminData() {
  loadingEl.style.display = 'flex';
  postsListEl.innerHTML = '';

  try {
    const res = await apiCall('get-posts?page=1&limit=200', { method: 'GET' });
    if (!res.ok || !res.data.success) {
      throw new Error(res.data.message || 'Failed to fetch posts');
    }

    adminPosts = res.data.posts || [];
    const totalLikes = adminPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0);

    statPostsEl.textContent = adminPosts.length;
    statLikesEl.textContent = totalLikes;

    renderAdminPosts(searchInput.value.trim());
  } catch (err) {
    showToast(err.message || 'Failed to load posts', 'error');
  } finally {
    loadingEl.style.display = 'none';
  }
}

function renderAdminPosts(filterQuery = '') {
  let list = [...adminPosts];

  if (filterQuery) {
    const term = filterQuery.toLowerCase();
    list = list.filter(p => {
      const matchId = String(p.id) === term || `#${p.id}` === term;
      const matchUser = (p.username || '').toLowerCase().includes(term);
      const matchSettings = (p.settings || '').toLowerCase().includes(term);
      return matchId || matchUser || matchSettings;
    });
  }

  if (list.length === 0) {
    postsListEl.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:0.875rem;">
        No posts found matching your criteria.
      </div>
    `;
    return;
  }

  postsListEl.innerHTML = list
    .map(p => {
      const safeId = Number(p.id);
      const safeUser = escapeHTML(p.username || 'Anonymous');
      const safeSettings = escapeHTML(p.settings || '');
      const timeStr = formatRelativeTime(p.createdAt);

      return `
        <div class="admin-post-item">
          <div class="admin-post-meta">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="post-id-badge">#${safeId}</span>
              <strong style="font-size:0.9rem;">${safeUser}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted);">${timeStr}</span>
              <span style="font-size:0.75rem; color:var(--accent-rose);">❤️ ${p.likes || 0}</span>
            </div>
            <div class="admin-post-content">${safeSettings}</div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <a href="post.html?id=${safeId}" target="_blank" class="btn-action" style="height:32px; font-size:0.75rem;">
              View ↗
            </a>
            <button
              type="button"
              class="btn-danger"
              style="padding:6px 12px; font-size:0.75rem;"
              onclick="promptDeleteSinglePost(${safeId})"
            >
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

window.promptDeleteSinglePost = function (postId) {
  openConfirmModal(
    'Delete Single Post',
    `Are you sure you want to permanently delete post <strong>#${postId}</strong>? This ID will never be reused.`,
    async () => {
      try {
        const res = await apiCall('admin-delete-post', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ postId })
        });

        if (!res.ok || !res.data.success) {
          throw new Error(res.data.message || 'Failed to delete post');
        }

        showToast(res.data.message || `Post #${postId} deleted`, 'success');
        loadAdminData();
      } catch (err) {
        showToast(err.message || 'Failed to delete post', 'error');
      }
    }
  );
};

// Modal Logic
function openConfirmModal(title, bodyHTML, onConfirm) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  pendingAction = onConfirm;
  confirmModal.classList.add('active');
}

function closeConfirmModal() {
  confirmModal.classList.remove('active');
  pendingAction = null;
}

function initModalListeners() {
  btnModalCancel.addEventListener('click', closeConfirmModal);
  btnModalConfirm.addEventListener('click', async () => {
    if (typeof pendingAction === 'function') {
      const action = pendingAction;
      closeConfirmModal();
      await action();
    } else {
      closeConfirmModal();
    }
  });

  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeConfirmModal();
    }
  });
}

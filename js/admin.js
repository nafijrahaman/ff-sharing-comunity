/**
 * FF-SHARING-COMMUNITY — Admin Panel Application Logic
 * Pure MongoDB Atlas Backend — Complete Moderation Architecture
 */

let adminToken = sessionStorage.getItem('ff_admin_token') || '';
let adminPosts = [];
let adminUsers = [];
let selectedPostIds = new Set();
let pendingAction = null; // Store callback for modal confirmation

// DOM Elements
const authView = document.getElementById('adminLoginView');
const dashboardView = document.getElementById('adminDashboardView');
const loginForm = document.getElementById('adminLoginForm');
const passwordInput = document.getElementById('adminPassword');
const logoutBtn = document.getElementById('adminLogoutBtn');

const statPostsEl = document.getElementById('statTotalPosts');
const statLikesEl = document.getElementById('statTotalLikes');
const statUsersEl = document.getElementById('statTotalUsers');

// Users Moderation Elements
const usersTableBody = document.getElementById('adminUsersTableBody');
const btnRefreshUsers = document.getElementById('btnRefreshAdminUsers');
const deleteUserForm = document.getElementById('deleteUserForm');
const targetUserInput = document.getElementById('targetUsernameInput');

// Posts Moderation Elements
const btnRefreshPosts = document.getElementById('btnRefreshAdminPosts');
const searchInput = document.getElementById('adminSearchInput');
const postsListEl = document.getElementById('adminPostsList');
const loadingEl = document.getElementById('adminLoading');
const selectAllCb = document.getElementById('selectAllPostsCheckbox');
const selectedCountBadge = document.getElementById('selectedCountBadge');
const btnDeleteBulk = document.getElementById('btnDeleteBulkPosts');

// Danger Zone
const btnDeleteAll = document.getElementById('btnDeleteAllPosts');

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

// ─── Double-Click / Duplicate Protection Helper ────────────────────────────
async function withButtonLock(btn, asyncFn) {
  if (!btn) return asyncFn();
  if (btn.disabled || btn.dataset.locked === 'true') return;

  btn.disabled = true;
  btn.dataset.locked = 'true';
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-sm"></span> Processing...';

  try {
    const result = await asyncFn();
    return result;
  } catch (err) {
    btn.disabled = false;
    btn.dataset.locked = 'false';
    btn.innerHTML = originalHTML;
    throw err;
  } finally {
    // If button is still in DOM and not removed, restore unless locked
    if (document.body.contains(btn) && btn.dataset.locked !== 'deleted') {
      btn.disabled = false;
      btn.dataset.locked = 'false';
      btn.innerHTML = originalHTML;
    }
  }
}

// ─── Authentication ─────────────────────────────────────────────────────────
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

    const btnLogin = document.getElementById('btnAdminLogin');
    await withButtonLock(btnLogin, async () => {
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

// ─── Dashboard Features Initialization ─────────────────────────────────────
function initDashboardFeatures() {
  if (btnRefreshPosts) btnRefreshPosts.addEventListener('click', () => loadAdminData());
  if (btnRefreshUsers) btnRefreshUsers.addEventListener('click', () => loadAdminUsers());

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        renderAdminPosts(e.target.value.trim());
      }, 250);
    });
  }

  // Bulk Selection Listeners
  if (selectAllCb) {
    selectAllCb.addEventListener('change', (e) => {
      const visibleCheckboxes = postsListEl.querySelectorAll('.post-select-cb');
      visibleCheckboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const pid = cb.dataset.postId;
        if (e.target.checked) {
          selectedPostIds.add(pid);
        } else {
          selectedPostIds.delete(pid);
        }
      });
      updateBulkToolbarUI();
    });
  }

  if (btnDeleteBulk) {
    btnDeleteBulk.addEventListener('click', () => {
      if (selectedPostIds.size === 0) return;
      promptDeleteBulkPosts();
    });
  }

  // Quick Delete All from User Form
  if (deleteUserForm) {
    deleteUserForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = targetUserInput.value.trim();
      if (!username) return;

      openConfirmModal(
        'Delete All Posts by User',
        `Are you sure you want to permanently delete user <strong>"${escapeHTML(username)}"</strong> and ALL their posts? This cannot be undone.`,
        async () => {
          const submitBtn = document.getElementById('btnSubmitDeleteUser');
          await withButtonLock(submitBtn, async () => {
            try {
              const res = await apiCall('admin-delete-user', {
                method: 'POST',
                headers: { Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify({ username })
              });

              if (!res.ok || !res.data.success) {
                throw new Error(res.data.message || 'Failed to delete user');
              }

              showToast(res.data.message || `User @${username} deleted`, 'success');
              targetUserInput.value = '';
              loadAdminData();
            } catch (err) {
              showToast(err.message || 'Delete operation failed', 'error');
            }
          });
        }
      );
    });
  }

  // Delete All Posts (Double Confirmation Danger Zone)
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', () => {
      openConfirmModal(
        '⚠️ Delete ALL Posts & Users',
        'Are you sure you want to delete ALL posts and users in the community database? This will permanently wipe all shared settings and reset the database to start new!',
        () => {
          openConfirmModal(
            '🚨 FINAL CONFIRMATION: Reset Database',
            'This is your final warning. Type of action: PERMANENT PURGE. All posts and user records will be deleted, and post numbering will start fresh at #1. Do you wish to execute now?',
            async () => {
              await withButtonLock(btnDeleteAll, async () => {
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
              });
            }
          );
        }
      );
    });
  }
}

// ─── Data Loading ──────────────────────────────────────────────────────────
async function loadAdminData() {
  if (loadingEl) loadingEl.style.display = 'flex';
  if (postsListEl) postsListEl.innerHTML = '';
  selectedPostIds.clear();
  updateBulkToolbarUI();

  try {
    // 1. Fetch posts
    const res = await apiCall('get-posts?page=1&limit=500', { method: 'GET' });
    if (!res.ok || !res.data.success) {
      throw new Error(res.data.message || 'Failed to fetch posts');
    }

    adminPosts = res.data.posts || [];
    const totalLikes = adminPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0);

    if (statPostsEl) statPostsEl.textContent = adminPosts.length;
    if (statLikesEl) statLikesEl.textContent = totalLikes;

    renderAdminPosts(searchInput ? searchInput.value.trim() : '');

    // 2. Fetch users in parallel
    await loadAdminUsers();

  } catch (err) {
    showToast(err.message || 'Failed to load admin data', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

async function loadAdminUsers() {
  if (!usersTableBody) return;
  usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);"><span class="spinner-sm"></span> Loading creators...</td></tr>';

  try {
    const res = await apiCall('admin-users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (!res.ok || !res.data.success) {
      throw new Error(res.data.message || 'Failed to fetch users');
    }

    adminUsers = res.data.data || [];
    if (statUsersEl) statUsersEl.textContent = adminUsers.length;
    renderAdminUsers();

  } catch (err) {
    console.error('loadAdminUsers error:', err);
    usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--accent-rose);">Failed to load users: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// ─── Render Users Table ────────────────────────────────────────────────────
function renderAdminUsers() {
  if (!usersTableBody) return;

  if (adminUsers.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No registered creators found.</td></tr>';
    return;
  }

  usersTableBody.innerHTML = adminUsers.map(user => {
    const safeUser = escapeHTML(user.username || 'Anonymous');
    const safeUserId = escapeHTML(String(user.userId || user.id || 'N/A'));
    const postCount = Number(user.postCount) || 0;
    const totalLikes = Number(user.totalLikes) || 0;
    const lastActive = user.latestPostDate ? (formatPublishedTime ? formatPublishedTime(user.latestPostDate).display : formatRelativeTime(user.latestPostDate)) : 'N/A';

    return `
      <tr data-user-id="${safeUserId}" data-username="${safeUser}">
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:28px; height:28px; border-radius:50%; background:rgba(255,119,0,0.15); color:var(--accent-ff); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem;">
              ${(safeUser[0] || 'U').toUpperCase()}
            </div>
            <strong>@${safeUser}</strong>
          </div>
        </td>
        <td><code style="font-size:0.75rem; color:var(--text-muted);">${safeUserId}</code></td>
        <td><span class="badge" style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:4px;">${postCount}</span></td>
        <td><span style="color:var(--accent-rose); font-weight:600;">❤️ ${totalLikes}</span></td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${lastActive}</td>
        <td style="text-align:right;">
          <button
            type="button"
            class="btn-danger"
            style="padding:5px 10px; font-size:0.75rem;"
            onclick="promptDeleteUser('${safeUserId}', '${safeUser}', this)"
          >
            Delete User & Posts
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── Render Posts List ─────────────────────────────────────────────────────
function renderAdminPosts(filterQuery = '') {
  if (!postsListEl) return;
  let list = [...adminPosts];

  if (filterQuery) {
    const term = filterQuery.toLowerCase();
    list = list.filter(p => {
      const matchId = String(p.id) === term || `#${p.id}` === term;
      const matchMongoId = String(p._id || '').toLowerCase().includes(term);
      const matchUser = (p.username || '').toLowerCase().includes(term);
      const matchTitle = (p.title || '').toLowerCase().includes(term);
      const matchSettings = (p.settings || '').toLowerCase().includes(term);
      return matchId || matchMongoId || matchUser || matchTitle || matchSettings;
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
      const safeId = p.id !== undefined ? String(p.id) : String(p._id);
      const safeUser = escapeHTML(p.username || 'Anonymous');
      const safeTitle = escapeHTML((p.title || '').trim());
      const safeSettings = escapeHTML(p.settings || '');
      const timeStr = formatPublishedTime ? formatPublishedTime(p.createdAt).display : formatRelativeTime(p.createdAt);
      const isChecked = selectedPostIds.has(safeId);

      return `
        <div class="admin-post-item" data-post-id="${safeId}">
          <div style="display:flex; align-items:center; gap:12px;">
            <input
              type="checkbox"
              class="admin-checkbox post-select-cb"
              data-post-id="${safeId}"
              ${isChecked ? 'checked' : ''}
              onchange="handlePostSelection('${safeId}', this.checked)"
            />
            <div class="admin-post-meta">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="post-id-badge">#${safeId}</span>
                <strong style="font-size:0.9rem;">${safeUser}</strong>
                ${safeTitle ? `<span style="font-weight:600; color:var(--accent-ice); font-size:0.85rem;">[${safeTitle}]</span>` : ''}
                <span style="font-size:0.75rem; color:var(--text-muted);">🕒 ${timeStr}</span>
                <span style="font-size:0.75rem; color:var(--accent-rose);">❤️ ${p.likes || 0}</span>
                ${p.image ? '<span style="font-size:0.75rem; color:var(--accent-ff);">🖼️ Image</span>' : ''}
              </div>
              <div class="admin-post-content">${safeSettings}</div>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <a href="post.html?id=${safeId}" target="_blank" class="btn-action" style="height:32px; font-size:0.75rem;">
              View ↗
            </a>
            <button
              type="button"
              class="btn-danger"
              style="padding:6px 12px; font-size:0.75rem;"
              onclick="promptDeleteSinglePost('${safeId}', this)"
            >
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ─── Bulk Selection Handling ───────────────────────────────────────────────
window.handlePostSelection = function (postId, isChecked) {
  const idStr = String(postId);
  if (isChecked) {
    selectedPostIds.add(idStr);
  } else {
    selectedPostIds.delete(idStr);
  }
  updateBulkToolbarUI();
};

function updateBulkToolbarUI() {
  const count = selectedPostIds.size;
  if (selectedCountBadge) {
    selectedCountBadge.textContent = `${count} selected`;
  }
  if (btnDeleteBulk) {
    btnDeleteBulk.disabled = count === 0;
    btnDeleteBulk.textContent = count > 0 ? `🗑️ Delete Selected (${count})` : '🗑️ Delete Selected';
  }

  // Update "Select All" checkbox state
  if (selectAllCb && postsListEl) {
    const visibleCheckboxes = postsListEl.querySelectorAll('.post-select-cb');
    if (visibleCheckboxes.length > 0) {
      selectAllCb.checked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    } else {
      selectAllCb.checked = false;
    }
  }
}

// ─── Bulk Deletion Execution ───────────────────────────────────────────────
function promptDeleteBulkPosts() {
  const count = selectedPostIds.size;
  if (count === 0) return;

  const idsArray = Array.from(selectedPostIds);

  openConfirmModal(
    `Delete ${count} Selected Posts`,
    `Are you sure you want to permanently delete <strong>${count}</strong> selected post(s)? This will remove them immediately from MongoDB and purge associated screenshots.`,
    async () => {
      await withButtonLock(btnDeleteBulk, async () => {
        try {
          const res = await apiCall('admin-delete-post', {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ selectedPostIds: idsArray })
          });

          if (!res.ok || !res.data.success) {
            throw new Error(res.data.message || 'Bulk delete failed');
          }

          const deletedCount = res.data.deletedCount || idsArray.length;
          showToast(`Successfully deleted ${deletedCount} posts ✓`, 'success');

          // Immediately remove deleted posts from client state
          const idSet = new Set(idsArray.map(String));
          adminPosts = adminPosts.filter(p => !idSet.has(String(p.id)) && !idSet.has(String(p._id)));
          selectedPostIds.clear();

          // Update stats
          if (statPostsEl) statPostsEl.textContent = adminPosts.length;
          const totalLikes = adminPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0);
          if (statLikesEl) statLikesEl.textContent = totalLikes;

          // Re-render
          updateBulkToolbarUI();
          renderAdminPosts(searchInput ? searchInput.value.trim() : '');
          loadAdminUsers(); // update user post counts

        } catch (err) {
          showToast(err.message || 'Bulk delete failed', 'error');
        }
      });
    }
  );
}

// ─── Single Post Deletion ──────────────────────────────────────────────────
window.promptDeleteSinglePost = function (postId, buttonEl) {
  openConfirmModal(
    'Delete Single Post',
    `Are you sure you want to permanently delete post <strong>#${escapeHTML(String(postId))}</strong>? This action cannot be undone.`,
    async () => {
      await withButtonLock(buttonEl, async () => {
        try {
          const res = await apiCall('admin-delete-post', {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ postId })
          });

          if (!res.ok || !res.data.success) {
            throw new Error(res.data.message || 'Failed to delete post');
          }

          showToast(res.data.message || `Post #${postId} deleted ✓`, 'success');

          // Mark button as deleted so withButtonLock won't restore
          if (buttonEl) buttonEl.dataset.locked = 'deleted';

          // Immediately remove from UI and state
          const idStr = String(postId);
          adminPosts = adminPosts.filter(p => String(p.id) !== idStr && String(p._id) !== idStr);
          selectedPostIds.delete(idStr);

          // Update stats
          if (statPostsEl) statPostsEl.textContent = adminPosts.length;
          const totalLikes = adminPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0);
          if (statLikesEl) statLikesEl.textContent = totalLikes;

          // Remove DOM element smoothly
          const itemEl = document.querySelector(`.admin-post-item[data-post-id="${postId}"]`);
          if (itemEl) itemEl.remove();

          updateBulkToolbarUI();
          loadAdminUsers(); // refresh author post counts in background

        } catch (err) {
          showToast(err.message || 'Failed to delete post', 'error');
        }
      });
    }
  );
};

// ─── User Deletion from Users Table ────────────────────────────────────────
window.promptDeleteUser = function (userId, username, buttonEl) {
  openConfirmModal(
    'Delete User & All Associated Posts',
    `Are you sure you want to permanently delete user <strong>@${escapeHTML(username)}</strong> (ID: ${escapeHTML(userId)}) and ALL of their shared posts?`,
    async () => {
      await withButtonLock(buttonEl, async () => {
        try {
          const res = await apiCall('admin-delete-user', {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ userId, username })
          });

          if (!res.ok || !res.data.success) {
            throw new Error(res.data.message || 'Failed to delete user');
          }

          showToast(res.data.message || `Deleted user @${username} and posts`, 'success');

          // Remove from adminUsers
          adminUsers = adminUsers.filter(u => String(u.userId) !== String(userId) && (u.username || '').toLowerCase() !== username.toLowerCase());
          if (statUsersEl) statUsersEl.textContent = adminUsers.length;

          // Remove all user's posts from adminPosts
          adminPosts = adminPosts.filter(p => (p.username || '').toLowerCase() !== username.toLowerCase() && String(p.userId) !== String(userId));
          if (statPostsEl) statPostsEl.textContent = adminPosts.length;
          const totalLikes = adminPosts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0);
          if (statLikesEl) statLikesEl.textContent = totalLikes;

          // Re-render both views
          renderAdminUsers();
          renderAdminPosts(searchInput ? searchInput.value.trim() : '');
          updateBulkToolbarUI();

        } catch (err) {
          showToast(err.message || 'Failed to delete user', 'error');
        }
      });
    }
  );
};

// ─── Modal Logic ───────────────────────────────────────────────────────────
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

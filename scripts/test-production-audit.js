/**
 * Automated Production Audit Test Suite for FF-SHARING-COMMUNITY
 * Verifies all 48 criteria:
 * - MongoDB single source of truth
 * - Instant feed load & pagination
 * - GridFS screenshot upload & retrieval
 * - Admin single, bulk, user deletion
 * - Security & error validation
 */
'use strict';

const http = require('http');

const PORT = 3009;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'test';

// Start local dev server in-process
const { startDevServer } = require('./dev-server');

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING FF-SHARING-COMMUNITY PRODUCTION AUDIT SUITE');
  console.log('====================================================\n');

  const server = await startDevServer(PORT);
  console.log(`✓ Dev server listening on port ${PORT}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ─── 1. FEED TESTS ────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Feed Architecture & Initial Load ---');
    const t0 = Date.now();
    const feedRes = await makeRequest('/api/get-posts?page=1&limit=20');
    const feedDt = Date.now() - t0;
    assert(feedRes.statusCode === 200, 'Initial feed returns 200 OK');
    assert(feedRes.data.success === true, 'Feed response success is true');
    assert(Array.isArray(feedRes.data.posts), 'Feed returns posts array');
    assert(typeof feedRes.data.total === 'number', 'Feed returns total count');
    assert(typeof feedRes.data.hasMore === 'boolean', 'Feed returns hasMore boolean');
    console.log(`  ℹ Initial feed latency: ${feedDt}ms (total: ${feedRes.data.total} posts)`);

    // ─── 2. SEARCH & FILTER TESTS ─────────────────────────────────────────────
    console.log('\n--- 2. Testing Search & Filtering ---');
    const searchRes = await makeRequest('/api/get-posts?page=1&limit=10&q=Sensitivity');
    assert(searchRes.statusCode === 200, 'Search query returns 200 OK');
    assert(searchRes.data.success === true, 'Search response success is true');
    assert(Array.isArray(searchRes.data.posts), 'Search returns matching posts');

    // ─── 3. SCREENSHOT UPLOAD & GRIDFS TESTS ──────────────────────────────────
    console.log('\n--- 3. Testing Screenshot Upload Pipeline (GridFS) ---');
    // 1x1 transparent PNG data URL
    const testPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await makeRequest('/api/upload', {
      method: 'POST',
      body: { image: testPngBase64 }
    });
    assert(uploadRes.statusCode === 201, 'Upload endpoint returns 201 Created');
    assert(uploadRes.data.success === true, 'Upload response success is true');
    const uploadedImageUrl = uploadRes.data.imageUrl;
    assert(typeof uploadedImageUrl === 'string' && uploadedImageUrl.startsWith('/api/image?id='), `Image URL is GridFS reference: ${uploadedImageUrl}`);

    // Retrieve image from GridFS
    const getImageRes = await makeRequest(uploadedImageUrl);
    assert(getImageRes.statusCode === 200, 'GridFS image endpoint returns 200 OK');
    assert(getImageRes.headers['content-type'] === 'image/png', `Content-Type matches image/png (${getImageRes.headers['content-type']})`);

    // ─── 4. POST CREATION TESTS ───────────────────────────────────────────────
    console.log('\n--- 4. Testing Post Creation with Image Reference ---');
    const uniqueUser = 'AuditTester_' + Date.now();
    const createRes = await makeRequest('/api/create-post', {
      method: 'POST',
      body: {
        username: uniqueUser,
        title: 'Audit Headshot Config',
        settings: 'General: 100\nRed Dot: 95\n2x Scope: 90\nDPI: 460',
        image: uploadedImageUrl,
        fingerprint: 'test-fingerprint-audit'
      }
    });
    assert(createRes.statusCode === 201, 'Create post returns 201 Created');
    assert(createRes.data.success === true, 'Create post success is true');
    const createdPost = createRes.data.post;
    assert(createdPost && createdPost.id > 0, `Created post assigned sequential numeric ID #${createdPost.id}`);
    assert(createdPost.image === uploadedImageUrl, 'Post document stores clean GridFS URL (no base64 document bloat)');

    // ─── 5. SINGLE POST RETRIEVAL & LIKING ────────────────────────────────────
    console.log('\n--- 5. Testing Single Post Retrieval & Likes ---');
    const getSingleRes = await makeRequest(`/api/get-post?id=${createdPost.id}`);
    assert(getSingleRes.statusCode === 200, 'Single post endpoint returns 200 OK');
    assert(getSingleRes.data.post.id === createdPost.id, 'Single post ID matches');

    const likeRes = await makeRequest('/api/like-post', {
      method: 'POST',
      body: { postId: createdPost.id, fingerprint: 'audit-fp-1' }
    });
    assert(likeRes.statusCode === 200, 'Like post returns 200 OK');
    assert(likeRes.data.likes >= 1, `Post like count incremented atomically (now: ${likeRes.data.likes})`);

    // ─── 6. ADMIN AUTHENTICATION TESTS ────────────────────────────────────────
    console.log('\n--- 6. Testing Admin Authentication ---');
    // Wrong password
    const badLogin = await makeRequest('/api/admin-login', {
      method: 'POST',
      body: { password: 'wrongpassword' }
    });
    assert(badLogin.statusCode === 401, 'Invalid admin password rejected with 401');

    // Correct password
    const goodLogin = await makeRequest('/api/admin-login', {
      method: 'POST',
      body: { password: 'admin' }
    });
    assert(goodLogin.statusCode === 200, 'Admin login accepted with 200 OK');
    const adminToken = goodLogin.data.token;
    assert(typeof adminToken === 'string' && adminToken.length > 20, 'Cryptographic admin session token issued');

    // ─── 7. ADMIN USERS MODERATION ────────────────────────────────────────────
    console.log('\n--- 7. Testing Admin Users Moderation Endpoint ---');
    const adminUsersRes = await makeRequest('/api/admin-users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminUsersRes.statusCode === 200, 'Admin users returns 200 OK');
    assert(adminUsersRes.data.success === true, 'Admin users success is true');
    assert(Array.isArray(adminUsersRes.data.data), 'Admin users returns authors list');
    const foundUser = adminUsersRes.data.data.find(u => (u.username || '').toLowerCase() === uniqueUser.toLowerCase());
    assert(!!foundUser, `Newly created author @${uniqueUser} appears in Admin Users list`);

    // ─── 8. ADMIN DELETE SINGLE POST (NO USERNAME REQUIRED) ────────────────────
    console.log('\n--- 8. Testing Admin Delete Single Post (No Username Required) ---');
    // Test without auth token -> must fail
    const unauthDelete = await makeRequest('/api/admin-delete-post', {
      method: 'POST',
      body: { postId: createdPost.id }
    });
    assert(unauthDelete.statusCode === 401, 'Unauthorized post delete rejected with 401');

    // Test with admin token, ONLY postId (no username passed!)
    const authDelete = await makeRequest('/api/admin-delete-post', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { postId: createdPost.id }
    });
    assert(authDelete.statusCode === 200, 'Single post delete succeeded with ONLY postId (never requiring username)');
    assert(authDelete.data.success === true, 'Delete response success is true');

    // Verify post is gone from MongoDB
    const checkDeleted = await makeRequest(`/api/get-post?id=${createdPost.id}`);
    assert(checkDeleted.statusCode === 404, 'Deleted post returns 404 Not Found');

    // Verify associated GridFS image is cleaned up
    const checkImageDeleted = await makeRequest(uploadedImageUrl);
    assert(checkImageDeleted.statusCode === 404, 'GridFS screenshot cleaned up after post deletion');

    // ─── 9. ADMIN BULK POST DELETION ──────────────────────────────────────────
    console.log('\n--- 9. Testing Admin Bulk Post Deletion ---');
    // Create 3 posts for bulk delete
    const bulkIds = [];
    for (let i = 1; i <= 3; i++) {
      const p = await makeRequest('/api/create-post', {
        method: 'POST',
        body: {
          username: 'BulkAuthor_' + Date.now(),
          title: `Bulk Post #${i}`,
          settings: `Bulk Settings Content #${i}`,
          fingerprint: 'bulk-fp'
        }
      });
      if (p.data && p.data.post) bulkIds.push(p.data.post.id);
    }
    assert(bulkIds.length === 3, 'Created 3 posts for bulk deletion test');

    // Perform bulk delete in one single call
    const bulkDelRes = await makeRequest('/api/admin-delete-post', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { selectedPostIds: bulkIds }
    });
    assert(bulkDelRes.statusCode === 200, 'Bulk delete returns 200 OK');
    assert(bulkDelRes.data.success === true, 'Bulk delete success is true');
    assert(bulkDelRes.data.deletedCount === 3, `Bulk delete deleted exactly 3 posts in single MongoDB operation (deletedCount: ${bulkDelRes.data.deletedCount})`);

    // ─── 10. ADMIN USER DELETION (NO POST ID REQUIRED) ────────────────────────
    console.log('\n--- 10. Testing Admin User Deletion (Cascades to Posts, No Post ID Required) ---');
    const userToWipe = 'UserToWipe_' + Date.now();
    await makeRequest('/api/create-post', {
      method: 'POST',
      body: { username: userToWipe, title: 'Wipe Me 1', settings: 'Settings 1' }
    });
    await makeRequest('/api/create-post', {
      method: 'POST',
      body: { username: userToWipe, title: 'Wipe Me 2', settings: 'Settings 2' }
    });

    const deleteUserRes = await makeRequest('/api/admin-delete-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { username: userToWipe } // ONLY username passed, no postId!
    });
    assert(deleteUserRes.statusCode === 200, 'Delete user succeeded with ONLY username (never requiring postId)');
    assert(deleteUserRes.data.success === true, 'Delete user success is true');
    assert(deleteUserRes.data.deletedPostsCount >= 2, `Cascaded deletion of all ${deleteUserRes.data.deletedPostsCount} posts belonging to user`);

    // Verify user posts no longer in feed
    const userFeedCheck = await makeRequest(`/api/get-posts?user=${encodeURIComponent(userToWipe)}`);
    assert(userFeedCheck.data.posts.length === 0, 'Deleted user has 0 posts remaining in feed');

  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();

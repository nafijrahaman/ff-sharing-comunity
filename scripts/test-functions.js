/**
 * Comprehensive Automated Test Suite for FF-SHARING-COMMUNITY Netlify Functions
 */

const createPostHandler = require('../netlify/functions/create-post').handler;
const getPostsHandler = require('../netlify/functions/get-posts').handler;
const getPostHandler = require('../netlify/functions/get-post').handler;
const likePostHandler = require('../netlify/functions/like-post').handler;
const adminLoginHandler = require('../netlify/functions/admin-login').handler;
const adminDeletePostHandler = require('../netlify/functions/admin-delete-post').handler;
const adminDeleteUserHandler = require('../netlify/functions/admin-delete-user').handler;
const adminDeleteAllHandler = require('../netlify/functions/admin-delete-all').handler;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 RUNNING FF-SHARING-COMMUNITY TEST SUITE');
  console.log('=============================================\n');

  // Test 1: Admin Login (Wrong Password)
  console.log('Test Group 1: Admin Authentication');
  const badLogin = await adminLoginHandler({
    httpMethod: 'POST',
    body: JSON.stringify({ password: 'wrong_password' })
  });
  assert(badLogin.statusCode === 401, 'Rejects invalid admin password with 401');

  // Test 2: Admin Login
  const correctPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
  const goodLogin = await adminLoginHandler({
    httpMethod: 'POST',
    body: JSON.stringify({ password: correctPassword })
  });
  const loginData = JSON.parse(goodLogin.body);
  assert(goodLogin.statusCode === 200 && !!loginData.token, 'Authenticates correct admin password and generates token');
  const adminToken = loginData.token;

  // Clean state: Purge all existing data before test suite runs
  await adminDeleteAllHandler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirm: 'CONFIRM_DELETE_ALL' })
  });

  // Test 3: Create Post Validation (Empty Username)
  console.log('\nTest Group 2: Post Creation & Validation');
  const emptyUserRes = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.1' },
    body: JSON.stringify({ username: '', settings: 'General: 100' })
  });
  assert(emptyUserRes.statusCode === 400, 'Rejects empty username with 400');

  // Test 4: Create Post 1
  const post1Res = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.1' },
    body: JSON.stringify({
      username: 'TestPlayer1',
      settings: 'General: 95\nRed Dot: 90\n2x Scope: 85'
    })
  });
  const post1Data = JSON.parse(post1Res.body);
  const post1Id = post1Data?.post?.id;
  assert(post1Res.statusCode === 201 && typeof post1Id === 'number', `Assigns sequential post ID (received: ${post1Id})`);

  // Test 5: Create Post 2 from same IP
  const post2Res = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.1' },
    body: JSON.stringify({
      username: 'TestPlayer1',
      settings: 'General: 99\nRed Dot: 94'
    })
  });
  const post2Data = JSON.parse(post2Res.body);
  const post2Id = post2Data?.post?.id;
  assert(post2Res.statusCode === 201 && post2Id === post1Id + 1, `Assigns strictly incrementing post ID (${post1Id} -> ${post2Id})`);

  // Test 6: Rate Limiting Enforcement (3rd post from same IP within 1 minute should be 429)
  console.log('\nTest Group 3: Server-side IP Rate Limiting');
  const post3Res = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.1' },
    body: JSON.stringify({
      username: 'Spammer',
      settings: 'General: 100'
    })
  });
  assert(post3Res.statusCode === 429, 'Rate limiter blocks 3rd post within 1 minute with HTTP 429');

  // Test 7: Get Posts Feed
  console.log('\nTest Group 4: Feed, Pagination & Search');
  const feedRes = await getPostsHandler({
    httpMethod: 'GET',
    queryStringParameters: { page: '1', limit: '10' }
  });
  const feedData = JSON.parse(feedRes.body);
  assert(feedRes.statusCode === 200 && Array.isArray(feedData.posts) && feedData.posts.length > 0, 'Retrieves community posts feed');

  // Test 8: Search by Keyword
  const searchKeywordRes = await getPostsHandler({
    httpMethod: 'GET',
    queryStringParameters: { q: 'TestPlayer1' }
  });
  const searchData = JSON.parse(searchKeywordRes.body);
  assert(searchData.posts.length >= 2, `Finds posts by username search (found: ${searchData.posts.length})`);

  // Test 9: Search by Post ID
  const searchIdRes = await getPostsHandler({
    httpMethod: 'GET',
    queryStringParameters: { q: `#${post1Id}` }
  });
  const searchIdData = JSON.parse(searchIdRes.body);
  assert(searchIdData.posts.length === 1 && searchIdData.posts[0].id === post1Id, `Finds exact post by #${post1Id} search`);

  // Test 10: Get Single Post by ID
  console.log('\nTest Group 5: Single Post Viewer');
  const singlePostRes = await getPostHandler({
    httpMethod: 'GET',
    queryStringParameters: { id: String(post1Id) }
  });
  const singleData = JSON.parse(singlePostRes.body);
  assert(singlePostRes.statusCode === 200 && singleData.post.id === post1Id, `Retrieves single post by ID #${post1Id}`);

  // Test 11: Get Non-Existent Post (404)
  const nonExistentRes = await getPostHandler({
    httpMethod: 'GET',
    queryStringParameters: { id: '999999' }
  });
  assert(nonExistentRes.statusCode === 404, 'Returns 404 for non-existent post ID');

  // Test 12: Like Post & Anti-Abuse
  console.log('\nTest Group 6: Likes & Anti-Abuse');
  const likeRes1 = await likePostHandler({
    httpMethod: 'POST',
    body: JSON.stringify({ postId: post1Id, fingerprint: 'fp_test_client_abc' })
  });
  const likeData1 = JSON.parse(likeRes1.body);
  assert(likeRes1.statusCode === 200 && likeData1.alreadyLiked === false, 'Allows first like from client fingerprint');

  const likeRes2 = await likePostHandler({
    httpMethod: 'POST',
    body: JSON.stringify({ postId: post1Id, fingerprint: 'fp_test_client_abc' })
  });
  const likeData2 = JSON.parse(likeRes2.body);
  assert(likeRes2.statusCode === 200 && likeData2.alreadyLiked === true, 'Blocks repeat like from same client fingerprint');

  // Test 13: Admin Delete Single Post
  console.log('\nTest Group 7: Admin Moderation');
  const deleteSingleRes = await adminDeletePostHandler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ postId: post2Id })
  });
  assert(deleteSingleRes.statusCode === 200, `Admin can delete single post by ID #${post2Id}`);

  // Verify deleted post is gone
  const verifyDeleted = await getPostHandler({
    httpMethod: 'GET',
    queryStringParameters: { id: String(post2Id) }
  });
  assert(verifyDeleted.statusCode === 404, 'Deleted post returns 404');

  // Test 14: Sequential ID is NOT reused after deletion
  const newPostAfterDelete = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.99' },
    body: JSON.stringify({
      username: 'NextPlayer',
      settings: 'General: 88'
    })
  });
  const newPostData = JSON.parse(newPostAfterDelete.body);
  assert(newPostData.post.id === post2Id + 1, `Deleted ID was not reused; next post received sequential ID ${newPostData.post.id}`);

  // Test 15: Admin Delete All Posts by User
  const deleteUserRes = await adminDeleteUserHandler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ username: 'TestPlayer1' })
  });
  const deleteUserData = JSON.parse(deleteUserRes.body);
  assert(deleteUserRes.statusCode === 200, 'Admin can delete all posts by username');

  // Test 16: Verify Default 20 Posts Limit
  console.log('\nTest Group 8: 20-Post Default Limit & Full Database Purge');
  const limitRes = await getPostsHandler({
    httpMethod: 'GET',
    queryStringParameters: {}
  });
  const limitData = JSON.parse(limitRes.body);
  assert(limitData.limit === 20, `Default limit is 20 posts per page (received: ${limitData.limit})`);

  // Test 17: Admin Delete All (Full Database Reset)
  const deleteAllRes = await adminDeleteAllHandler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirm: 'CONFIRM_DELETE_ALL' })
  });
  assert(deleteAllRes.statusCode === 200, 'Admin can execute complete database purge');

  // Test 18: New post created after purge starts fresh at ID #1
  const freshPostRes = await createPostHandler({
    httpMethod: 'POST',
    headers: { 'client-ip': '192.168.1.55' },
    body: JSON.stringify({
      username: 'FreshStarter',
      settings: 'General: 100\nRed Dot: 100'
    })
  });
  const freshPostData = JSON.parse(freshPostRes.body);
  assert(freshPostData?.post?.id === 1, `After Delete All purge, new post started fresh at ID #1 (received: #${freshPostData?.post?.id})`);

  // Summary
  console.log('\n=============================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log('=============================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

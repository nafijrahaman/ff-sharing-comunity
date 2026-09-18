/**
 * End-to-End HTTP Integration Test for running server on http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('🌐 RUNNING E2E HTTP INTEGRATION TESTS on', BASE_URL);
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function check(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Check Homepage HTTP 200
    const homeRes = await fetch(`${BASE_URL}/`);
    const homeHtml = await homeRes.text();
    check(homeRes.status === 200 && homeHtml.includes('FF-SHARING-COMMUNITY'), 'Homepage loads index.html with 200 OK');

    // 2. Check Static Assets
    const cssRes = await fetch(`${BASE_URL}/css/style.css`);
    check(cssRes.status === 200 && cssRes.headers.get('content-type')?.includes('text/css'), 'style.css loads with 200 OK');

    const manifestRes = await fetch(`${BASE_URL}/manifest.json`);
    const manifestJson = await manifestRes.json();
    check(manifestRes.status === 200 && manifestJson.name === 'FF-SHARING-COMMUNITY', 'manifest.json loads with 200 OK');

    const swRes = await fetch(`${BASE_URL}/sw.js`);
    check(swRes.status === 200, 'sw.js loads with 200 OK');

    // 3. Check Post Routing Rewrite (/post/1)
    const postRouteRes = await fetch(`${BASE_URL}/post/1`);
    const postRouteHtml = await postRouteRes.text();
    check(postRouteRes.status === 200 && postRouteHtml.includes('single-post-wrapper'), '/post/:id route successfully rewrites to post.html with 200 OK');

    // 4. Check Admin Routing Rewrite (/admin)
    const adminRouteRes = await fetch(`${BASE_URL}/admin`);
    const adminRouteHtml = await adminRouteRes.text();
    check(adminRouteRes.status === 200 && adminRouteHtml.includes('FF-SHARING-COMMUNITY ADMIN'), '/admin route successfully rewrites to admin.html with 200 OK');

    // 5. Check Netlify Functions: Create Post via HTTP
    const createPostRes = await fetch(`${BASE_URL}/.netlify/functions/create-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'client-ip': '10.0.0.1' },
      body: JSON.stringify({
        username: 'ViperGamer_99',
        settings: 'General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82'
      })
    });
    const createPostData = await createPostRes.json();
    check(createPostRes.status === 201 && createPostData.success && createPostData.post.id >= 4, `create-post endpoint created post #${createPostData.post?.id}`);

    const createdId = createPostData.post.id;

    // 6. Check Netlify Functions: Get Posts Feed via HTTP
    const getPostsRes = await fetch(`${BASE_URL}/.netlify/functions/get-posts?page=1&limit=10`);
    const getPostsData = await getPostsRes.json();
    check(getPostsRes.status === 200 && getPostsData.posts.some(p => p.id === createdId), 'get-posts endpoint returns feed containing new post');

    // 7. Check Netlify Functions: Get Single Post via HTTP
    const getPostRes = await fetch(`${BASE_URL}/.netlify/functions/get-post?id=${createdId}`);
    const getPostData = await getPostRes.json();
    check(getPostRes.status === 200 && getPostData.post.username === 'ViperGamer_99', `get-post endpoint returns details for post #${createdId}`);

    // 8. Check Netlify Functions: Like Post via HTTP
    const likeRes = await fetch(`${BASE_URL}/.netlify/functions/like-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: createdId, fingerprint: 'fp_e2e_browser_test_client' })
    });
    const likeData = await likeRes.json();
    check(likeRes.status === 200 && likeData.likes === 1, 'like-post endpoint increments likes count to 1');

    // 9. Check Search functionality by keyword and username
    const searchRes = await fetch(`${BASE_URL}/.netlify/functions/get-posts?q=headshot`);
    const searchData = await searchRes.json();
    check(searchRes.status === 200 && searchData.posts.length > 0 && Array.isArray(searchData.matchedUsers) && searchData.matchedUsers.length > 0, 'get-posts?q=headshot returns matching posts and matchedUsers summary');

    // 10. Check Filter by User / Creator Profile
    const userRes = await fetch(`${BASE_URL}/.netlify/functions/get-posts?user=HeadshotKing`);
    const userData = await userRes.json();
    check(userRes.status === 200 && userData.posts.every(p => p.username === 'HeadshotKing') && userData.userProfile?.username === 'HeadshotKing', 'get-posts?user=HeadshotKing returns userProfile and filtered creator posts');

    // 11. Check Admin Login via HTTP
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword })
    });
    const adminLoginData = await adminLoginRes.json();
    check(adminLoginRes.status === 200 && !!adminLoginData.token, 'admin-login endpoint authenticates with token');

    console.log('\n======================================================');
    console.log(`🏁 E2E HTTP TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('E2E test error:', err);
    process.exit(1);
  }
}

runE2ETests();

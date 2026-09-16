/**
 * Complete Search & UI Verification Test
 */
const http = require('http');

async function testSearchAndProfileAPI() {
  console.log('\n--- VERIFYING SEARCH & PROFILE API PAYLOADS ---');

  // Test 1: Keyword search 'headshot'
  const res1 = await fetch('http://localhost:3000/.netlify/functions/get-posts?q=headshot');
  const data1 = await res1.json();
  console.log(`[1] Search 'headshot': status=${res1.status}, total=${data1.total}, matchedUsers=${data1.matchedUsers.length}`);
  if (!data1.matchedUsers.some(u => u.username === 'HeadshotKing')) {
    throw new Error("Expected HeadshotKing in matchedUsers for 'headshot' search");
  }
  console.log('    ✓ Matched users found:', data1.matchedUsers.map(u => `${u.username} (${u.postCount} posts, ${u.totalLikes} likes)`).join(', '));

  // Test 2: Search with numbers/terms '98'
  const res2 = await fetch('http://localhost:3000/.netlify/functions/get-posts?q=98');
  const data2 = await res2.json();
  console.log(`[2] Search '98': status=${res2.status}, total=${data2.total}, matchedPosts=${data2.posts.length}`);
  if (data2.posts.length === 0) {
    throw new Error("Expected posts with '98' settings");
  }
  console.log('    ✓ Found posts matching 98:', data2.posts.map(p => `#${p.id} by ${p.username}`).join(', '));

  // Test 3: Filter by username 'HeadshotKing'
  const res3 = await fetch('http://localhost:3000/.netlify/functions/get-posts?user=HeadshotKing');
  const data3 = await res3.json();
  console.log(`[3] Filter by user 'HeadshotKing': status=${res3.status}, userProfile=${data3.userProfile?.username}, posts=${data3.posts.length}`);
  if (!data3.userProfile || data3.userProfile.username !== 'HeadshotKing') {
    throw new Error('Expected userProfile for HeadshotKing');
  }
  console.log(`    ✓ User profile stats: ${data3.userProfile.postCount} posts, ${data3.userProfile.totalLikes} likes`);

  // Test 4: Filter by case-insensitive username 'shadowninja_ff'
  const res4 = await fetch('http://localhost:3000/.netlify/functions/get-posts?user=shadowninja_ff');
  const data4 = await res4.json();
  console.log(`[4] Filter by user 'shadowninja_ff': status=${res4.status}, userProfile=${data4.userProfile?.username}, posts=${data4.posts.length}`);
  if (!data4.userProfile || data4.posts.length === 0) {
    throw new Error('Expected posts for ShadowNinja_FF');
  }
  console.log(`    ✓ Found creator ${data4.userProfile.username} with ${data4.posts.length} posts`);

  // Test 5: Verify static assets
  const htmlRes = await fetch('http://localhost:3000/');
  const htmlText = await htmlRes.text();
  const hasUserResultsContainer = htmlText.includes('id="userSearchResults"');
  const hasActiveProfileBanner = htmlText.includes('id="activeUserProfileBanner"');
  const hasSearchTags = htmlText.includes('search-tags-row');
  console.log(`[5] HTML markup check: userSearchResults=${hasUserResultsContainer}, activeUserProfileBanner=${hasActiveProfileBanner}, searchTags=${hasSearchTags}`);

  if (!hasUserResultsContainer || !hasActiveProfileBanner || !hasSearchTags) {
    throw new Error('Missing new markup in index.html');
  }

  console.log('\n🎉 ALL SEARCH & SOCIAL PROFILE TESTS PASSED SUCCESSFULLY!\n');
}

testSearchAndProfileAPI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

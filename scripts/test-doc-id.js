const API_KEY = 'nrdb_live_b9719c563644853f6c54e725eb37d13f5b71d4da5c5fe429';

async function testDocId() {
  console.log('--- 1. POST without id ---');
  const r1 = await fetch('https://db.nafij.me/api/v1/data/test_coll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ name: 'AutoIdTest' })
  });
  const d1 = await r1.json();
  console.log('Created auto doc:', d1);

  const autoDocId = d1.data?.id;
  console.log('Auto doc ID:', autoDocId);

  console.log('--- 2. GET by auto doc ID ---');
  const g1 = await fetch('https://db.nafij.me/api/v1/data/test_coll/' + autoDocId, {
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  console.log('GET auto doc result:', await g1.json());

  console.log('--- 3. DELETE by auto doc ID ---');
  const del1 = await fetch('https://db.nafij.me/api/v1/data/test_coll/' + autoDocId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  console.log('DELETE auto doc result:', await del1.json());

  console.log('\n--- 4. POST with explicit id "custom_123" ---');
  const r2 = await fetch('https://db.nafij.me/api/v1/data/test_coll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ id: 'custom_123', name: 'CustomIdTest' })
  });
  const d2 = await r2.json();
  console.log('Created custom doc:', d2);

  const customDocId = d2.data?.id;
  console.log('Custom doc ID:', customDocId);

  console.log('--- 5. DELETE by custom doc ID ---');
  const del2 = await fetch('https://db.nafij.me/api/v1/data/test_coll/' + customDocId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  console.log('DELETE custom doc result:', await del2.json());
}

testDocId();

const API_KEY = 'nrdb_live_b9719c563644853f6c54e725eb37d13f5b71d4da5c5fe429';

async function testOldDelete() {
  console.log('Testing deleting id 13...');
  const r1 = await fetch('https://db.nafij.me/api/v1/data/posts/13', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  console.log('Result for /13:', await r1.json());

  console.log('Testing deleting id doc_ec1f1dc19d0d016f852e7d6e...');
  const r2 = await fetch('https://db.nafij.me/api/v1/data/posts/doc_ec1f1dc19d0d016f852e7d6e', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  console.log('Result for doc_...:', await r2.json());
}

testOldDelete();

const API_KEY = 'nrdb_live_b9719c563644853f6c54e725eb37d13f5b71d4da5c5fe429';

async function inspect() {
  const r = await fetch('https://db.nafij.me/api/v1/data/posts?limit=200', {
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  });
  const d = await r.json();
  console.log('Total items in NRDB:', d.data.length);
  console.log('All items:', JSON.stringify(d.data, null, 2));
}

inspect();

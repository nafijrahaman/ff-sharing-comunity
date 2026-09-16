const fs = require('fs');

async function getDocs() {
  try {
    const r = await fetch('https://db.nafij.me/_next/static/chunks/app/docs/page-a6af77751c1eed65.js');
    const js = await r.text();
    fs.writeFileSync('scripts/nrdb_docs_chunk.js', js);
    
    // Find all endpoints
    const endpoints = js.match(/\/api\/v1\/[a-zA-Z0-9_\-\/]+/g) || [];
    console.log('Unique endpoints:', [...new Set(endpoints)]);
  } catch (err) {
    console.error('Error fetching docs chunk:', err);
  }
}

getDocs();

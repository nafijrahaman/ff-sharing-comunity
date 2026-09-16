const { getPostsList } = require('../netlify/functions/_nrdb');

async function check() {
  const res = await getPostsList({ search: '#1' });
  console.log('Search #1 count:', res.posts.length);
  console.log('Search #1 posts:', res.posts.map(p => ({ id: p.id, user: p.username, settings: p.settings.substring(0, 30) })));
}

check();

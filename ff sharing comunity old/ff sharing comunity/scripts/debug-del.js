const { deletePostById, getPostById, insertPost, getNextPostId } = require('../netlify/functions/_nrdb');

async function debugDel() {
  const nextId = await getNextPostId();
  console.log('1. Inserting test post with ID:', nextId);
  const created = await insertPost({
    postId: nextId,
    username: 'DelTest',
    settings: 'Settings test'
  });
  console.log('Created:', created);

  console.log('2. Fetching right after create:');
  const found1 = await getPostById(nextId);
  console.log('Found 1:', found1);

  console.log('3. Deleting post ID:', nextId);
  const delRes = await deletePostById(nextId);
  console.log('Delete result:', delRes);

  console.log('4. Fetching right after delete:');
  const found2 = await getPostById(nextId);
  console.log('Found 2:', found2);
}

debugDel();

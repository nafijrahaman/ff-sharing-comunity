const { insertPost, getNextPostId, deleteAllPosts } = require('../netlify/functions/_nrdb');

const SEED_DATA = [
  {
    username: 'HeadshotKing_FF',
    settings: 'General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82\nSniper Scope: 65\nFree Look: 70\nFire Button: 48%\nDPI: 440'
  },
  {
    username: 'ShadowNinja',
    settings: 'General: 100\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 55\nFree Look: 80\nCustom HUD: 3 Finger Claw\nQuick Weapon Switch: ON'
  },
  {
    username: 'ProSniper99',
    settings: 'General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Instant Drag)\nFree Look: 50\nGraphics: Smooth + High FPS'
  },
  {
    username: 'ThunderStrike',
    settings: 'General: 92\nRed Dot: 88\n2x Scope: 84\n4x Scope: 78\nSniper Scope: 60\nFree Look: 65\nDPI: 480\nFire Button: 52%'
  },
  {
    username: 'ViperX_Gaming',
    settings: 'General: 100\nRed Dot: 100\n2x Scope: 96\n4x Scope: 92\nSniper Scope: 70\nFree Look: 85\n2 Finger Fast Drag'
  },
  {
    username: 'AWM_Specialist',
    settings: 'General: 80\nRed Dot: 75\n2x Scope: 70\n4x Scope: 65\nSniper Scope: 100\nFree Look: 40\nQuick Reload: ON'
  },
  {
    username: 'SmoothOperator',
    settings: 'General: 96\nRed Dot: 91\n2x Scope: 86\n4x Scope: 80\nSniper Scope: 50\nFree Look: 75\nLow End 3GB RAM setting'
  },
  {
    username: 'RushMaster_BD',
    settings: 'General: 100\nRed Dot: 98\n2x Scope: 95\n4x Scope: 90\nSniper Scope: 60\nFree Look: 90\n4 Finger Claw HUD'
  },
  {
    username: 'OneTapLegend',
    settings: 'General: 99\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 75\nFree Look: 70\nFire Button: 45%\nDPI: 510'
  },
  {
    username: 'GhostRider_FF',
    settings: 'General: 94\nRed Dot: 89\n2x Scope: 82\n4x Scope: 77\nSniper Scope: 58\nFree Look: 60\nGraphics: Ultra + High Res'
  },
  {
    username: 'EagleEye_Shooter',
    settings: 'General: 88\nRed Dot: 84\n2x Scope: 79\n4x Scope: 74\nSniper Scope: 85\nFree Look: 55\nLeft Fire Button: Always'
  },
  {
    username: 'BlazeWarrior',
    settings: 'General: 97\nRed Dot: 93\n2x Scope: 89\n4x Scope: 84\nSniper Scope: 62\nFree Look: 68\nFire Button: 50%'
  },
  {
    username: 'SilentKiller_07',
    settings: 'General: 90\nRed Dot: 85\n2x Scope: 80\n4x Scope: 75\nSniper Scope: 65\nFree Look: 50\nStandard HUD'
  },
  {
    username: 'CrimsonDemon',
    settings: 'General: 100\nRed Dot: 96\n2x Scope: 92\n4x Scope: 88\nSniper Scope: 70\nFree Look: 80\nFast Drag Setting'
  },
  {
    username: 'ApexPredator_FF',
    settings: 'General: 95\nRed Dot: 90\n2x Scope: 85\n4x Scope: 80\nSniper Scope: 55\nFree Look: 65\nDPI: 460'
  },
  {
    username: 'Phoenix_Reborn',
    settings: 'General: 98\nRed Dot: 94\n2x Scope: 90\n4x Scope: 86\nSniper Scope: 68\nFree Look: 72\nSmooth Drag Headshot'
  },
  {
    username: 'TitanSlayer',
    settings: 'General: 86\nRed Dot: 82\n2x Scope: 76\n4x Scope: 72\nSniper Scope: 90\nFree Look: 48\nSniper & Shotgun Combo'
  },
  {
    username: 'NightCrawler',
    settings: 'General: 100\nRed Dot: 100\n2x Scope: 100\n4x Scope: 95\nSniper Scope: 80\nFree Look: 100\nFull 100 Everything'
  },
  {
    username: 'CyberNinja_99',
    settings: 'General: 93\nRed Dot: 87\n2x Scope: 83\n4x Scope: 78\nSniper Scope: 52\nFree Look: 66\n3 Finger Setup'
  },
  {
    username: 'FrostBite_FF',
    settings: 'General: 96\nRed Dot: 92\n2x Scope: 87\n4x Scope: 82\nSniper Scope: 64\nFree Look: 70\nFire Button: 46%'
  },
  {
    username: 'DragonLord_BD',
    settings: 'General: 99\nRed Dot: 95\n2x Scope: 91\n4x Scope: 87\nSniper Scope: 72\nFree Look: 82\nPage 2 Highlight Setting'
  },
  {
    username: 'SniperQueen',
    settings: 'General: 82\nRed Dot: 78\n2x Scope: 74\n4x Scope: 68\nSniper Scope: 98\nFree Look: 42\nAWM + M82B Double Sniper'
  },
  {
    username: 'HyperSpeed',
    settings: 'General: 100\nRed Dot: 97\n2x Scope: 94\n4x Scope: 89\nSniper Scope: 66\nFree Look: 88\nFast Movement Sensitivity'
  },
  {
    username: 'DesertEagle_Pro',
    settings: 'General: 97\nRed Dot: 93\n2x Scope: 88\n4x Scope: 83\nSniper Scope: 60\nFree Look: 70\nOne Tap Pistol Specialist'
  },
  {
    username: 'UltraChampion',
    settings: 'General: 100\nRed Dot: 96\n2x Scope: 93\n4x Scope: 89\nSniper Scope: 75\nFree Look: 85\nTournament Grandmaster Sensitivity'
  }
];

async function seed() {
  console.log('Purging database before seeding...');
  await deleteAllPosts();

  console.log(`Seeding ${SEED_DATA.length} community posts (demonstrates Page 1 & Page 2 top category boxes)...`);
  for (let i = 0; i < SEED_DATA.length; i++) {
    const post = SEED_DATA[i];
    const postId = await getNextPostId();
    await insertPost({
      postId,
      username: post.username,
      settings: post.settings,
      likes: Math.floor(Math.random() * 50) + 5
    });
    console.log(`  ✓ Seeded post #${postId}: @${post.username}`);
  }
  console.log('\n🎉 Seeding complete! Total posts: 25 (Page 1: 20 posts, Page 2: 5 posts)');
}

seed().catch(console.error);

/**
 * FF-SHARING-COMMUNITY — Production MongoDB Seeding Script
 * Seeds high-quality Free Fire community settings into MongoDB Atlas.
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^['"](.*)['"]$/, '$1');
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}

const { getDb, getNextPostId } = require('../api/_db');

const SEED_DATA = [
  {
    username: 'HeadshotKing_FF',
    title: '🎯 One-Tap Headshot Pro Sensitivity & DPI',
    settings: 'General: 98\nRed Dot: 92\n2x Scope: 88\n4x Scope: 82\nSniper Scope: 65\nFree Look: 70\nFire Button: 48%\nDPI: 440'
  },
  {
    username: 'ShadowNinja',
    title: '⚡ Pro 3-Finger Custom HUD & Sensitivity',
    settings: 'General: 100\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 55\nFree Look: 80\nCustom HUD: 3 Finger Claw\nQuick Weapon Switch: ON'
  },
  {
    username: 'ProSniper99',
    title: '🔭 Fast Drag Sniper Settings + High FPS',
    settings: 'General: 85\nRed Dot: 80\n2x Scope: 75\n4x Scope: 70\nSniper Scope: 95 (Instant Drag)\nFree Look: 50\nGraphics: Smooth + High FPS'
  },
  {
    username: 'ThunderStrike',
    title: '⚡ Fast Drag Auto Headshot Settings',
    settings: 'General: 92\nRed Dot: 88\n2x Scope: 84\n4x Scope: 78\nSniper Scope: 60\nFree Look: 65\nDPI: 480\nFire Button: 52%'
  },
  {
    username: 'ViperX_Gaming',
    title: '🔥 2-Finger Fast Drag Headshot Sensitivity',
    settings: 'General: 100\nRed Dot: 100\n2x Scope: 96\n4x Scope: 92\nSniper Scope: 70\nFree Look: 85\n2 Finger Fast Drag'
  },
  {
    username: 'AWM_Specialist',
    title: '🎯 Ultimate AWM Double Sniper Settings',
    settings: 'General: 80\nRed Dot: 75\n2x Scope: 70\n4x Scope: 65\nSniper Scope: 100\nFree Look: 40\nQuick Reload: ON'
  },
  {
    username: 'SmoothOperator',
    title: '📱 Low-End 2GB/3GB RAM Lag Fix Settings',
    settings: 'General: 96\nRed Dot: 91\n2x Scope: 86\n4x Scope: 80\nSniper Scope: 50\nFree Look: 75\nLow End 3GB RAM setting'
  },
  {
    username: 'RushMaster_BD',
    title: '💥 4-Finger Claw Rusher Settings',
    settings: 'General: 100\nRed Dot: 98\n2x Scope: 95\n4x Scope: 90\nSniper Scope: 60\nFree Look: 90\n4 Finger Claw HUD'
  },
  {
    username: 'OneTapLegend',
    title: '⚡ Perfect One-Tap DPI 510 Settings',
    settings: 'General: 99\nRed Dot: 95\n2x Scope: 90\n4x Scope: 85\nSniper Scope: 75\nFree Look: 70\nFire Button: 45%\nDPI: 510'
  },
  {
    username: 'GhostRider_FF',
    title: '🏆 Ultra High Res Graphics + Headshot',
    settings: 'General: 94\nRed Dot: 89\n2x Scope: 82\n4x Scope: 77\nSniper Scope: 58\nFree Look: 60\nGraphics: Ultra + High Res'
  },
  {
    username: 'EagleEye_Shooter',
    title: '🦅 Left Fire Button Always On Sensitivity',
    settings: 'General: 88\nRed Dot: 84\n2x Scope: 79\n4x Scope: 74\nSniper Scope: 85\nFree Look: 55\nLeft Fire Button: Always'
  },
  {
    username: 'BlazeWarrior',
    title: '🔥 Blaze Drag Sensitivity + Fire Button 50%',
    settings: 'General: 97\nRed Dot: 93\n2x Scope: 89\n4x Scope: 84\nSniper Scope: 62\nFree Look: 68\nFire Button: 50%'
  },
  {
    username: 'SilentKiller_07',
    title: '🎯 Balanced Standard HUD Settings',
    settings: 'General: 90\nRed Dot: 85\n2x Scope: 80\n4x Scope: 75\nSniper Scope: 65\nFree Look: 50\nStandard HUD'
  },
  {
    username: 'CrimsonDemon',
    title: '👹 Demon Fast Drag DPI 460',
    settings: 'General: 100\nRed Dot: 96\n2x Scope: 92\n4x Scope: 88\nSniper Scope: 70\nFree Look: 80\nFast Drag Setting'
  },
  {
    username: 'NovaStorm',
    title: '⚡ Nova Storm Max Sensitivity Settings',
    settings: 'General: 95\nRed Dot: 90\n2x Scope: 85\n4x Scope: 80\nSniper Scope: 60\nFree Look: 75\nGyro: OFF'
  },
  {
    username: 'ZenithGamer',
    title: '🎮 Smooth 90 FPS Ranked Match Sensitivity',
    settings: 'General: 93\nRed Dot: 87\n2x Scope: 83\n4x Scope: 79\nSniper Scope: 55\nFree Look: 65\nSmooth 90 FPS'
  },
  {
    username: 'ApexPredator_FF',
    title: '🥇 Grandmaster Solo vs Squad Settings',
    settings: 'General: 100\nRed Dot: 97\n2x Scope: 93\n4x Scope: 89\nSniper Scope: 72\nFree Look: 85\nFire Button: 46%'
  },
  {
    username: 'RaptorStrike',
    title: '🎯 Fast Scope In & Out Sensitivity',
    settings: 'General: 89\nRed Dot: 83\n2x Scope: 78\n4x Scope: 73\nSniper Scope: 88\nFree Look: 45\nFast Scope'
  },
  {
    username: 'PhantomAssault',
    title: '👻 Phantom Claw 3-Finger Settings',
    settings: 'General: 98\nRed Dot: 94\n2x Scope: 90\n4x Scope: 86\nSniper Scope: 65\nFree Look: 78\nCustom HUD 3-Finger'
  },
  {
    username: 'TitanBuster',
    title: '🛡️ Heavy Rusher Short Range Headshot',
    settings: 'General: 96\nRed Dot: 92\n2x Scope: 87\n4x Scope: 81\nSniper Scope: 58\nFree Look: 70\nFire Button: 52%\nDPI: 400'
  },
  {
    username: 'CyberNinja_99',
    title: '⚡ Cyber Headshot & Sniping Combo',
    settings: 'General: 100\nRed Dot: 95\n2x Scope: 91\n4x Scope: 87\nSniper Scope: 78\nFree Look: 82\nInstant Drag'
  },
  {
    username: 'HyperSpeed_FF',
    title: '🚀 Maximum Drag Speed & Fire Button 42%',
    settings: 'General: 100\nRed Dot: 100\n2x Scope: 98\n4x Scope: 95\nSniper Scope: 80\nFree Look: 90\nFire Button: 42%\nDPI: 540'
  },
  {
    username: 'DragonBreath',
    title: '🐉 Dragon Fire Drag Settings',
    settings: 'General: 94\nRed Dot: 90\n2x Scope: 86\n4x Scope: 82\nSniper Scope: 64\nFree Look: 68\nGraphics: Standard'
  },
  {
    username: 'Vortex_X',
    title: '🌀 Vortex Smooth 60 FPS Sensitivity',
    settings: 'General: 97\nRed Dot: 93\n2x Scope: 88\n4x Scope: 83\nSniper Scope: 66\nFree Look: 72\nDPI: 460'
  },
  {
    username: 'UltraChampion',
    title: '🏆 Tournament Grandmaster Sensitivity',
    settings: 'General: 100\nRed Dot: 96\n2x Scope: 93\n4x Scope: 89\nSniper Scope: 75\nFree Look: 85\nTournament Grandmaster Sensitivity'
  }
];

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  const db = await getDb();

  console.log('Purging existing posts before seeding...');
  await db.collection('posts').deleteMany({});
  await db.collection('users').deleteMany({});
  await db.collection('counters').updateOne({ _id: 'postId' }, { $set: { seq: 0 } }, { upsert: true });

  console.log(`Seeding ${SEED_DATA.length} community posts into MongoDB...`);

  for (let i = 0; i < SEED_DATA.length; i++) {
    const item = SEED_DATA[i];
    const nextId = await getNextPostId(db);
    const userId = 'user_' + item.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const likes = Math.floor(Math.random() * 50) + 5;
    const createdAt = new Date(Date.now() - (SEED_DATA.length - i) * 3600000);

    await db.collection('posts').insertOne({
      postId: nextId,
      userId,
      username: item.username,
      title: item.title,
      settings: item.settings,
      image: '',
      likes,
      likedBy: [],
      createdAt
    });

    await db.collection('users').updateOne(
      { userId },
      {
        $set: { username: item.username, lastActiveAt: createdAt },
        $inc: { postCount: 1 },
        $setOnInsert: { createdAt }
      },
      { upsert: true }
    );

    console.log(`  ✓ Seeded post #${nextId}: @${item.username}`);
  }

  console.log(`\n🎉 Seeding complete! Total MongoDB posts: ${SEED_DATA.length}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});

/**
 * Offline & Local File Protocol (file://) Compatibility Test
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('\n======================================================');
console.log('📁 TESTING LOCAL FILE & OFFLINE COMPATIBILITY');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

const htmlFiles = ['index.html', 'post.html', 'admin.html'];

htmlFiles.forEach(file => {
  const filePath = path.join(ROOT_DIR, file);
  assert(fs.existsSync(filePath), `${file} exists on local file system`);
  
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify no absolute root paths for assets and scripts
  const hasAbsoluteCss = /href=["']\/css\//.test(content);
  const hasAbsoluteJs = /src=["']\/js\//.test(content);
  const hasAbsoluteAssets = /href=["']\/assets\//.test(content) || /src=["']\/assets\//.test(content);
  const hasAbsoluteManifest = /href=["']\/manifest\.json["']/.test(content);

  assert(!hasAbsoluteCss, `${file}: Does NOT contain broken absolute /css/ path`);
  assert(!hasAbsoluteJs, `${file}: Does NOT contain broken absolute /js/ path`);
  assert(!hasAbsoluteAssets, `${file}: Does NOT contain broken absolute /assets/ path`);
  assert(!hasAbsoluteManifest, `${file}: Does NOT contain broken absolute /manifest.json path`);

  // Verify relative links exist on disk
  const scriptMatches = [...content.matchAll(/src=["'](\.?\/js\/[^"']+)["']/g)];
  scriptMatches.forEach(match => {
    const relScript = match[1].replace(/^\.\//, '');
    const fullScriptPath = path.join(ROOT_DIR, relScript);
    assert(fs.existsSync(fullScriptPath), `${file} -> Script exists: ${relScript}`);
  });

  const styleMatches = [...content.matchAll(/href=["'](\.?\/css\/[^"']+)["']/g)];
  styleMatches.forEach(match => {
    const relStyle = match[1].replace(/^\.\//, '');
    const fullStylePath = path.join(ROOT_DIR, relStyle);
    assert(fs.existsSync(fullStylePath), `${file} -> Stylesheet exists: ${relStyle}`);
  });
});

// Check icons and manifest
assert(fs.existsSync(path.join(ROOT_DIR, 'manifest.json')), 'manifest.json exists');
assert(fs.existsSync(path.join(ROOT_DIR, 'assets', 'favicon.svg')), 'assets/favicon.svg exists');
assert(fs.existsSync(path.join(ROOT_DIR, 'assets', 'icon-192.png')), 'assets/icon-192.png exists');
assert(fs.existsSync(path.join(ROOT_DIR, 'assets', 'icon-512.png')), 'assets/icon-512.png exists');

console.log(`\n======================================================`);
console.log(`🏁 FILE COMPATIBILITY RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log(`======================================================\n`);

if (failed > 0) process.exit(1);

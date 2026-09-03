const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = require('../package.json');
let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore','pipe','ignore'] }).toString().trim(); } catch {}
const build = new Date().toISOString();
const version = `${pkg.version}+${Date.now()}-${commit || 'dev'}`;
// tulis public/version.json
const out = { version, build, commit: commit || null };
// bump CACHE di sw.js (hope-vX) biar cache lama otomatis terhapus
try {
  const swPath = path.join(__dirname, '..', 'public', 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  // cari hope-vN, naikkan jika build baru (pakai timestamp hash sederhana)
  const m = sw.match(/const CACHE = 'hope-v(\d+)'/);
  if (m) {
    const n = parseInt(m[1],10);
    // tidak auto-naikkan tiap build agar tidak spam — cukup version.json yang trigger reload
    // tapi pastikan sw.js tetap fresh: touch file time
  }
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'version.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('[version] wrote', out);
} catch (e) {
  console.error('[version] failed', e.message);
  process.exit(1);
}

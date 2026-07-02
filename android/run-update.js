/**
 * Automates bubblewrap update with a local asset server.
 * Patches twa-manifest.json to use localhost for icon/manifest URLs,
 * runs bubblewrap update, then restores the original manifest.
 */
const { spawn } = require('child_process');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const KS_PASS   = 'nNoDLfmtJY8UyWRk06gMVt!8';
const KEY_PASS  = 'dfMZCoRvia1qBDsuGKtQAt!9';
const CWD       = 'C:\\Users\\jmeny\\vice-tracker\\android';
const WEB_ROOT  = 'C:\\Users\\jmeny\\vice-tracker\\client\\public';
const TWA_JSON  = path.join(CWD, 'twa-manifest.json');

// --- Start local asset server ---
const server = http.createServer((req, res) => {
  const filePath = path.join(WEB_ROOT, req.url.split('?')[0]);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    console.error(`[SERVER] 404: ${req.url}`);
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.error(`[EXPECT] Asset server running at ${base}`);

  // Patch twa-manifest.json to use localhost URLs
  const original = fs.readFileSync(TWA_JSON, 'utf8');
  const originalParsed = JSON.parse(original);
  const patched = { ...originalParsed };
  patched.iconUrl = `${base}/icon-512.png`;
  patched.maskableIconUrl = `${base}/icon-512.png`;
  patched.webManifestUrl = `${base}/manifest.json`;

  fs.writeFileSync(TWA_JSON, JSON.stringify(patched, null, 2), 'utf8');
  console.error('[EXPECT] Patched twa-manifest.json with localhost URLs');

  runUpdate(original);
});

function runUpdate(originalManifest) {
  const proc = spawn(
    'npx',
    ['@bubblewrap/cli', 'update'],
    {
      cwd: CWD,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    }
  );

  let buf = '';
  const answered = new Set();

  function cleanup(code) {
    // Restore original twa-manifest.json
    fs.writeFileSync(TWA_JSON, originalManifest, 'utf8');
    console.error('[EXPECT] Restored original twa-manifest.json');
    server.close();
    process.exit(code || 0);
  }

  function send(answer, label) {
    if (answered.has(label)) return;
    answered.add(label);
    console.error(`[EXPECT] "${label}" → sending: ${JSON.stringify(answer)}`);
    proc.stdin.write(answer + '\n');
  }

  function check(text) {
    const t = text.toLowerCase();

    // Version name prompt
    if (!answered.has('version-name') && (t.includes('versionname') || t.includes('version name') || t.includes('app version'))) {
      send('1.0.0', 'version-name');
      return;
    }
    // Version code
    if (!answered.has('version-code') && (t.includes('versioncode') || t.includes('version code'))) {
      send('1', 'version-code');
      return;
    }
    // Keystore password
    if (!answered.has('ks-pass') &&
        (t.includes('keystore password') || (t.includes('password') && t.includes('keystore')))) {
      send(KS_PASS, 'ks-pass');
      return;
    }
    // Key password
    if (answered.has('ks-pass') && !answered.has('key-pass') &&
        (t.includes('key password') || t.includes('password for key') || t.includes('key alias password'))) {
      send(KEY_PASS, 'key-pass');
      return;
    }
    // Confirm key password
    if (answered.has('key-pass') && !answered.has('key-pass-confirm') &&
        (t.includes('confirm') || t.includes('re-enter'))) {
      send(KEY_PASS, 'key-pass-confirm');
      return;
    }
  }

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    process.stdout.write(chunk);
    buf += chunk;
    check(buf.slice(-600));
  });

  proc.stderr.on('data', (data) => {
    const chunk = data.toString();
    process.stderr.write(chunk);
    buf += chunk;
    check(buf.slice(-600));
  });

  proc.on('close', (code) => {
    console.error(`[EXPECT] Process exited with code: ${code}`);
    cleanup(code);
  });

  proc.on('error', (err) => {
    console.error('[EXPECT] Spawn error:', err.message);
    cleanup(1);
  });

  setTimeout(() => {
    console.error('[EXPECT] Timeout — last 1500 chars:');
    console.error(buf.slice(-1500));
    proc.kill();
    cleanup(1);
  }, 600000);

  console.error('[EXPECT] bubblewrap update started...');
}

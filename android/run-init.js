/**
 * Automates bubblewrap init by:
 * 1. Serving the local manifest.json on a temp HTTP server
 * 2. Passing --manifest http://localhost:PORT/manifest.json
 * 3. Monitoring stdout and sending the right answers at the right time
 */
const { spawn } = require('child_process');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

const JDK_PATH    = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.19.10-hotspot';
const KS_PASS     = 'nNoDLfmtJY8UyWRk06gMVt!8';
const KEY_PASS    = 'dfMZCoRvia1qBDsuGKtQAt!9';
const CWD         = 'C:\\Users\\jmeny\\vice-tracker\\android';
const MANIFEST_SRC = 'C:\\Users\\jmeny\\vice-tracker\\client\\public\\manifest.json';

// --- Start local HTTP server for manifest ---
const server = http.createServer((req, res) => {
  if (req.url === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    fs.createReadStream(MANIFEST_SRC).pipe(res);
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const manifestUrl = `http://127.0.0.1:${port}/manifest.json`;
  console.error(`[EXPECT] Serving manifest at ${manifestUrl}`);
  startBubblewrap(manifestUrl);
});

function startBubblewrap(manifestUrl) {
  const proc = spawn(
    'npx',
    ['@bubblewrap/cli', 'init', `--manifest=${manifestUrl}`],
    {
      cwd: CWD,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    }
  );

  let buf = '';
  const answered = new Set();

  function send(answer, label) {
    if (answered.has(label)) return;
    answered.add(label);
    console.error(`[EXPECT] "${label}" → sending: ${JSON.stringify(answer)}`);
    proc.stdin.write(answer + '\n');
  }

  function check(text) {
    const t = text.toLowerCase();

    // JDK (defensive, should be skipped via config.json)
    if (!answered.has('jdk-install') && t.includes('install the jdk')) {
      send('n', 'jdk-install');
      return;
    }
    if (!answered.has('jdk-path') && answered.has('jdk-install') && t.includes('path to your existing jdk')) {
      send(JDK_PATH, 'jdk-path');
      return;
    }

    // Android SDK (should be skipped via config.json)
    if (!answered.has('sdk-install') && t.includes('install the android sdk')) {
      send('y', 'sdk-install');
      return;
    }
    if (!answered.has('sdk-terms') && (t.includes('terms and conditions') || t.includes('agree to the android'))) {
      send('y', 'sdk-terms');
      return;
    }

    // Use existing twa-manifest.json
    if (!answered.has('existing-manifest') && (t.includes('existing manifest') || t.includes('twa-manifest.json') || t.includes('use the existing'))) {
      send('y', 'existing-manifest');
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
    check(buf.slice(-800));
  });

  proc.stderr.on('data', (data) => {
    const chunk = data.toString();
    process.stderr.write(chunk);
    buf += chunk;
    check(buf.slice(-800));
  });

  proc.on('close', (code) => {
    console.error(`[EXPECT] Process exited with code: ${code}`);
    server.close();
    process.exit(code || 0);
  });

  proc.on('error', (err) => {
    console.error('[EXPECT] Spawn error:', err.message);
    server.close();
    process.exit(1);
  });

  setTimeout(() => {
    console.error('[EXPECT] Timeout — last 1500 chars of buffer:');
    console.error(buf.slice(-1500));
    proc.kill();
    server.close();
    process.exit(1);
  }, 600000);
}

console.error('[EXPECT] Starting local manifest server...');

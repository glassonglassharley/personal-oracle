const fs = require('fs');
const path = require('path');

// On Vercel the project root is read-only; /tmp is the only writable location.
// /tmp is ephemeral (cleared between cold starts), so these backups protect against
// migrations that run in the same process but do NOT survive restarts on serverless.
// For durable backups, mount a volume or configure BACKUP_DIR to an object-storage path.
const BACKUP_DIR = process.env.BACKUP_DIR
  || (process.env.VERCEL ? '/tmp/backups' : path.join(__dirname, '..', 'backups'));

async function backupEntries(pool) {
  const { rows } = await pool.query('SELECT * FROM entries ORDER BY id');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `entries-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));

  console.log(`Backup written: ${file} (${rows.length} rows)`);
  return { file, rows: rows.length };
}

module.exports = { backupEntries, BACKUP_DIR };

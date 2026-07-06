// Vercel serverless entry point — exports the Express app without calling listen()
const app = require('../server/app');
const pool = require('../server/db');

// Explicit migration trigger (db.js itself no longer does this at require-time).
// Fire-and-forget, same as before: cold start kicks off the migration once; it's
// not awaited before serving requests.
pool.initDb().catch(err => console.error('[DB INIT ERROR]', err.stack || err.message));

module.exports = app;

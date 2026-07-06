const app = require('./app');
const pool = require('./db');
const PORT = process.env.PORT || 3000;
pool.initDb()
  .then(() => app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`)))
  .catch(err => { console.error('[DB INIT ERROR]', err.stack || err.message); process.exit(1); });

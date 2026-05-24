require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { ensureUser } = require('./middleware/auth');

const app = express();

function sanitizeDemoUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function demoOrClerkAuth(req, res, next) {
  const demoUsername = sanitizeDemoUsername(req.get('X-Demo-Username'));
  if (demoUsername) {
    req.auth = { userId: `demo:${demoUsername}` };
    req.demoUsername = demoUsername;
    return next();
  }

  return requireAuth()(req, res, next);
}

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());
app.use('/api', demoOrClerkAuth, ensureUser);

app.use('/api/users',   require('./routes/users'));
app.use('/api/vices',   require('./routes/vices'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/stats',   require('./routes/stats'));
app.use('/api/savings',  require('./routes/savings'));
app.use('/api/partners', require('./routes/partners'));
app.use('/api/goals',   require('./routes/goals'));
app.use('/api/wrapped', require('./routes/wrapped'));
app.use('/api/companion', require('./routes/companion'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;

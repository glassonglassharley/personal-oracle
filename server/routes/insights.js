const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

const SYSTEM_PROMPT = `You are a personal financial accountability coach inside the Vice to Value app.
You analyze a user's vice spending data and give sharp, honest, encouraging insights.
Your tone is direct but warm — like a smart friend who knows finance.
You never shame. You always show the math. You speak in specifics, not generalities.
Always calculate with the user's actual numbers from the data provided.
When you mention money saved or cut, always show the 10-year investment projection at 7% compound growth.
Keep responses under 200 words. Use line breaks for readability. No markdown headers. No bullet points.

Here are examples of the exact voice and format to match:

<example prompt="general insights">
You've logged $340 on coffee this month. At this pace that's $4,080 per year. Invested at 7% over 10 years, that single habit becomes $56,800. The math is brutal — but it's also motivating.

Your biggest opportunity right now is consistency: users who log daily save 34% more than those who log weekly. You're building the right habit by being here.
</example>

Always replace the example dollar amounts with the user's real numbers from their data.`;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { status: 503 });
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey });
}

function isQuotaError(err) {
  const msg = (err.message || '').toLowerCase();
  return err.status === 400 && (msg.includes('credit') || msg.includes('billing') || msg.includes('quota'));
}

// ── POST /api/insights — original chat endpoint (kept for InsightsPanel) ──
router.post('/', async (req, res, next) => {
  try {
    const client = getClient();
    const { vices = [], stats = {}, user_name = 'User', prompt: userPrompt } = req.body;
    const dataContext = [
      `User: ${user_name}`,
      'Vices tracked:',
      ...vices.map(v => {
        const s = stats[v.id];
        if (!s) return `- ${v.emoji} ${v.name} (no data yet)`;
        return [
          `- ${v.emoji} ${v.name}`,
          `  This week: $${s.week?.spend?.toFixed(2) ?? '0.00'}`,
          `  This month: $${s.month?.spend?.toFixed(2) ?? '0.00'}`,
          `  Avg daily spend: $${s.avg_daily_spend?.toFixed(2) ?? '0.00'}`,
          `  Clean days: ${s.clean_days ?? 0}`,
          `  Savings from clean days: $${s.savings_from_clean_days?.toFixed(2) ?? '0.00'}`,
        ].join('\n');
      }),
    ].join('\n');
    const message = userPrompt
      ? `${userPrompt}\n\n${dataContext}`
      : `Give me personalized insights on my vice spending.\n\n${dataContext}`;
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    });
    res.json({ text: response.content?.[0]?.text || '' });
  } catch (err) {
    if (isQuotaError(err)) return res.status(503).json({ error: 'AI insights are temporarily unavailable.' });
    next(err);
  }
});

// ── POST /api/insights/weekly — cached weekly coaching insight ──
router.post('/weekly', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.json({ insight: null });

    // Return cache if < 7 days old
    const cached = await pool.query(
      `SELECT content, created_at FROM insights_cache WHERE user_id = $1 AND type = 'weekly'`, [uid]
    );
    if (cached.rows.length > 0) {
      const age = Date.now() - new Date(cached.rows[0].created_at).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) return res.json({ insight: cached.rows[0].content, cached: true });
    }

    // Gather last 7 days of stats
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const [entriesR, xpR] = await Promise.all([
      pool.query(`
        SELECT e.date, SUM(e.quantity * e.price_per_unit)::float AS spend,
               COUNT(CASE WHEN e.quantity = 0 THEN 1 END)::int AS clean_count
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1 AND e.date >= $2
        GROUP BY e.date
        ORDER BY e.date
      `, [uid, weekAgo]),
      pool.query('SELECT total_xp, level FROM user_xp WHERE user_id = $1', [uid]),
    ]);

    const rows = entriesR.rows;
    const cleanDays = rows.filter(r => r.spend === 0).length;
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const xp = xpR.rows[0]?.total_xp ?? 0;
    const level = xpR.rows[0]?.level ?? 1;

    const client = getClient();
    const prompt = `Weekly vice spending summary for a user:
- Period: last 7 days (${weekAgo} to ${today})
- Total spent on vices: $${totalSpend.toFixed(2)}
- Clean days this week: ${cleanDays}/7
- Current XP: ${xp}, Level: ${level}

Write a 3-5 sentence personalized weekly insight. Be a supportive coach: acknowledge wins, flag patterns, suggest one specific action. Use their actual numbers. No markdown.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    const insight = response.content?.[0]?.text?.trim() || '';

    // Cache it
    await pool.query(
      `INSERT INTO insights_cache (user_id, type, content, created_at)
       VALUES ($1, 'weekly', $2, NOW())
       ON CONFLICT (user_id, type) DO UPDATE SET content = $2, created_at = NOW()`,
      [uid, insight]
    );

    res.json({ insight, cached: false });
  } catch (err) {
    if (isQuotaError(err)) return res.json({ insight: null });
    next(err);
  }
});

// ── POST /api/insights/quit-plan — 4-week structured quit plan for a vice ──
router.post('/quit-plan', async (req, res, next) => {
  try {
    const client = getClient();
    const { vice_name, vice_emoji, avg_daily_spend = 0, clean_days = 0, current_streak = 0 } = req.body;
    if (!vice_name) return res.status(400).json({ error: 'vice_name required' });

    const yearSavings = avg_daily_spend * 365;
    const tenYearProjection = Math.round(yearSavings * ((Math.pow(1.07, 10) - 1) / 0.07));

    const prompt = `Create a structured 30-day quit plan for someone trying to quit ${vice_emoji || ''} ${vice_name}.
Context:
- Current avg daily spend: $${Number(avg_daily_spend).toFixed(2)}
- Clean days logged so far: ${clean_days}
- Current streak: ${current_streak} days
- Annual savings if quit: $${yearSavings.toFixed(0)}
- 10-year investment projection at 7%: $${tenYearProjection.toLocaleString()}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "weeks": [
    {"week": 1, "goal": "...", "strategies": ["...", "...", "..."], "milestone": "..."},
    {"week": 2, "goal": "...", "strategies": ["...", "...", "..."], "milestone": "..."},
    {"week": 3, "goal": "...", "strategies": ["...", "...", "..."], "milestone": "..."},
    {"week": 4, "goal": "...", "strategies": ["...", "...", "..."], "milestone": "..."}
  ],
  "total_projected_savings": ${yearSavings.toFixed(2)},
  "ten_year_projection": ${tenYearProjection}
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content?.[0]?.text?.trim() || '{}';
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      plan = match ? JSON.parse(match[0]) : { weeks: [], total_projected_savings: yearSavings, ten_year_projection: tenYearProjection };
    }

    res.json(plan);
  } catch (err) { next(err); }
});

module.exports = router;

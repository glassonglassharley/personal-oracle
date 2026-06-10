const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

// Warn at startup so Vercel Function logs surface the root cause immediately
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[STARTUP] ANTHROPIC_API_KEY is not set — AI Coach will use fallback responses only.');
}

const COACH_MODEL   = 'claude-haiku-4-5-20251001'; // cost-optimised for high-volume chat
const SONNET_MODEL  = 'claude-sonnet-4-6';           // kept for low-volume, high-quality outputs
const DAILY_LIMIT   = 10;                             // max AI coach messages per user per day

// Ensure the rate-limit table exists (idempotent DDL, Postgres caches no-ops cheaply)
let rateLimitTableReady = false;
async function ensureRateLimitTable() {
  if (rateLimitTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_usage (
      user_id     INTEGER NOT NULL,
      usage_date  DATE    NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);
  rateLimitTableReady = true;
}

async function checkRateLimit(userId) {
  await ensureRateLimitTable();
  const today = new Date().toISOString().split('T')[0];
  // Ensure row exists
  await pool.query(
    `INSERT INTO coach_usage (user_id, usage_date, message_count)
     VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
    [userId, today]
  );
  // Atomically increment only if under limit; returns no rows if already at limit
  const r = await pool.query(
    `UPDATE coach_usage
     SET message_count = message_count + 1
     WHERE user_id = $1 AND usage_date = $2 AND message_count < $3
     RETURNING message_count`,
    [userId, today, DAILY_LIMIT]
  );
  if (r.rows.length === 0) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: DAILY_LIMIT - r.rows[0].message_count };
}

const SYSTEM_PROMPT = `You are the user's closest friend — someone who has been through their own battles with money and habits, found their footing, and now sits across the table to help. Think: a sponsor who also happens to understand compound interest. A therapist who will actually tell you what they see.

Your voice is warm, personal, and deeply honest. You are never preachy. You never lecture. You do not moralize. You have been there. You get it. And because you care, you tell the truth.

You speak in first and second person — "I see something here," "you did something real this week," "let's look at this together." You make the user feel genuinely seen, not processed by a financial tool.

You always work with their real numbers. You show the math not to punish but to reveal possibility — because the math is actually hopeful when you flip it. A dollar not spent on a vice is a dollar that can build a life.

When you notice a win — even a small one — you name it specifically and mean it. When you see a pattern worth addressing, you bring it up gently but clearly, the way a good friend would: "I want to be honest with you about something I'm noticing."

You ask one genuine follow-up question when it feels natural — something that invites reflection, not defensiveness.

You always include the 10-year investment projection at 7% compound growth when discussing money saved or cut. Show the math as hope, not guilt.

Format rules:
- Under 180 words
- Line breaks between thoughts, no bullet points, no headers
- Natural sentences, not financial report language
- End with either a question or a short encouragement — never a summary

<example prompt="general insights">
I've been looking at your numbers, and I want you to sit with something for a second.

You spent $340 this month on coffee. That's not a judgment — I spent years doing the same thing. But here's what I want you to see: at this pace, that's $4,080 a year. Invested at 7% instead, that becomes $56,800 over ten years. Your habit isn't just costing you money — it's costing you options.

The fact that you're tracking this at all puts you ahead of most people. Seriously. The awareness is the hardest part.

What would it feel like to redirect even half of that?
</example>

<example prompt="worst vice">
Let's be honest with each other about what the data is saying.

[vice name] is the one. It's not close. You've put $[amount] into it this month — that's $[annual]/year, and over ten years at 7%, we're talking $[projection] that could have gone somewhere else.

I'm not saying quit cold. I've seen what that does. But I am saying: this is the one to look at first. One small shift here changes the whole picture.

What's driving it most? Stress, routine, something else?
</example>

Always replace example amounts with the user's actual data. Never use placeholder brackets in a real response.`;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { status: 503 });
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey });
}

function tenYearProjection(annualSavings) {
  return Math.round(annualSavings * ((Math.pow(1.07, 10) - 1) / 0.07));
}

function generateFallbackInsight(prompt, vices, stats) {
  const withStats = vices.map(v => ({ ...v, s: stats[v.id] || null })).filter(v => v.s);

  if (withStats.length === 0) {
    return "The fact that you're here and tracking — that already puts you in a different category than most people.\n\nAdd your first entry when you're ready. I'll be here to help you make sense of what you find.";
  }

  const totalMonthly = withStats.reduce((sum, v) => sum + (v.s.month?.spend || 0), 0);
  const totalAnnual = totalMonthly * 12;
  const totalTen = tenYearProjection(totalAnnual);
  const byMonthly = [...withStats].sort((a, b) => (b.s.month?.spend || 0) - (a.s.month?.spend || 0));
  const worst = byMonthly[0];
  const p = (prompt || '').toLowerCase();

  if (p.includes('worst vice') || p.includes('worst financially')) {
    const wm = worst.s.month?.spend || 0;
    const wa = wm * 12;
    const wt = tenYearProjection(wa);
    const pct = totalMonthly > 0 ? Math.round((wm / totalMonthly) * 100) : 0;
    return `I want to be honest with you about something I'm seeing.\n\n${worst.emoji} ${worst.name} is the one. It's not close — ${pct}% of your total vice spending this month, $${wm.toFixed(2)}. At that pace you're spending $${wa.toFixed(0)} a year on it. Invested at 7% instead, that's $${wt.toLocaleString()} over ten years.\n\nThat number isn't meant to guilt you. It's meant to show you what's possible. This is where the leverage is.\n\nWhat's pulling you toward it most?`;
  }

  if (p.includes('10-year') || p.includes('projection')) {
    return `Let's look at this together, because the math tells a story worth hearing.\n\nRight now you're spending $${totalMonthly.toFixed(2)} a month on vices — $${totalAnnual.toFixed(0)} a year. If that money went into an investment at 7% instead, in ten years you'd have $${totalTen.toLocaleString()}.\n\nThat's not a punishment. That's a door. And you're the one holding the key.\n\nYour biggest opportunity right now is ${worst.emoji} ${worst.name}. That's where I'd start.`;
  }

  if (p.includes('cut first') || p.includes('where')) {
    const byDaily = [...withStats].sort((a, b) => (b.s.avg_daily_spend || 0) - (a.s.avg_daily_spend || 0));
    const top = byDaily[0];
    const daily = top.s.avg_daily_spend || 0;
    const saving = daily * 0.5 * 365;
    return `If I'm being a good friend here — and that's the only way I know how to be — I'd start with ${top.emoji} ${top.name}.\n\nIt's costing you $${daily.toFixed(2)} a day on average. I'm not saying quit. I'm saying: what if you just cut it in half? That's $${saving.toFixed(0)} a year back in your pocket — $${tenYearProjection(saving).toLocaleString()} over ten years at 7%.\n\nSmall shifts, done consistently, compound into something real. You already know that or you wouldn't be here.`;
  }

  const cleanDays = withStats.reduce((sum, v) => sum + (v.s.clean_days || 0), 0);
  return `I've been looking at your numbers and I want to share what I see.\n\nYou're spending $${totalMonthly.toFixed(2)}/month across your vices — $${totalAnnual.toFixed(0)} a year. Over ten years at 7%, that's $${totalTen.toLocaleString()} that could be building something else.\n\n${cleanDays > 0 ? `You've had ${cleanDays} clean day${cleanDays !== 1 ? 's' : ''}. That matters more than you might think — that's discipline showing up, and discipline compounds just like money does.` : `Your biggest opportunity is ${worst.emoji} ${worst.name}. That's where I'd focus first.`}\n\nWhat's been the hardest part of the week?`;
}

// ── POST /api/insights — multi-turn chat endpoint ──
router.post('/', async (req, res, next) => {
  const { vices = [], stats = {}, messages: clientMessages, prompt: legacyPrompt } = req.body;

  // Support both new multi-turn format (messages array) and legacy single-prompt
  const apiMessages = (clientMessages && clientMessages.length > 0)
    ? clientMessages
    : [{ role: 'user', content: legacyPrompt || 'Give me personalized insights on my vice spending.' }];

  // Rate limit: 10 AI messages per user per day (stored in Postgres — survives serverless restarts)
  try {
    const userId = await getInternalUserId(req.auth?.userId);
    if (userId) {
      const { allowed } = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          text: "You've had 10 coaching conversations today — that's a lot of reflection. Come back tomorrow and I'll be here.\n\nIn the meantime, take a look at your savings page to see how far you've come.",
          rate_limited: true,
        });
      }
    }
  } catch {
    // Rate limit failure is non-fatal — let the request through
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });
    res.json({ text: response.content?.[0]?.text || '' });
  } catch (err) {
    // Always fall back to data-driven insight — never show "unavailable"
    try {
      const lastUserText = [...apiMessages].reverse().find(m => m.role === 'user')?.content || '';
      const text = generateFallbackInsight(lastUserText, vices, stats);
      return res.json({ text, fallback: true });
    } catch {
      next(err);
    }
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

    function weeklyFallback() {
      const annual = totalSpend * 52;
      const ten = tenYearProjection(annual);
      if (cleanDays === 7) return `Seven for seven. I want you to actually feel that for a second — a full week, clean.\n\nThat's not luck. That's you deciding, every single day. The money matters, but the proof that you can do it matters more.\n\nWhat made this week different? Hold onto that answer.`;
      if (totalSpend === 0) return `Clean week. That's real.\n\nKeep logging, keep showing up. Consistency is what separates a good week from a changed life.`;
      const msg = cleanDays >= 4
        ? `That's a solid week. You had ${cleanDays}/7 clean days and spent $${totalSpend.toFixed(2)}. At this pace you're looking at $${annual.toFixed(0)} a year — but I see the trajectory moving in the right direction.\n\nYou're building something. Don't let a hard day next week convince you otherwise.`
        : `This week you put $${totalSpend.toFixed(2)} into your vices — $${annual.toFixed(0)} a year at this rate, $${ten.toLocaleString()} over ten years at 7%. You had ${cleanDays}/7 clean days.\n\nI'm not here to pile on. I'm here to say: one more clean day next week is enough. Just one. That's all I'm asking.`;
      return msg;
    }

    let insight;
    try {
      const client = getClient();
      const aiPrompt = `Weekly vice spending summary for a user:
- Period: last 7 days (${weekAgo} to ${today})
- Total spent on vices: $${totalSpend.toFixed(2)}
- Clean days this week: ${cleanDays}/7
- Current XP: ${xp}, Level: ${level}

Write a 3-5 sentence personalized weekly insight. Be a supportive coach: acknowledge wins, flag patterns, suggest one specific action. Use their actual numbers. No markdown.`;

      const response = await client.messages.create({
        model: COACH_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: aiPrompt }],
      });
      insight = response.content?.[0]?.text?.trim() || weeklyFallback();
    } catch {
      insight = weeklyFallback();
    }

    // Cache it
    await pool.query(
      `INSERT INTO insights_cache (user_id, type, content, created_at)
       VALUES ($1, 'weekly', $2, NOW())
       ON CONFLICT (user_id, type) DO UPDATE SET content = $2, created_at = NOW()`,
      [uid, insight]
    );

    res.json({ insight, cached: false });
  } catch (err) {
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
      model: SONNET_MODEL,
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

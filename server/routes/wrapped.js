const express = require('express');
const router = express.Router();
const pool = require('../db');

async function getMyId(clerkUserId) {
  const r = await pool.query('SELECT id FROM users WHERE clerk_user_id = $1', [clerkUserId]);
  return r.rows[0]?.id;
}

// GET /api/wrapped/:year
router.get('/:year', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.status(404).json({ error: 'User not found' });

    const year = parseInt(req.params.year, 10);
    if (!year || year < 2020 || year > 2030) return res.status(400).json({ error: 'Invalid year' });

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;

    // All entries for the year across all vices
    const allEntries = await pool.query(`
      SELECT e.date, e.quantity::float, e.price_per_unit::float,
             v.id AS vice_id, v.name AS vice_name, v.emoji
      FROM entries e
      JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1 AND e.date >= $2 AND e.date <= $3
      ORDER BY e.date
    `, [myId, yearStart, yearEnd]);

    const rows = allEntries.rows;

    if (rows.length === 0) {
      return res.json({ year, empty: true });
    }

    // ── Aggregate stats ──────────────────────────────────
    let totalSpent = 0;
    let cleanDays = 0;
    let totalCleanSavings = 0;
    let mostExpensiveDay = { date: null, amount: 0 };

    // Group by date for streak calc
    const byDate = {};
    const spendByMonth = Array(12).fill(0);
    const spendByVice = {};

    rows.forEach(r => {
      const spend = r.quantity * r.price_per_unit;
      const dateStr = r.date.toISOString?.().split('T')[0] ?? r.date.toString().split('T')[0];
      const month = parseInt(dateStr.split('-')[1], 10) - 1;

      if (!byDate[dateStr]) byDate[dateStr] = { spend: 0, allClean: true };
      byDate[dateStr].spend += spend;
      if (r.quantity > 0) byDate[dateStr].allClean = false;

      if (!spendByVice[r.vice_id]) spendByVice[r.vice_id] = { name: r.vice_name, emoji: r.emoji, total: 0, cleanDays: 0 };
      spendByVice[r.vice_id].total += spend;
      if (r.quantity === 0) spendByVice[r.vice_id].cleanDays += 1;

      totalSpent += spend;
      spendByMonth[month] += spend;
    });

    // Most expensive single day + clean days total
    const sortedDates = Object.keys(byDate).sort();
    sortedDates.forEach(d => {
      if (byDate[d].allClean) {
        cleanDays++;
      }
      if (byDate[d].spend > mostExpensiveDay.amount) {
        mostExpensiveDay = { date: d, amount: byDate[d].spend };
      }
    });

    // Longest streak
    let longestStreak = 0;
    let currentStreak = 0;
    // Fill gap dates for streak (all days in year up to today)
    const today = new Date();
    const endDate = new Date(Math.min(new Date(yearEnd), today));
    const startDate = new Date(yearStart);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (byDate[key]?.allClean) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (byDate[key]) {
        currentStreak = 0;
      }
    }

    // Total clean savings: use avg daily spend * clean days
    const loggedDates = sortedDates.filter(d => !byDate[d].allClean);
    const totalSpentOnSpendDays = loggedDates.reduce((s, d) => s + byDate[d].spend, 0);
    const avgDailySpend = loggedDates.length > 0 ? totalSpentOnSpendDays / loggedDates.length : 0;
    totalCleanSavings = cleanDays * avgDailySpend;

    // Best/worst month (non-zero months only)
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const nonZeroMonths = spendByMonth.map((v, i) => ({ month: i, total: v })).filter(m => m.total > 0);
    const bestMonth  = nonZeroMonths.reduce((a, b) => b.total < a.total ? b : a, nonZeroMonths[0]);
    const worstMonth = nonZeroMonths.reduce((a, b) => b.total > a.total ? b : a, nonZeroMonths[0]);

    // Biggest vice by spend
    const viceList = Object.values(spendByVice).sort((a, b) => b.total - a.total);
    const biggestVice = viceList[0];

    // AI summary
    let aiSummary = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
        const prompt = `A user's vice spending data for ${year}:
- Total spent on vices: $${totalSpent.toFixed(2)}
- Total saved from clean days: $${totalCleanSavings.toFixed(2)}
- Total clean days: ${cleanDays}
- Longest clean streak: ${longestStreak} days
- Biggest vice: ${biggestVice?.emoji} ${biggestVice?.name} ($${biggestVice?.total.toFixed(2)})
- Best month (lowest spend): ${bestMonth ? monthNames[bestMonth.month] : 'N/A'}
- Worst month (highest spend): ${worstMonth ? monthNames[worstMonth.month] : 'N/A'}

Write ONE sentence (max 20 words) summarizing their year — honest, a little poetic, encouraging but not saccharine. No emojis.`;

        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          messages: [{ role: 'user', content: prompt }],
        });
        aiSummary = msg.content[0]?.text?.trim() || null;
      } catch (_) {}
    }

    res.json({
      year,
      empty: false,
      total_spent:        Math.round(totalSpent * 100) / 100,
      total_saved:        Math.round(totalCleanSavings * 100) / 100,
      total_clean_days:   cleanDays,
      longest_streak:     longestStreak,
      most_expensive_day: mostExpensiveDay,
      biggest_vice:       biggestVice,
      best_month:         bestMonth  ? { month: bestMonth.month,  name: monthNames[bestMonth.month],  total: Math.round(bestMonth.total  * 100) / 100 } : null,
      worst_month:        worstMonth ? { month: worstMonth.month, name: monthNames[worstMonth.month], total: Math.round(worstMonth.total * 100) / 100 } : null,
      vices:              viceList.map(v => ({ ...v, total: Math.round(v.total * 100) / 100 })),
      ai_summary:         aiSummary,
    });
  } catch (err) { next(err); }
});

module.exports = router;

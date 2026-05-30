const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

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

<example prompt="What's my worst vice financially?">
Your most expensive vice is alcohol at $280/month — $3,360/year. Over 10 years at 7% compound growth, that's $46,600 sitting on the table. That's a car. A down payment. Two years of college tuition.

Cutting it by half doesn't require quitting — it requires intention.
</example>

<example prompt="Show me my 10-year projection">
Based on your current vices, you're spending $580/month on trackable habits. That's $6,960/year. If you cut 40% and invested the difference — $232/month — at 7% annual growth, you'd have $38,400 in 10 years. Full reduction gets you to $96,000.

The question isn't whether you can afford to cut. It's whether you can afford not to.
</example>

<example prompt="Where should I cut first?">
Start with alcohol — highest spend, most flexible. Even dropping from $280 to $140/month frees $1,680/year.

Second target: coffee. Brewing at home 3 days a week saves ~$60/month with zero lifestyle sacrifice.

Small cuts, compounded, become life-changing numbers.
</example>

Always replace the example dollar amounts with the user's real numbers from their data.`;

router.post('/', async (req, res, next) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI insights are not configured on this server. Add ANTHROPIC_API_KEY to your environment variables.' });
  }

  const { vices = [], stats = {}, user_name = 'User', prompt: userPrompt } = req.body;

  const dataContext = [
    `User: ${user_name}`,
    '',
    'Vices tracked:',
    ...vices.map(v => {
      const s = stats[v.id];
      if (!s) return `- ${v.emoji} ${v.name} (no data yet)`;
      return [
        `- ${v.emoji} ${v.name}`,
        `  Price per unit: $${v.price_per_unit}`,
        `  This week: $${s.week?.spend?.toFixed(2) ?? '0.00'}`,
        `  This month: $${s.month?.spend?.toFixed(2) ?? '0.00'}`,
        `  This year: $${s.year?.spend?.toFixed(2) ?? '0.00'}`,
        `  Avg daily spend: $${s.avg_daily_spend?.toFixed(2) ?? '0.00'}`,
        `  Clean days: ${s.clean_days ?? 0}`,
        `  Savings from clean days: $${s.savings_from_clean_days?.toFixed(2) ?? '0.00'}`,
      ].join('\n');
    }),
  ].join('\n');

  const message = userPrompt
    ? `${userPrompt}\n\n${dataContext}`
    : `Give me personalized insights on my vice spending and how to improve.\n\n${dataContext}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    });
    const text = response.content?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

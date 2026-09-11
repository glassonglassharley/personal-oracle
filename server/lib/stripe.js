// Lazy Stripe client, same shape as getPlaidClient in routes/savings.js: the
// server boots without STRIPE_SECRET_KEY and only the billing routes 503.
let _stripe = null;

function getStripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.'), { status: 503 });
  }
  const Stripe = require('stripe');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

function getProPriceId() {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) {
    throw Object.assign(new Error('Stripe is not configured. Add STRIPE_PRICE_ID in Vercel.'), { status: 503 });
  }
  return id;
}

module.exports = { getStripe, getProPriceId };

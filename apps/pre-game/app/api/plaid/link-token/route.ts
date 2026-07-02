import { NextResponse } from "next/server";

const PLAID_ENV = process.env.PLAID_ENV || "sandbox";
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI;

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

function plaidBaseUrl() {
  return PLAID_BASE_URLS[PLAID_ENV] || PLAID_BASE_URLS.sandbox;
}

function missingConfig() {
  return !PLAID_CLIENT_ID || !PLAID_SECRET;
}

export async function POST() {
  if (missingConfig()) {
    return NextResponse.json(
      { error: "Plaid is not configured yet. Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel environment variables, then redeploy." },
      { status: 503 },
    );
  }

  const payload: Record<string, unknown> = {
    client_id: PLAID_CLIENT_ID,
    secret: PLAID_SECRET,
    client_name: "Pre-Game",
    country_codes: ["US"],
    language: "en",
    user: { client_user_id: "pre-game-local-user" },
    products: ["transactions"],
  };

  if (PLAID_REDIRECT_URI) payload.redirect_uri = PLAID_REDIRECT_URI;

  const res = await fetch(`${plaidBaseUrl()}/link/token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      {
        error: data.error_message || "Plaid link token creation failed.",
        plaid_error_code: data.error_code,
        plaid_error_type: data.error_type,
      },
      { status: res.status },
    );
  }

  return NextResponse.json({ link_token: data.link_token, expiration: data.expiration });
}

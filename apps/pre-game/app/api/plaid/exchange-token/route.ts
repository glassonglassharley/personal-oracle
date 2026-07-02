import { NextRequest, NextResponse } from "next/server";

const PLAID_ENV = process.env.PLAID_ENV || "sandbox";
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 90;

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

interface PlaidAccountResponse {
  accounts?: Array<{
    account_id: string;
    name: string;
    official_name?: string | null;
    mask?: string | null;
    type: string;
    subtype?: string | null;
    balances?: {
      current?: number | null;
      available?: number | null;
      iso_currency_code?: string | null;
    };
  }>;
  item?: { institution_id?: string | null };
}

interface StoredPlaidItem {
  accessToken: string;
  institutionName: string;
  institutionId: string | null;
  accounts: ReturnType<typeof mapAccounts>;
  connectedAt: number;
}

function plaidBaseUrl() {
  return PLAID_BASE_URLS[PLAID_ENV] || PLAID_BASE_URLS.sandbox;
}

function missingConfig() {
  return !PLAID_CLIENT_ID || !PLAID_SECRET;
}

async function redisSet(key: string, value: string) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", key, value, "EX", TTL]),
  });
}

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["GET", key]),
  });
  if (!res.ok) return null;
  const { result } = (await res.json()) as { result: unknown };
  return typeof result === "string" ? result : null;
}

async function plaidPost(path: string, payload: Record<string, unknown>) {
  const res = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false as const, status: res.status, data };
  }
  return { ok: true as const, status: res.status, data };
}

function mapAccounts(accountData: PlaidAccountResponse) {
  return (accountData.accounts || []).map(account => ({
    id: account.account_id,
    name: account.name,
    officialName: account.official_name || "",
    mask: account.mask || "",
    type: account.type,
    subtype: account.subtype || "",
    current: account.balances?.current ?? null,
    available: account.balances?.available ?? null,
    currency: account.balances?.iso_currency_code || "USD",
  }));
}

export async function POST(req: NextRequest) {
  if (missingConfig()) {
    return NextResponse.json(
      { error: "Plaid is not configured yet. Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel environment variables, then redeploy." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({})) as { public_token?: string; sync_id?: string; institution_name?: string };
  const { public_token, sync_id, institution_name } = body;
  if (!public_token || typeof public_token !== "string") {
    return NextResponse.json({ error: "Missing Plaid public token." }, { status: 400 });
  }

  const exchanged = await plaidPost("/item/public_token/exchange", { public_token });
  if (!exchanged.ok) {
    return NextResponse.json(
      {
        error: exchanged.data.error_message || "Plaid public token exchange failed.",
        plaid_error_code: exchanged.data.error_code,
        plaid_error_type: exchanged.data.error_type,
      },
      { status: exchanged.status },
    );
  }

  const accessToken = exchanged.data.access_token as string;
  const itemId = exchanged.data.item_id as string;

  const accounts = await plaidPost("/accounts/get", { access_token: accessToken });
  if (!accounts.ok) {
    return NextResponse.json(
      {
        error: accounts.data.error_message || "Plaid account fetch failed.",
        plaid_error_code: accounts.data.error_code,
        plaid_error_type: accounts.data.error_type,
      },
      { status: accounts.status },
    );
  }

  const accountData = accounts.data as PlaidAccountResponse;
  const mappedAccounts = mapAccounts(accountData);

  if (sync_id && typeof sync_id === "string" && sync_id.length >= 4) {
    const stored: StoredPlaidItem = {
      accessToken,
      institutionName: institution_name || "Bank account",
      institutionId: accountData.item?.institution_id || null,
      accounts: mappedAccounts,
      connectedAt: Date.now(),
    };
    await redisSet(`pg:plaid:${sync_id}:${itemId}`, JSON.stringify(stored));

    const indexKey = `pg:plaid:${sync_id}:items`;
    const indexRaw = await redisGet(indexKey);
    let ids: string[] = [];
    try { ids = indexRaw ? (JSON.parse(indexRaw) as string[]) : []; } catch { ids = []; }
    if (!ids.includes(itemId)) ids.push(itemId);
    await redisSet(indexKey, JSON.stringify(ids));
  }

  return NextResponse.json({
    ok: true,
    item_id: itemId,
    institution_name: institution_name || "Bank account",
    accounts: mappedAccounts,
  });
}

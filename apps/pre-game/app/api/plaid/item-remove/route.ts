import { NextRequest, NextResponse } from "next/server";

const PLAID_ENV = process.env.PLAID_ENV || "sandbox";
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

function plaidBaseUrl() {
  return PLAID_BASE_URLS[PLAID_ENV] || PLAID_BASE_URLS.sandbox;
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

async function redisSet(key: string, value: string) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", key, value]),
  });
}

async function redisDel(key: string) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["DEL", key]),
  });
}

interface StoredPlaidItem {
  accessToken: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { sync_id?: string; item_id?: string };
  const { sync_id, item_id } = body;
  if (!sync_id || !item_id || sync_id.length < 4) {
    return NextResponse.json({ error: "Missing sync_id or item_id." }, { status: 400 });
  }

  const itemKey = `pg:plaid:${sync_id}:${item_id}`;
  const raw = await redisGet(itemKey).catch(() => null);
  if (raw && PLAID_CLIENT_ID && PLAID_SECRET) {
    try {
      const stored = JSON.parse(raw) as StoredPlaidItem;
      if (stored.accessToken) {
        await fetch(`${plaidBaseUrl()}/item/remove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, access_token: stored.accessToken }),
        }).catch(() => {});
      }
    } catch { /* ignore malformed stored item */ }
  }

  await redisDel(itemKey);

  const indexKey = `pg:plaid:${sync_id}:items`;
  const indexRaw = await redisGet(indexKey).catch(() => null);
  let ids: string[] = [];
  try { ids = indexRaw ? (JSON.parse(indexRaw) as string[]) : []; } catch { ids = []; }
  await redisSet(indexKey, JSON.stringify(ids.filter(id => id !== item_id)));

  return NextResponse.json({ ok: true });
}

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

interface StoredPlaidItem {
  accessToken: string;
}

async function itemWeeklyAvg(accessToken: string): Promise<number> {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const res = await fetch(`${plaidBaseUrl()}/transactions/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500 },
    }),
  });

  if (!res.ok) return 0;
  const data = (await res.json()) as { transactions?: Array<{ amount: number; name: string }> };

  // Plaid convention: amount > 0 = debit (money out), amount < 0 = credit (money in)
  const incomeTotal = (data.transactions ?? [])
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return Math.round((incomeTotal / 4) * 100) / 100;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.length < 4) return NextResponse.json({ weeklyAvg: 0, byItem: [] });
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return NextResponse.json({ weeklyAvg: 0, byItem: [] });

  const indexRaw = await redisGet(`pg:plaid:${id}:items`).catch(() => null);
  let itemIds: string[] = [];
  try { itemIds = indexRaw ? (JSON.parse(indexRaw) as string[]) : []; } catch { itemIds = []; }
  if (itemIds.length === 0) return NextResponse.json({ weeklyAvg: 0, byItem: [] });

  const byItem = await Promise.all(itemIds.map(async itemId => {
    try {
      const raw = await redisGet(`pg:plaid:${id}:${itemId}`);
      if (!raw) return { itemId, weeklyAvg: 0 };
      const stored = JSON.parse(raw) as StoredPlaidItem;
      const weeklyAvg = await itemWeeklyAvg(stored.accessToken);
      return { itemId, weeklyAvg };
    } catch {
      return { itemId, weeklyAvg: 0 };
    }
  }));

  const weeklyAvg = Math.round(byItem.reduce((sum, item) => sum + item.weeklyAvg, 0) * 100) / 100;
  return NextResponse.json({ weeklyAvg, byItem });
}

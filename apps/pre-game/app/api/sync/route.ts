import { NextRequest, NextResponse } from "next/server";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 90; // 90 days

async function redisCmd(cmd: unknown[]) {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error("sync store unavailable");
  return res.json() as Promise<{ result: unknown }>;
}

export async function GET(req: NextRequest) {
  if (!REDIS_URL || !REDIS_TOKEN) return NextResponse.json({ data: null });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.length < 4) return NextResponse.json({ data: null });
  try {
    const { result } = await redisCmd(["GET", `pg:${id}`]);
    return NextResponse.json({ data: result ?? null });
  } catch {
    return NextResponse.json({ data: null, ok: false });
  }
}

export async function POST(req: NextRequest) {
  if (!REDIS_URL || !REDIS_TOKEN) return NextResponse.json({ ok: false });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.length < 4) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json();
  try {
    await redisCmd(["SET", `pg:${id}`, JSON.stringify(body), "EX", TTL]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

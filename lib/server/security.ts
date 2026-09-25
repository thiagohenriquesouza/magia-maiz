import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function getAnonymousRequestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${forwarded}|${agent}`).digest("hex");
}

export function isRateLimited(key: string) {
  const now = Date.now();
  const max = Number(process.env.RATE_LIMIT_MAX ?? 5);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 600_000);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  return current.count > max;
}

export function containsBlockedTheme(value: string) {
  return /\b(pol[ií]tic[oa]|elei[cç][aã]o|partido|relig(i[aã]o|ioso)|igreja|deus|jesus|presidente|gobierno|iglesia)\b/i.test(value);
}

export function cleanText(value: string, max: number) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

import { del, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const retentionMs = Number(process.env.BLOB_RETENTION_HOURS ?? 2) * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  let cursor: string | undefined;
  let deleted = 0;

  for (let page = 0; page < 10; page += 1) {
    const result = await list({ prefix: "generated/", cursor, limit: 1000 });
    const expired = result.blobs.filter((blob) => new Date(blob.uploadedAt).getTime() < cutoff).map((blob) => blob.url);
    if (expired.length) {
      await del(expired);
      deleted += expired.length;
    }
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }

  return NextResponse.json({ deleted });
}

import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { locale?: string };
    const locale = body.locale === "es" ? "es" : "pt";
    await recordEvent("page_view", locale);
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

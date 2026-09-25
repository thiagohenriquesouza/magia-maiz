import { neon } from "@neondatabase/serverless";
import type { Locale } from "../config";

type EventType = "page_view" | "image_generated";

export async function recordEvent(eventType: EventType, locale: Locale, businessUnit?: string) {
  if (!process.env.POSTGRES_URL) return;
  const sql = neon(process.env.POSTGRES_URL);
  await sql`
    INSERT INTO events (event_type, locale, business_unit)
    VALUES (${eventType}, ${locale}, ${businessUnit ?? null})
  `;
}

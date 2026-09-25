import { neon } from "@neondatabase/serverless";
import type { Locale } from "../config";

type EventType = "page_view" | "image_generated";

export type ImageGenerationUsage = {
  locale: Locale;
  businessUnit: string;
  model: string;
  quality: string;
  imageSize: string;
  outputFormat: string;
  promptVersion: string;
  openaiRequestId?: string;
  latencyMs: number;
  textInputTokens: number;
  imageInputTokens: number;
  imageOutputTokens: number;
  totalTokens: number;
  estimatedCostMicroUsd: number;
};

export async function recordEvent(eventType: EventType, locale: Locale, businessUnit?: string) {
  if (!process.env.POSTGRES_URL) return;
  const sql = neon(process.env.POSTGRES_URL);
  await sql`
    INSERT INTO events (event_type, locale, business_unit)
    VALUES (${eventType}, ${locale}, ${businessUnit ?? null})
  `;
}

export async function recordImageGeneration(usage: ImageGenerationUsage) {
  if (!process.env.POSTGRES_URL) return;
  const sql = neon(process.env.POSTGRES_URL);
  await sql`
    INSERT INTO image_generations (
      locale,
      business_unit,
      model,
      quality,
      image_size,
      output_format,
      prompt_version,
      openai_request_id,
      latency_ms,
      text_input_tokens,
      image_input_tokens,
      image_output_tokens,
      total_tokens,
      estimated_cost_micro_usd
    ) VALUES (
      ${usage.locale},
      ${usage.businessUnit},
      ${usage.model},
      ${usage.quality},
      ${usage.imageSize},
      ${usage.outputFormat},
      ${usage.promptVersion},
      ${usage.openaiRequestId ?? null},
      ${usage.latencyMs},
      ${usage.textInputTokens},
      ${usage.imageInputTokens},
      ${usage.imageOutputTokens},
      ${usage.totalTokens},
      ${usage.estimatedCostMicroUsd}
    )
  `;
}

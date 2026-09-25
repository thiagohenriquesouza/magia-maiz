import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { ACCEPTED_IMAGE_TYPES, BUSINESS_UNITS, MAX_INTENTION_LENGTH, MAX_PHOTO_BYTES, type Locale } from "@/lib/config";
import { recordEvent } from "@/lib/server/db";
import { cleanText, containsBlockedTheme, getAnonymousRequestKey, isRateLimited } from "@/lib/server/security";

export const runtime = "nodejs";
export const maxDuration = 60;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (isRateLimited(getAnonymousRequestKey(request))) return error("rate_limited", 429);
  if (!process.env.OPENAI_API_KEY || !process.env.BLOB_READ_WRITE_TOKEN) return error("service_not_configured", 503);

  try {
    const data = await request.formData();
    const locale: Locale = data.get("locale") === "es" ? "es" : "pt";
    const name = cleanText(String(data.get("name") ?? ""), 80);
    const intention = cleanText(String(data.get("intention") ?? ""), MAX_INTENTION_LENGTH);
    const businessUnit = cleanText(String(data.get("businessUnit") ?? ""), 40);
    const consent = data.get("consent") === "true";
    const photo = data.get("photo");

    if (!name || !intention || !consent) return error("invalid_form", 400);
    if (!BUSINESS_UNITS.some((item) => item.value === businessUnit)) return error("invalid_business_unit", 400);
    if (!(photo instanceof File) || !ACCEPTED_IMAGE_TYPES.includes(photo.type) || photo.size > MAX_PHOTO_BYTES || photo.size < 1_000) {
      return error("invalid_image", 400);
    }
    if (containsBlockedTheme(intention)) return error("unsupported_theme", 400);

    const bytes = Buffer.from(await photo.arrayBuffer());
    const signature = bytes.subarray(0, 12);
    const validSignature =
      (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) ||
      signature.toString("hex").startsWith("89504e470d0a1a0a") ||
      (signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP");
    if (!validSignature) return error("invalid_image", 400);

    const basePrompt = locale === "es" ? process.env.PROMPT_ES : process.env.PROMPT_PT;
    if (!basePrompt) return error("service_not_configured", 503);

    const userDirection = locale === "es"
      ? `La intención de atención de la persona es: "${intention}". Expresa esa energía visualmente sin incluir palabras.`
      : `A intenção de atendimento da pessoa é: "${intention}". Expresse essa energia visualmente sem incluir palavras.`;

    const controller = new AbortController();
    const timeoutMs = Number(process.env.GENERATION_TIMEOUT_MS ?? 55_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.images.edit(
        {
          model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst",
          image: await toFile(bytes, "portrait.webp", { type: photo.type }),
          prompt: `${basePrompt}\n\n${userDirection}`,
          quality: "medium",
          size: "1024x1536",
          output_format: "webp",
          output_compression: 82
        },
        { signal: controller.signal }
      );

      const encoded = response.data?.[0]?.b64_json;
      if (!encoded) return error("generation_failed", 502);
      const generated = Buffer.from(encoded, "base64");
      const day = new Date().toISOString().slice(0, 10);
      const pathname = `generated/${day}/${randomUUID()}.webp`;
      const blob = await put(pathname, generated, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        cacheControlMaxAge: 60 * 60 * 2
      });

      try {
        await recordEvent("image_generated", locale, businessUnit);
      } catch {
        // Operational analytics must never turn a successful generation into an error.
      }
      return NextResponse.json({ url: blob.url }, { headers: { "Cache-Control": "no-store" } });
    } finally {
      clearTimeout(timeout);
    }
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") return error("generation_timeout", 504);
    return error("generation_failed", 500);
  }
}

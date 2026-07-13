// Server-only: calls the Vision API with the server's VISION_API_KEY. Only
// ever import this from route handlers, never from client components.
import { GEMINI_RESPONSE_SCHEMA, OCR_PROMPT, ocrResultSchema, type OcrResult } from "@/lib/ocrSchema";

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(base64: string, mimeType: string): Promise<string> {
  const model = process.env.VISION_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.VISION_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: OCR_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join("");
      if (!text) throw new Error("Empty response from vision model");
      return text;
    }

    lastError = await res.text();
    if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(`Vision API error (${res.status}): ${lastError}`);
    }
    await sleep(attempt * 500);
  }
  throw new Error(`Vision API error: ${lastError}`);
}

// The model's JSON-mode guarantee isn't fully trustworthy in practice (observed
// reasoning text leaking into the text field even with responseMimeType set) —
// defensively extract the JSON object rather than trusting `text` is clean.
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in vision model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export type OcrOutcome =
  | { ok: true; result: OcrResult }
  | { ok: false; error: string };

/** Runs the full extract -> defensively-parse -> zod-clamp pipeline for one image. */
export async function runOcr(base64: string, mimeType: string): Promise<OcrOutcome> {
  try {
    const text = await callGemini(base64, mimeType);
    const rawJson = extractJson(text);
    const parsed = ocrResultSchema.safeParse(rawJson);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Couldn't read this sheet clearly. Try a clearer photo, or type it manually.",
      };
    }
    return { ok: true, result: parsed.data };
  } catch {
    return {
      ok: false,
      error: "Couldn't read this sheet right now. Try again, or type it manually.",
    };
  }
}

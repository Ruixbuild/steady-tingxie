import { z } from "zod";

// Verbatim system prompt per handoff spec §5.
export const OCR_PROMPT = `Extract this Singapore primary-school 听写 sheet. Return ONLY JSON:
{"listName":str?,"sections":[{"kind":"words"|"pinyin"|"passage","title":str,"pickN":int?,
"items":[{"hanzi":str,"pinyin":str?,"english":str?,"confidence":0-1}]}]}
words = child writes hanzi. pinyin = child writes PINYIN (pinyin is the answer; keep tone marks).
passage = ONE item, hanzi = full text with punctuation. confidence<0.8 when blurred/handwritten.`;

// Gemini structured-output JSON Schema (OpenAPI subset), passed as
// generationConfig.responseSchema alongside responseMimeType:"application/json".
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    listName: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["words", "pinyin", "passage"] },
          title: { type: "string" },
          pickN: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                hanzi: { type: "string" },
                pinyin: { type: "string" },
                english: { type: "string" },
                confidence: { type: "number" },
              },
              required: ["hanzi", "confidence"],
            },
          },
        },
        required: ["kind", "items"],
      },
    },
  },
  required: ["sections"],
};

// ≤40 items/section, hanzi ≤200 chars per §5 — clamped via .transform (truncate),
// not .max() (reject), since the spec wants oversized-but-valid extractions kept.
const itemSchema = z.object({
  hanzi: z
    .string()
    .transform((s) => s.slice(0, 200)),
  pinyin: z.string().optional(),
  english: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(1),
});

const sectionSchema = z.object({
  kind: z.enum(["words", "pinyin", "passage"]),
  title: z.string().optional(),
  pickN: z.number().int().optional(),
  items: z.array(itemSchema).transform((arr) => arr.slice(0, 40)),
});

export const ocrResultSchema = z.object({
  listName: z.string().optional(),
  sections: z.array(sectionSchema),
});

export type OcrResult = z.infer<typeof ocrResultSchema>;

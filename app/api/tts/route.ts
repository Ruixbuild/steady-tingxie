// Backs lib/tts.ts: proxies text to Google Cloud Text-to-Speech (Mandarin
// Wavenet voice) so narration comes from a real neural voice instead of
// whatever the child's browser happens to ship. Requires GOOGLE_TTS_API_KEY
// (a Google Cloud API key with the Text-to-Speech API enabled) to be set —
// fails closed (500) rather than silently falling through, same posture as
// app/api/digest. The client falls back to the Web Speech API on any
// non-200 response, so a missing/invalid key degrades rather than breaks
// narration.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_TEXT_LENGTH = 500;
const VOICE_NAME = "cmn-CN-Wavenet-A";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 500 });
  }

  let payload: { text?: string; lang?: string; rate?: number };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, lang = "zh-CN", rate = 1 } = payload;
  if (!text || typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text too long" }, { status: 413 });
  }

  const languageCode = lang.startsWith("zh") ? "cmn-CN" : lang;
  const speakingRate = Math.min(4, Math.max(0.25, rate));

  const googleRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: VOICE_NAME },
        audioConfig: { audioEncoding: "MP3", speakingRate },
      }),
    }
  );

  if (!googleRes.ok) {
    return NextResponse.json({ error: "TTS provider error" }, { status: 502 });
  }

  const { audioContent } = (await googleRes.json()) as { audioContent?: string };
  if (!audioContent) {
    return NextResponse.json({ error: "TTS provider returned no audio" }, { status: 502 });
  }

  const audioBuffer = Buffer.from(audioContent, "base64");
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

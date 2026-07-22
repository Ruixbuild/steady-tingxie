// Backs lib/tts.ts: proxies text to Google Cloud Text-to-Speech (Mandarin
// Chirp3-HD voice — Google's newest, most natural-sounding model) so
// narration comes from a real neural voice instead of whatever the child's
// browser happens to ship. Requires GOOGLE_TTS_API_KEY (a Google Cloud API
// key with the Text-to-Speech API enabled) to be set — fails closed (500)
// rather than silently falling through, same posture as app/api/digest.
// The client falls back to the Web Speech API on any non-200 response, so
// a missing/invalid key degrades rather than breaks narration.
//
// Sent as plain text with Google's own default voice settings — no
// speakingRate/pitch override, no SSML. Every attempt at tuning those
// (slower rates, SSML <break> pauses) made this voice sound muffled or
// distorted; if a specific pacing need comes up again, adjust deliberately
// from this plain baseline rather than reintroducing broad SSML/rate
// tuning.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_TEXT_LENGTH = 1000;
const VOICE_NAME = "cmn-CN-Chirp3-HD-Kore";

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

  let payload: { text?: string; lang?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, lang = "zh-CN" } = payload;
  if (!text || typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text too long" }, { status: 413 });
  }

  const languageCode = lang.startsWith("zh") ? "cmn-CN" : lang;

  const googleRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: VOICE_NAME },
        audioConfig: { audioEncoding: "MP3" },
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

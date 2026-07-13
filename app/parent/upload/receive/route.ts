import { NextResponse } from "next/server";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runOcr } from "@/lib/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

// PWA share_target invokes this with a real browser POST (no client JS
// involved), so there's no canvas available to downscale client-side —
// this route downscales server-side via sharp instead. The image is only
// ever held in memory for this one request; only the small extracted JSON
// (not image bytes) is passed onward, via a redirect query param, to
// /parent/upload for review.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.redirect(`${origin}/parent/upload?sharedError=1`);
  }

  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.redirect(`${origin}/parent/upload`);
  }

  // Handle the first shared image; if more were shared, the child can
  // add them manually from the intake screen after this one lands.
  const buffer = Buffer.from(await files[0].arrayBuffer());

  let base64: string;
  try {
    const resized = await sharp(buffer)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    base64 = resized.toString("base64");
  } catch {
    return NextResponse.redirect(`${origin}/parent/upload?sharedError=1`);
  }

  const outcome = await runOcr(base64, "image/jpeg");
  if (!outcome.ok) {
    return NextResponse.redirect(`${origin}/parent/upload?sharedError=1`);
  }

  const encoded = encodeURIComponent(JSON.stringify(outcome.result));
  return NextResponse.redirect(`${origin}/parent/upload?shared=${encoded}`);
}

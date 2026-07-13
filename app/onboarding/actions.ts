"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Level } from "@/lib/supabase/types";

const LEVELS: Level[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

export async function addChild(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  const emoji = String(formData.get("emoji") ?? "🙂");

  if (!name || !LEVELS.includes(level as Level)) {
    return { error: "Please enter a name and pick a level." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("children").insert({
    parent_id: user.id,
    name,
    level: level as Level,
    emoji,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

import { route, unwrap } from "@/lib/api";
import { getVoice } from "@/lib/data";
import { VoiceInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const GET = route(async (_req, userId) => getVoice(userId));

// Saves the instructions. Creates the profile row if this is the first save.
export const PATCH = route(async (req, userId) => {
  const { instructions } = VoiceInput.parse(await req.json());
  unwrap(await db().from("profiles").upsert({ id: userId, voice_instructions: instructions }, { onConflict: "id" }));
  return { instructions };
});

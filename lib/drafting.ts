import "server-only";
import { after } from "next/server";
import { getAuthorName } from "@/lib/data";
import { db } from "@/lib/supabase/server";
import { getFreshVoice } from "@/lib/voice-summary";
import { generateDraft } from "@/lib/writer";

// Marks the draft as generating and writes it after the response is sent.
// The client polls the post until `generating` is false.
export async function draftInBackground(userId: string, postId: string, idea: string) {
  await db()
    .from("posts")
    .update({ generating: true, error: null })
    .eq("user_id", userId)
    .eq("id", postId)
    .eq("status", "draft");

  after(async () => {
    try {
      const [authorName, voice] = await Promise.all([getAuthorName(userId), getFreshVoice(userId)]);
      const text = await generateDraft({ authorName, voice, idea });
      const { data: done } = await db()
        .from("posts")
        .update({ text, generating: false, error: null })
        .eq("user_id", userId)
        .eq("id", postId)
        .eq("status", "draft")
        .select("idea_id")
        .single();
      // The draft replaces the rough idea; it isn't kept once drafting succeeds.
      if (done?.idea_id) {
        await db().from("ideas").delete().eq("user_id", userId).eq("id", done.idea_id);
      }
    } catch (e) {
      console.error("background draft failed", e);
      await db()
        .from("posts")
        .update({ generating: false, error: (e as Error).message || "Drafting failed" })
        .eq("user_id", userId)
        .eq("id", postId);
    }
  });
}

import "server-only";
import { unwrap } from "@/lib/api";
import { getPublished, getVoice, isSummaryStale } from "@/lib/data";
import { db } from "@/lib/supabase/server";
import type { Voice } from "@/lib/types";
import { summarizeVoice } from "@/lib/writer";

// Most posts the summary will read. Newest first; plenty for a style portrait.
const SUMMARY_CORPUS_LIMIT = 60;

// Rewrites the "what the writer has noticed" summary from all published posts.
export async function refreshVoiceSummary(userId: string): Promise<Voice> {
  const posts = await getPublished(userId, SUMMARY_CORPUS_LIMIT);
  const count = (
    await db().from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published")
  ).count ?? 0;

  const summary = posts.length > 0 ? await summarizeVoice(posts) : null;
  unwrap(
    await db()
      .from("profiles")
      .upsert(
        {
          id: userId,
          voice_summary: summary,
          voice_summary_updated_at: new Date().toISOString(),
          voice_summary_post_count: count,
        },
        { onConflict: "id" },
      ),
  );
  return getVoice(userId);
}

// Used before generating: brings the summary up to date if published posts changed.
export async function getFreshVoice(userId: string): Promise<Voice> {
  const voice = await getVoice(userId);
  if (await isSummaryStale(userId, voice)) {
    try {
      return await refreshVoiceSummary(userId);
    } catch (e) {
      console.error("voice summary refresh failed; continuing with the old one", e);
    }
  }
  return voice;
}

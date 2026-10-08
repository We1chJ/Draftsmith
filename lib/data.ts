import "server-only";
import { db } from "@/lib/supabase/server";
import { unwrap } from "@/lib/api";
import type { Post, Voice } from "@/lib/types";
import { EXAMPLE_LIMIT } from "@/lib/types";

const POST_COLUMNS = "id,idea_id,title,text,status,origin,published_at,created_at,updated_at";

export async function getAuthorName(userId: string): Promise<string> {
  const { data } = await db().from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name || "the author";
}

// Published history, newest first. Undated imports sort after dated ones.
export async function getPublished(userId: string, limit?: number): Promise<Post[]> {
  let q = db()
    .from("posts")
    .select(POST_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  return unwrap(await q) as Post[];
}

export async function getVoice(userId: string): Promise<Voice> {
  const [profile, examples, count] = await Promise.all([
    db()
      .from("profiles")
      .select("voice_instructions,voice_summary,voice_summary_updated_at,voice_summary_post_count")
      .eq("id", userId)
      .maybeSingle(),
    getPublished(userId, EXAMPLE_LIMIT),
    db().from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published"),
  ]);
  const p = profile.data;
  return {
    instructions: p?.voice_instructions ?? null,
    summary: p?.voice_summary ?? null,
    summary_updated_at: p?.voice_summary_updated_at ?? null,
    summary_post_count: p?.voice_summary_post_count ?? null,
    published_count: count.count ?? 0,
    examples: examples.map(({ id, title, text }) => ({ id, title, text })),
  };
}

// The summary is stale when there are published posts changed since it was written,
// or when it was never written but posts exist.
export async function isSummaryStale(userId: string, voice: Voice): Promise<boolean> {
  if (voice.published_count === 0) return false;
  if (!voice.summary || !voice.summary_updated_at) return true;
  if (voice.summary_post_count !== voice.published_count) return true;
  const { data } = await db()
    .from("posts")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("status", "published")
    .gt("updated_at", voice.summary_updated_at)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

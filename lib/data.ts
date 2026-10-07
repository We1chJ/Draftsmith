import "server-only";
import { db } from "@/lib/supabase/server";
import { unwrap } from "@/lib/api";
import type { PastPost, Voice } from "@/lib/types";

// How many past posts go into the prompt. Newest by posted_on first.
const EXAMPLE_LIMIT = 10;

export async function getAuthorName(userId: string): Promise<string> {
  const { data } = await db().from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name || "the author";
}

export async function getVoice(userId: string, limit?: number): Promise<Voice> {
  const [profile, posts] = await Promise.all([
    db().from("profiles").select("voice_instructions").eq("id", userId).maybeSingle(),
    (() => {
      let q = db()
        .from("past_posts")
        .select("id,title,text,posted_on,created_at")
        .eq("user_id", userId)
        .order("posted_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      return q;
    })(),
  ]);
  return {
    instructions: profile.data?.voice_instructions ?? null,
    posts: unwrap(posts) as PastPost[],
  };
}

export const getVoiceForWriter = (userId: string) => getVoice(userId, EXAMPLE_LIMIT);

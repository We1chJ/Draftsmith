import { route, unwrap } from "@/lib/api";
import { draftInBackground } from "@/lib/drafting";
import { IdeaInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

// Drafting runs after the response; give it room on hosts that cap function time.
export const maxDuration = 60;

const IDEA_WITH_DRAFTS =
  "id,text,status,created_at,posts(id,text,status,generating,error,updated_at)";

export const GET = route(async (req, userId) => {
  const search = new URL(req.url).searchParams.get("q");
  let q = db()
    .from("ideas")
    .select(IDEA_WITH_DRAFTS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (search) q = q.ilike("text", `%${search}%`);
  return unwrap(await q);
});

// Saves the idea, creates an empty draft for it, and starts writing the draft in the background.
export const POST = route(async (req, userId) => {
  const { text } = IdeaInput.parse(await req.json());
  const idea = unwrap(
    await db().from("ideas").insert({ text, user_id: userId, status: "drafted" }).select("id").single(),
  ) as { id: string };
  const post = unwrap(
    await db()
      .from("posts")
      .insert({ user_id: userId, idea_id: idea.id, text: "", status: "draft", generating: true })
      .select("id")
      .single(),
  ) as { id: string };
  await draftInBackground(userId, post.id, text);
  return unwrap(await db().from("ideas").select(IDEA_WITH_DRAFTS).eq("id", idea.id).single());
});

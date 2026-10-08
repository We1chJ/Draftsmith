import { HttpError, route, unwrap } from "@/lib/api";
import { draftInBackground } from "@/lib/drafting";
import { db } from "@/lib/supabase/server";

export const maxDuration = 60;

type Ctx = RouteContext<"/api/posts/[id]/redraft">;

// Rewrites a draft from its idea in the background (used to retry a failed draft).
export const POST = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  const post = unwrap(
    await db().from("posts").select("status,ideas(text)").eq("user_id", userId).eq("id", id).single(),
  ) as { status: string; ideas: { text: string } | null };
  if (post.status !== "draft") throw new HttpError(409, "Only drafts can be redrafted.");
  if (!post.ideas?.text) throw new HttpError(400, "This draft has no idea to write from.");
  await draftInBackground(userId, id, post.ideas.text);
  return { ok: true };
});

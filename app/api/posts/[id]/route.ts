import { route, unwrap } from "@/lib/api";
import { removeAllImages } from "@/lib/images";
import { PostPatch } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

type Ctx = RouteContext<"/api/posts/[id]">;

export const GET = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  return unwrap(await db().from("posts").select("*").eq("user_id", userId).eq("id", id).single());
});

export const PATCH = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const input = PostPatch.parse(await req.json());
  // Scheduled or publishing posts are locked; unschedule first to edit.
  return unwrap(
    await db()
      .from("posts")
      .update(input)
      .eq("user_id", userId)
      .eq("id", id)
      .in("status", ["draft", "failed"])
      .select()
      .single(),
  );
});

// The DB trigger refuses to delete published posts.
export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  await removeAllImages(userId, id);
  unwrap(await db().from("posts").delete().eq("user_id", userId).eq("id", id));
});

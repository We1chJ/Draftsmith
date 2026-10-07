import { route, unwrap } from "@/lib/api";
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
  return unwrap(await db().from("posts").update(input).eq("user_id", userId).eq("id", id).select().single());
});

// The DB trigger refuses to delete published posts.
export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  unwrap(await db().from("posts").delete().eq("user_id", userId).eq("id", id));
});

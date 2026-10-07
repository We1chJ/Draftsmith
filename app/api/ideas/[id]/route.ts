import { route, unwrap } from "@/lib/api";
import { IdeaPatch } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

type Ctx = RouteContext<"/api/ideas/[id]">;

export const GET = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  return unwrap(await db().from("ideas").select("*").eq("user_id", userId).eq("id", id).single());
});

export const PATCH = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const input = IdeaPatch.parse(await req.json());
  return unwrap(await db().from("ideas").update(input).eq("user_id", userId).eq("id", id).select().single());
});

export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  unwrap(await db().from("ideas").delete().eq("user_id", userId).eq("id", id));
});

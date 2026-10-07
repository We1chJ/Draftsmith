import { route, unwrap } from "@/lib/api";
import { PastPostInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

type Ctx = RouteContext<"/api/voice/posts/[id]">;

export const PATCH = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const input = PastPostInput.partial().parse(await req.json());
  return unwrap(
    await db()
      .from("past_posts")
      .update(input)
      .eq("user_id", userId)
      .eq("id", id)
      .select("id,title,text,posted_on,created_at")
      .single(),
  );
});

export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  unwrap(await db().from("past_posts").delete().eq("user_id", userId).eq("id", id));
});

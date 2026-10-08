import { route, unwrap } from "@/lib/api";
import { db } from "@/lib/supabase/server";

type Ctx = RouteContext<"/api/posts/[id]/unschedule">;

export const POST = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  return unwrap(
    await db()
      .from("posts")
      .update({ status: "draft", scheduled_at: null })
      .eq("user_id", userId)
      .eq("id", id)
      .eq("status", "scheduled")
      .select("id,status")
      .single(),
  );
});

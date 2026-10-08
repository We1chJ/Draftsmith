import { route, unwrap } from "@/lib/api";
import { removeAllImages } from "@/lib/images";
import { db } from "@/lib/supabase/server";

type Ctx = RouteContext<"/api/published/[id]">;

// Published posts are immutable: no PATCH. The only write is removal, and the DB trigger
// refuses to delete anything LinkedIn actually accepted.
export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  await removeAllImages(userId, id);
  unwrap(await db().from("posts").delete().eq("user_id", userId).eq("id", id).eq("status", "published"));
});

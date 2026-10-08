import { HttpError, route } from "@/lib/api";
import { publishNow } from "@/lib/linkedin";

// Image uploads plus the post can take a while.
export const maxDuration = 60;

type Ctx = RouteContext<"/api/posts/[id]/publish-now">;

export const POST = route<Ctx>(async (_req, userId, ctx) => {
  const { id } = await ctx.params;
  const result = await publishNow(userId, id);
  if (!result.ok) throw new HttpError(502, result.error);
  return result;
});

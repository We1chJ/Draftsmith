import { z } from "zod";
import { HttpError, route, unwrap } from "@/lib/api";
import { db } from "@/lib/supabase/server";
import { POST_MAX_CHARS } from "@/lib/types";

type Ctx = RouteContext<"/api/posts/[id]/schedule">;

const Body = z.object({ scheduled_at: z.iso.datetime({ offset: true }) });

// Schedules a draft (or reschedules). The cron job publishes it once the time passes.
export const POST = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const when = new Date(Body.parse(await req.json()).scheduled_at);
  if (when.getTime() < Date.now() + 60_000) throw new HttpError(400, "Pick a time at least a minute from now.");

  const { data: account } = await db().from("linkedin_accounts").select("expires_at").eq("user_id", userId).maybeSingle();
  if (!account) throw new HttpError(400, "Connect LinkedIn before scheduling.");
  if (when >= new Date(account.expires_at)) {
    throw new HttpError(400, "Your LinkedIn connection expires before then. Reconnect it, then schedule.");
  }

  const post = unwrap(
    await db().from("posts").select("status,text").eq("user_id", userId).eq("id", id).single(),
  ) as { status: string; text: string };
  if (!["draft", "failed", "scheduled"].includes(post.status)) throw new HttpError(409, "Only drafts can be scheduled.");
  if (!post.text.trim()) throw new HttpError(400, "The post is empty.");
  if (post.text.length > POST_MAX_CHARS) throw new HttpError(400, `LinkedIn allows ${POST_MAX_CHARS} characters.`);

  return unwrap(
    await db()
      .from("posts")
      .update({ status: "scheduled", scheduled_at: when.toISOString(), error: null })
      .eq("user_id", userId)
      .eq("id", id)
      .in("status", ["draft", "failed", "scheduled"])
      .select("id,status,scheduled_at")
      .single(),
  );
});

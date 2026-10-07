import { route, unwrap } from "@/lib/api";
import { PostInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const GET = route(async (req, userId) => {
  const status = new URL(req.url).searchParams.get("status");
  let q = db().from("posts").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (status) q = q.eq("status", status);
  return unwrap(await q);
});

// Always creates a draft; nothing here can approve, schedule, or publish (N2).
export const POST = route(async (req, userId) => {
  const input = PostInput.parse(await req.json());
  const post = unwrap(
    await db()
      .from("posts")
      .insert({ ...input, user_id: userId, status: "draft" })
      .select()
      .single(),
  );
  if (input.idea_id) {
    unwrap(
      await db()
        .from("ideas")
        .update({ status: "drafted" })
        .eq("user_id", userId)
        .eq("id", input.idea_id)
        .eq("status", "new"),
    );
  }
  return post;
});

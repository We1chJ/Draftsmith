import { route, unwrap } from "@/lib/api";
import { PostInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const GET = route(async (req, userId) => {
  const status = new URL(req.url).searchParams.get("status");
  let q = db()
    .from("posts")
    .select("id,idea_id,title,text,status,origin,published_at,scheduled_at,created_at,updated_at,generating,error,post_images(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  // Published history has its own route; this list is the working set.
  q = status ? q.eq("status", status) : q.neq("status", "published");
  const rows = unwrap(await q) as (Record<string, unknown> & { post_images: { count: number }[] })[];
  return rows.map(({ post_images, ...p }) => ({ ...p, image_count: post_images?.[0]?.count ?? 0 }));
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

import { route, unwrap } from "@/lib/api";
import { getPublished } from "@/lib/data";
import { PublishedInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const GET = route(async (_req, userId) => getPublished(userId));

// Imports a post the user published before. The only way a post is created already-published;
// the app's own publishing (Phase 2) will flip drafts instead.
export const POST = route(async (req, userId) => {
  const { title, text, published_on } = PublishedInput.parse(await req.json());
  return unwrap(
    await db()
      .from("posts")
      .insert({
        user_id: userId,
        title,
        text,
        status: "published",
        origin: "imported",
        published_at: published_on ? `${published_on}T00:00:00Z` : null,
      })
      .select("id,idea_id,title,text,status,origin,published_at,created_at,updated_at")
      .single(),
  );
});

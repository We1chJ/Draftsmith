import { route, unwrap } from "@/lib/api";
import { PastPostInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const POST = route(async (req, userId) => {
  const input = PastPostInput.parse(await req.json());
  return unwrap(
    await db()
      .from("past_posts")
      .insert({ ...input, user_id: userId })
      .select("id,title,text,posted_on,created_at")
      .single(),
  );
});

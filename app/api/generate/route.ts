import { route, unwrap } from "@/lib/api";
import { getAuthorName, getVoiceForWriter } from "@/lib/data";
import { GenerateInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";
import { generateVariants } from "@/lib/writer";

// Returns 2-3 variants. Nothing is saved until the user saves one as a draft.
export const POST = route(async (req, userId) => {
  const input = GenerateInput.parse(await req.json());
  let idea = input.text ?? "";
  if (input.idea_id) {
    const row: { text: string } = unwrap(
      await db().from("ideas").select("text").eq("user_id", userId).eq("id", input.idea_id).single(),
    );
    idea = row.text;
  }
  const [authorName, voice] = await Promise.all([getAuthorName(userId), getVoiceForWriter(userId)]);
  const variants = await generateVariants({ authorName, voice, idea, notes: input.notes });
  return { variants };
});

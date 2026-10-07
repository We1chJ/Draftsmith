import { HttpError, route } from "@/lib/api";
import { getAuthorName, getVoiceForWriter } from "@/lib/data";
import { REWRITE_PRESETS, RewriteInput } from "@/lib/schemas";
import { rewriteDraft } from "@/lib/writer";

export const POST = route(async (req, userId) => {
  const input = RewriteInput.parse(await req.json());
  const instruction = [input.preset && REWRITE_PRESETS[input.preset], input.instruction]
    .filter(Boolean)
    .join(" ");
  if (!instruction) throw new HttpError(400, "preset or instruction is required");
  const [authorName, voice] = await Promise.all([getAuthorName(userId), getVoiceForWriter(userId)]);
  const text = await rewriteDraft({ authorName, voice, text: input.text, instruction });
  return { text };
});

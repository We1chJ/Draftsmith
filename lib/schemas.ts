import { z } from "zod";
import { POST_MAX_CHARS } from "@/lib/types";

const optionalText = z.string().trim().nullish().transform((v) => v || null);

export const IdeaInput = z.object({
  text: z.string().trim().min(1),
});

export const IdeaPatch = IdeaInput.partial().extend({
  status: z.enum(["new", "drafted", "used", "archived"]).optional(),
});

export const PostInput = z.object({
  text: z.string().max(POST_MAX_CHARS),
  idea_id: z.uuid().nullish(),
});

// Status is deliberately not patchable here; approve/schedule come with the publishing phase.
export const PostPatch = z.object({
  text: z.string().max(POST_MAX_CHARS).optional(),
});

export const VoiceInput = z.object({
  instructions: optionalText,
});

// A post the user published before (imported by hand). Date is optional.
export const PublishedInput = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(POST_MAX_CHARS),
  published_on: z.iso.date().nullish(),
});

export const REWRITE_PRESETS = {
  shorter: "Make it noticeably shorter. Keep the core point and the voice.",
  hook: "Rewrite the opening line as a stronger, more specific hook. Keep the rest close to the original.",
  personal: "Make it more personal: first person, concrete, drawn only from details already in the draft.",
  question: "End with a genuine question that invites replies.",
} as const;

export const RewriteInput = z.object({
  text: z.string().trim().min(1).max(POST_MAX_CHARS),
  preset: z.enum(Object.keys(REWRITE_PRESETS) as [keyof typeof REWRITE_PRESETS]).optional(),
  instruction: z.string().trim().optional(),
});

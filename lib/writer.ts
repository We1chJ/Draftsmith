import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import type { Variant, Voice } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const client = new OpenAI();

function voiceBlock(voice: Voice): string[] {
  const parts: string[] = [];
  if (voice.instructions) {
    parts.push(`<instructions_from_author>\n${voice.instructions}\n</instructions_from_author>`);
  }
  if (voice.posts.length > 0) {
    const items = voice.posts
      .map((p, i) => `<post n="${i + 1}" title="${p.title.replace(/"/g, "'")}">\n${p.text}\n</post>`)
      .join("\n\n");
    parts.push(
      [
        "These are posts the author actually published. Match their voice: sentence length, rhythm, how they open, how they end, what they leave out.",
        "Never reuse their content, stories, or specific phrases. Only the idea you are given supplies the content.",
        `<past_posts>\n${items}\n</past_posts>`,
      ].join("\n"),
    );
  }
  if (parts.length === 0) parts.push("The author has not described their voice yet. Write plainly and directly.");
  return parts;
}

function systemPrompt(authorName: string, voice: Voice): string {
  return [
    `You write LinkedIn posts for ${authorName}, in their voice.`,
    "Never invent facts, numbers, names, or stories that are not in the idea or the draft you are given. If the idea is thin, write a shorter post rather than padding it.",
    `Hard limit: every post must be under ${POST_MAX_CHARS} characters. Write plain text with line breaks; LinkedIn does not render markdown.`,
    ...voiceBlock(voice),
  ].join("\n\n");
}

async function ask<T extends z.ZodType>(system: string, user: string, schema: T): Promise<z.infer<T>> {
  const response = await client.responses.parse({
    model: MODEL,
    instructions: system,
    input: user,
    text: { format: zodTextFormat(schema, "result") },
  });
  const refused = response.output.some(
    (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
  );
  if (refused) throw new HttpError(502, "The model declined this request.");
  if (response.status !== "completed" || !response.output_parsed) {
    throw new HttpError(502, "The model returned an incomplete response. Try again.");
  }
  return response.output_parsed as z.infer<T>;
}

const VariantsSchema = z.object({
  variants: z.array(z.object({ hook: z.string(), text: z.string() })),
});

export async function generateVariants(opts: {
  authorName: string;
  voice: Voice;
  idea: string;
  notes?: string;
}): Promise<Variant[]> {
  const user = [
    `<idea>\n${opts.idea}\n</idea>`,
    opts.notes && `<notes>\n${opts.notes}\n</notes>`,
    "Write 3 distinct variants of a LinkedIn post from this idea. Each variant must open with a different hook. In `hook`, put just the opening line; in `text`, the full post including that opening line.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const { variants } = await ask(systemPrompt(opts.authorName, opts.voice), user, VariantsSchema);
  return variants.slice(0, 3);
}

const RewriteSchema = z.object({ text: z.string() });

export async function rewriteDraft(opts: {
  authorName: string;
  voice: Voice;
  text: string;
  instruction: string;
}): Promise<string> {
  const user = [
    `<draft>\n${opts.text}\n</draft>`,
    `Rewrite the draft. Instruction: ${opts.instruction}`,
    "Return the full rewritten post in `text`.",
  ].join("\n\n");
  const { text } = await ask(systemPrompt(opts.authorName, opts.voice), user, RewriteSchema);
  return text;
}

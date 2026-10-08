import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import type { Post, Voice } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const client = new OpenAI();

function voiceBlock(voice: Voice): string[] {
  const parts: string[] = [];
  if (voice.instructions) {
    parts.push(
      `The author's own instructions. These take priority over everything below.\n<instructions_from_author>\n${voice.instructions}\n</instructions_from_author>`,
    );
  }
  if (voice.summary) {
    parts.push(
      `Observations about how the author writes, drawn from all ${voice.summary_post_count ?? ""} of their published posts.\n<observed_style>\n${voice.summary}\n</observed_style>`,
    );
  }
  if (voice.examples.length > 0) {
    const items = voice.examples
      .map((p, i) => `<post n="${i + 1}"${p.title ? ` title="${p.title.replace(/"/g, "'")}"` : ""}>\n${p.text}\n</post>`)
      .join("\n\n");
    parts.push(
      [
        "The author's most recent published posts. Match their voice: sentence length, rhythm, how they open, how they end, what they leave out.",
        "Never reuse their content, stories, or specific phrases. Only the idea you are given supplies the content.",
        `<published_posts>\n${items}\n</published_posts>`,
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

const DraftSchema = z.object({ text: z.string() });

export async function generateDraft(opts: { authorName: string; voice: Voice; idea: string }): Promise<string> {
  const user = [
    `<idea>\n${opts.idea}\n</idea>`,
    "Write one LinkedIn post from this idea. Return the full post in `text`.",
  ].join("\n\n");
  const { text } = await ask(systemPrompt(opts.authorName, opts.voice), user, DraftSchema);
  return text.trim();
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

const SummarySchema = z.object({ summary: z.string() });

// Reads every published post and describes how the author writes. Observations only,
// no advice and no quoting; the result is shown to the author and fed into every prompt.
export async function summarizeVoice(posts: Pick<Post, "title" | "text">[]): Promise<string> {
  const corpus = posts.map((p, i) => `<post n="${i + 1}">\n${p.text}\n</post>`).join("\n\n");
  const system = [
    "You study a writer's published LinkedIn posts and describe how they write, so a ghostwriter can match them.",
    "Describe only what is observable: how posts open, sentence and paragraph length, rhythm, point of view, how they end, recurring structures, punctuation habits, what they never do.",
    "Be concrete and specific to this writer. No praise, no advice, no generic statements that would fit anyone. Do not quote or retell their content.",
    "Write plain prose, 120 to 250 words, as a single block with short paragraphs. Second person is fine ('You open with...').",
  ].join("\n");
  const { summary } = await ask(system, `<published_posts>\n${corpus}\n</published_posts>`, SummarySchema);
  return summary.trim();
}

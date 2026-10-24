import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import type { Discovery, DiscoverySource } from "@/lib/types";
import { ask } from "@/lib/writer";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const client = new OpenAI();

const IMAGE_FETCH_TIMEOUT_MS = 6000;

// Search results often carry tracking parameters; drop them so the same page matches and links stay clean.
function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    for (const key of [...u.searchParams.keys()]) if (key.startsWith("utm_")) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return null;
  }
}

// Step 1: let the model search the live web and write a plain research memo with citations.
async function research(brief: string): Promise<{ memo: string; sources: Map<string, string> }> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await client.responses.create({
    model: MODEL,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    instructions: [
      "You find fresh news that a professional could write a LinkedIn post about.",
      `Today is ${today}. Strongly prefer stories from the last 72 hours; never include anything older than 14 days.`,
      "Search several times with different queries so the stories are varied. Report facts only; do not speculate.",
    ].join("\n"),
    input: [
      `<brief>\n${brief}\n</brief>`,
      "Find 8 distinct, recent stories that match this brief. For each one give: a headline, what happened in 2 to 3 sentences, the date it was published, and cite the source articles.",
    ].join("\n\n"),
  });

  const sources = new Map<string, string>(); // clean url -> title
  for (const item of response.output) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations) {
          const url = a.type === "url_citation" ? cleanUrl(a.url) : null;
          if (url && a.type === "url_citation") sources.set(url, a.title);
        }
      }
    } else if (item.type === "web_search_call" && item.action.type === "search") {
      for (const s of item.action.sources ?? []) {
        const url = cleanUrl(s.url);
        if (url && !sources.has(url)) sources.set(url, new URL(url).hostname.replace(/^www\./, ""));
      }
    }
  }
  return { memo: response.output_text, sources };
}

const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      headline: z.string(),
      summary: z.string(),
      angle: z.string(),
      news_date: z.string(),
      source_urls: z.array(z.string()),
    }),
  ),
});

// Step 2: turn the memo into idea cards. Only URLs the search actually returned are kept.
async function toIdeas(brief: string, memo: string, sources: Map<string, string>) {
  const system = [
    "You turn a research memo about recent news into post ideas for a LinkedIn author.",
    "Use only facts in the memo. Never invent sources, numbers, or dates.",
  ].join("\n");
  const user = [
    `<author_brief>\n${brief}\n</author_brief>`,
    `<memo>\n${memo}\n</memo>`,
    `<allowed_urls>\n${[...sources.keys()].join("\n")}\n</allowed_urls>`,
    [
      "Return one idea per distinct story in the memo, most recent first.",
      "headline: the news in under 90 characters. summary: what happened, 2 to 3 sentences.",
      "angle: one or two sentences on the point of view the author could take in a post, fitted to their brief.",
      "news_date: the publication date as YYYY-MM-DD, or an empty string if the memo doesn't say.",
      "source_urls: the article URLs for this story, copied exactly from allowed_urls, best source first.",
    ].join("\n"),
  ].join("\n\n");
  const { ideas } = await ask(system, user, IdeasSchema);
  return ideas.map((i) => ({
    headline: i.headline.trim(),
    summary: i.summary.trim(),
    angle: i.angle.trim(),
    news_date: /^\d{4}-\d{2}-\d{2}$/.test(i.news_date) ? i.news_date : null,
    sources: i.source_urls
      .map((u) => cleanUrl(u))
      .filter((u): u is string => !!u && sources.has(u))
      .slice(0, 3)
      .map((url): DiscoverySource => ({ url, title: sources.get(url)! })),
  }));
}

// Only fetch public https pages: no IP literals or local names, since the URLs come from model output.
function isFetchable(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return protocol === "https:" && hostname.includes(".") && !/^[\d.]+$/.test(hostname) && !hostname.includes(":");
}

const META_TAG = /<meta\b[^>]*>/gi;
const IMAGE_KEYS = new Set(["og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"]);

// The article's own preview image (og:image / twitter:image), if it has one.
async function previewImage(pageUrl: string): Promise<string | null> {
  if (!isFetchable(pageUrl)) return null;
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Draftsmith/1.0)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("html")) return null;
    const head = (await res.text()).slice(0, 300_000);
    for (const tag of head.match(META_TAG) ?? []) {
      const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (!key || !content || !IMAGE_KEYS.has(key)) continue;
      const src = new URL(content.replace(/&amp;/g, "&"), res.url).toString();
      if (src.startsWith("https://")) return src;
    }
  } catch {
    // Slow or blocked sites just don't get an image.
  }
  return null;
}

// Searches the web for the brief and returns idea cards with preview images.
export async function findIdeas(brief: string): Promise<Discovery[]> {
  const { memo, sources } = await research(brief);
  if (!memo.trim() || sources.size === 0) return [];
  const ideas = (await toIdeas(brief, memo, sources)).filter((i) => i.sources.length > 0);
  return Promise.all(
    ideas.map(async (idea) => {
      let image_url: string | null = null;
      for (const s of idea.sources.slice(0, 2)) {
        image_url = await previewImage(s.url);
        if (image_url) break;
      }
      return { ...idea, image_url };
    }),
  );
}

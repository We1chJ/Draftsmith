import { route } from "@/lib/api";
import { findIdeas } from "@/lib/discover";
import { DiscoverInput } from "@/lib/schemas";

// A web search plus reading each article's preview image; usually one to two minutes.
export const maxDuration = 300;

// Searches the latest news for the brief and returns idea cards. Nothing is saved.
export const POST = route(async (req) => {
  const { brief } = DiscoverInput.parse(await req.json());
  return findIdeas(brief);
});

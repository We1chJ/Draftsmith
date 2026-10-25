import { z } from "zod";
import { HttpError, route } from "@/lib/api";
import { addImages, updateImage } from "@/lib/images";
import { LINKEDIN } from "@/lib/platforms";

type Ctx = RouteContext<"/api/posts/[id]/images/from-url">;

const FETCH_TIMEOUT_MS = 20_000;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };

const Input = z.object({
  url: z.url({ protocol: /^https$/ }),
  alt: z.string().trim().max(300).nullish(),
});

// Only public https hosts: the URL comes from the browser, so no IP literals or local names.
function assertPublicHost(url: string) {
  const { hostname } = new URL(url);
  if (!hostname.includes(".") || /^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    throw new HttpError(400, "That image address can't be used.");
  }
}

// Attaches a photo found by search: downloads it server-side and stores it like an upload.
export const POST = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const { url, alt } = Input.parse(await req.json());
  assertPublicHost(url);

  // Some image hosts (e.g. Wikimedia) refuse requests that don't identify themselves.
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
    headers: { "User-Agent": "Draftsmith/1.0 (https://draftsmithai.vercel.app)" },
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, "Couldn't download that photo. Try another one.");
  const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!EXT[type]) throw new HttpError(400, "That photo isn't a JPG, PNG or GIF. Try another one.");
  if (Number(res.headers.get("content-length") ?? 0) > LINKEDIN.imageMaxBytes) {
    throw new HttpError(400, "That photo is too large. Try another one.");
  }

  const file = new File([await res.arrayBuffer()], `search.${EXT[type]}`, { type });
  const images = await addImages(userId, id, [file]);
  if (!alt) return images;
  // The new photo is last; give it the search result's title as alt text.
  return updateImage(userId, id, images[images.length - 1].id, { alt });
});

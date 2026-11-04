import { z } from "zod";
import { HttpError, route } from "@/lib/api";
import { readImage, removeImage, replaceImage, updateImage } from "@/lib/images";
import { LINKEDIN } from "@/lib/platforms";

type Ctx = RouteContext<"/api/posts/[id]/images/[imageId]">;

const ImagePatch = z.object({
  alt: z.string().trim().max(LINKEDIN.altTextMaxChars).nullish().transform((v) => (v === undefined ? undefined : v || null)),
  position: z.number().int().min(0).optional(),
});

// The original file, served from our own origin so the browser editor can draw it on a canvas.
export const GET = route<Ctx>(async (_req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  const { data, mime } = await readImage(userId, id, imageId);
  return new Response(data, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store" } });
});

// Replaces the file with an edited (e.g. redacted) version: multipart/form-data with one `file`.
export const PUT = route<Ctx>(async (req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "No file received");
  return replaceImage(userId, id, imageId, file);
});

export const PATCH = route<Ctx>(async (req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  return updateImage(userId, id, imageId, ImagePatch.parse(await req.json()));
});

export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  return removeImage(userId, id, imageId);
});

import { z } from "zod";
import { route } from "@/lib/api";
import { removeImage, updateImage } from "@/lib/images";
import { LINKEDIN } from "@/lib/platforms";

type Ctx = RouteContext<"/api/posts/[id]/images/[imageId]">;

const ImagePatch = z.object({
  alt: z.string().trim().max(LINKEDIN.altTextMaxChars).nullish().transform((v) => (v === undefined ? undefined : v || null)),
  position: z.number().int().min(0).optional(),
});

export const PATCH = route<Ctx>(async (req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  return updateImage(userId, id, imageId, ImagePatch.parse(await req.json()));
});

export const DELETE = route<Ctx>(async (_req, userId, ctx) => {
  const { id, imageId } = await ctx.params;
  return removeImage(userId, id, imageId);
});

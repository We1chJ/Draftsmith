import { HttpError, route } from "@/lib/api";
import { addImages, listImages } from "@/lib/images";

type Ctx = RouteContext<"/api/posts/[id]/images">;

export const GET = route<Ctx>(async (_req, userId, ctx) => listImages(userId, (await ctx.params).id));

// multipart/form-data with one or more `files` fields.
export const POST = route<Ctx>(async (req, userId, ctx) => {
  const { id } = await ctx.params;
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new HttpError(400, "No files received");
  return addImages(userId, id, files);
});

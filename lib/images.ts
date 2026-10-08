import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError, unwrap } from "@/lib/api";
import { LINKEDIN } from "@/lib/platforms";
import { db } from "@/lib/supabase/server";
import type { PostImage } from "@/lib/types";

const BUCKET = "draftsmith-images";
const SIGNED_URL_TTL = 60 * 60; // seconds
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };

type Row = { id: string; path: string; mime: string; bytes: number | null; alt: string | null; position: number };

function storage() {
  return db().storage.from(BUCKET);
}

// Confirms the post belongs to the user; returns its current image rows in order.
async function rowsFor(userId: string, postId: string): Promise<Row[]> {
  unwrap(await db().from("posts").select("id").eq("user_id", userId).eq("id", postId).single());
  return unwrap(
    await db()
      .from("post_images")
      .select("id,path,mime,bytes,alt,position")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .order("position"),
  ) as Row[];
}

async function withUrls(rows: Row[]): Promise<PostImage[]> {
  if (rows.length === 0) return [];
  const { data, error } = await storage().createSignedUrls(
    rows.map((r) => r.path),
    SIGNED_URL_TTL,
  );
  if (error) throw new Error(error.message);
  return rows.map((r, i) => ({
    id: r.id,
    alt: r.alt,
    position: r.position,
    mime: r.mime,
    bytes: r.bytes,
    url: data[i]?.signedUrl ?? "",
  }));
}

export async function listImages(userId: string, postId: string): Promise<PostImage[]> {
  return withUrls(await rowsFor(userId, postId));
}

// Validates against LinkedIn's rules, stores the files, appends rows after the existing ones.
export async function addImages(userId: string, postId: string, files: File[]): Promise<PostImage[]> {
  const existing = await rowsFor(userId, postId);
  if (existing.length + files.length > LINKEDIN.maxImages) {
    throw new HttpError(400, `LinkedIn allows ${LINKEDIN.maxImages} images per post. This post has ${existing.length}.`);
  }
  for (const f of files) {
    if (!EXT[f.type]) throw new HttpError(400, `${f.name}: only JPG, PNG and GIF are allowed.`);
    if (f.size > LINKEDIN.imageMaxBytes) {
      throw new HttpError(400, `${f.name}: larger than ${LINKEDIN.imageMaxBytes / 1024 / 1024} MB.`);
    }
  }

  let position = existing.length ? Math.max(...existing.map((r) => r.position)) + 1 : 0;
  for (const f of files) {
    const path = `${userId}/${postId}/${randomUUID()}.${EXT[f.type]}`;
    const { error } = await storage().upload(path, Buffer.from(await f.arrayBuffer()), {
      contentType: f.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    unwrap(
      await db()
        .from("post_images")
        .insert({ user_id: userId, post_id: postId, path, mime: f.type, bytes: f.size, position: position++ }),
    );
  }
  return listImages(userId, postId);
}

export async function updateImage(
  userId: string,
  postId: string,
  imageId: string,
  patch: { alt?: string | null; position?: number },
): Promise<PostImage[]> {
  unwrap(
    await db()
      .from("post_images")
      .update(patch)
      .eq("user_id", userId)
      .eq("post_id", postId)
      .eq("id", imageId)
      .select("id")
      .single(),
  );
  return listImages(userId, postId);
}

export async function removeImage(userId: string, postId: string, imageId: string): Promise<PostImage[]> {
  const row = unwrap(
    await db()
      .from("post_images")
      .select("path")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .eq("id", imageId)
      .single(),
  ) as { path: string };
  const { error } = await storage().remove([row.path]);
  if (error) throw new Error(error.message);
  unwrap(await db().from("post_images").delete().eq("id", imageId));
  return listImages(userId, postId);
}

// Called before a post row is deleted, so the files don't outlive it.
export async function removeAllImages(userId: string, postId: string): Promise<void> {
  const rows = unwrap(
    await db().from("post_images").select("path").eq("user_id", userId).eq("post_id", postId),
  ) as { path: string }[];
  if (rows.length === 0) return;
  const { error } = await storage().remove(rows.map((r) => r.path));
  if (error) throw new Error(error.message);
}

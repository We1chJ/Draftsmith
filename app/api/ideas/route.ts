import { route, unwrap } from "@/lib/api";
import { IdeaInput } from "@/lib/schemas";
import { db } from "@/lib/supabase/server";

export const GET = route(async (req, userId) => {
  const params = new URL(req.url).searchParams;
  let q = db().from("ideas").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  const search = params.get("q");
  const tag = params.get("tag");
  const status = params.get("status");
  if (search) q = q.ilike("text", `%${search}%`);
  if (tag) q = q.contains("tags", [tag]);
  if (status) q = q.eq("status", status);
  return unwrap(await q);
});

export const POST = route(async (req, userId) => {
  const input = IdeaInput.parse(await req.json());
  return unwrap(await db().from("ideas").insert({ ...input, user_id: userId }).select().single());
});

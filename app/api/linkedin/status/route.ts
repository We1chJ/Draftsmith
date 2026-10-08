import { route, unwrap } from "@/lib/api";
import { db } from "@/lib/supabase/server";

export const GET = route(async (_req, userId) => {
  const { data } = await db()
    .from("linkedin_accounts")
    .select("expires_at,connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { connected: false };
  const msLeft = new Date(data.expires_at).getTime() - Date.now();
  return {
    connected: msLeft > 0,
    expired: msLeft <= 0,
    expires_at: data.expires_at,
    days_left: Math.max(0, Math.floor(msLeft / 86_400_000)),
  };
});

export const DELETE = route(async (_req, userId) => {
  unwrap(await db().from("linkedin_accounts").delete().eq("user_id", userId));
});

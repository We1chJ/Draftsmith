import { timingSafeEqual } from "node:crypto";
import { publishDue } from "@/lib/linkedin";

// Called every 5 minutes by Supabase pg_cron (or Vercel Cron). Not user-authenticated:
// requires the CRON_SECRET as `x-cron-secret` or `Authorization: Bearer`.
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given =
    req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await publishDue());
}

export const GET = handle;
export const POST = handle;

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, requireUserId } from "@/lib/api";
import { authorizeUrl } from "@/lib/linkedin";

// Starts LinkedIn sign-in. `next` is where to come back to afterwards (an in-app path).
export async function GET(req: Request) {
  try {
    await requireUserId();
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.redirect(new URL("/login", req.url));
    throw e;
  }
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return Response.json({ error: "LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are not set" }, { status: 500 });
  }
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/posts";
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(url.origin, state));
  const cookie = { httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", path: "/", maxAge: 600 };
  res.cookies.set("li_state", state, cookie);
  res.cookies.set("li_next", next.startsWith("/") && !next.startsWith("//") ? next : "/posts", cookie);
  return res;
}

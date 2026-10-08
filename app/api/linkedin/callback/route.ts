import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/api";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchMember } from "@/lib/linkedin";
import { db } from "@/lib/supabase/server";

// LinkedIn redirects here after sign-in. Verifies state, stores the encrypted token, returns to the app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const next = jar.get("li_next")?.value ?? "/posts";
  const back = (status: string) => {
    const to = new URL(next, url.origin);
    to.searchParams.set("linkedin", status);
    const res = NextResponse.redirect(to);
    res.cookies.delete("li_state");
    res.cookies.delete("li_next");
    return res;
  };

  if (url.searchParams.get("error")) return back("cancelled");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || state !== jar.get("li_state")?.value) return back("invalid");

  try {
    const userId = await requireUserId();
    const token = await exchangeCode(url.origin, code);
    const member = await fetchMember(token.access_token);
    const { error } = await db()
      .from("linkedin_accounts")
      .upsert(
        {
          user_id: userId,
          author_urn: member.urn,
          access_token_encrypted: encrypt(token.access_token),
          expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return back("connected");
  } catch (e) {
    console.error("LinkedIn connect failed", e);
    return back("failed");
  }
}

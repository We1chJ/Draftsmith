import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// Magic-link landing: exchange the code for a session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/ideas", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}

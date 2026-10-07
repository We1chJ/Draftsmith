import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Auth-only client bound to the request's session cookies.
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

// Data client for the draftsmith schema. Uses the service key, which bypasses RLS,
// so every query must be scoped by user_id. Never import this from client code.
// No generated types for the draftsmith schema yet (the generator only emits public),
// so rows are untyped here and typed at the call sites via lib/types.ts.
export function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any, "draftsmith">(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "draftsmith" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

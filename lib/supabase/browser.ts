import { createBrowserClient } from "@supabase/ssr";

// Used only for the magic-link login. All data goes through /api routes.
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

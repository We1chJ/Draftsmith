import "server-only";
import { ZodError } from "zod";
import { createAuthClient } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUserId(): Promise<string> {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new HttpError(401, "Not signed in");
  return sub;
}

type PgResult<T> = { data: T | null; error: { code?: string; message: string } | null };

// Turns a supabase-js result into data or a typed HTTP error.
export function unwrap<T>({ data, error }: PgResult<T>): NonNullable<T> {
  if (error) {
    if (error.code === "PGRST116") throw new HttpError(404, "Not found");
    if (error.code === "23505") throw new HttpError(409, "Already exists");
    if (error.code === "23514" || error.code === "22P02") throw new HttpError(400, error.message);
    if (error.code === "P0001") throw new HttpError(409, error.message); // raised by triggers
    throw new Error(error.message);
  }
  return data as NonNullable<T>;
}

// Wraps a route handler: JSON response, auth, and error mapping.
export function route<Ctx>(handler: (req: Request, userId: string, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const userId = await requireUserId();
      const result = await handler(req, userId, ctx);
      return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return Response.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Server error" }, { status: 500 });
    }
  };
}

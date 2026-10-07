# Draftsmith

Turns raw ideas into LinkedIn posts in your own voice. Single-user tool, Next.js + Supabase + OpenAI.

## What it does

- **Ideas**: an inbox for anything worth a post.
- **Write**: generates three openings from an idea in your voice, then rewrite and edit. Live character count and a feed preview showing where "see more" cuts.
- **Drafts**: everything you've saved.
- **Voice**: free-text instructions for the writer plus a history of posts you actually published. Both are sent with every generation; the history doubles as the few-shot example set.

Publishing to LinkedIn, scheduling, and the publish log are planned (Phase 2) and not built yet.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

`.env.local` needs:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server-only; bypasses RLS. |
| `OPENAI_API_KEY` | platform.openai.com |
| `OPENAI_MODEL` | Optional, defaults to `gpt-5.5` |

Supabase project settings that must be on:

- Data API → Exposed schemas includes `draftsmith`.
- Authentication → URL Configuration → Redirect URLs includes `http://localhost:3000/**`.
- Authentication → Sign In / Providers → "Allow new users to sign up" off (single user).

## Database

All tables live in the `draftsmith` Postgres schema (migrations in `supabase/migrations/`). The schema is not granted to the browser-facing roles; only the server's service key can read it, and every query is scoped by `user_id`. Sign-in is a Supabase magic link.

## Layout

```
app/(app)/        pages: ideas, write, posts (drafts), voice
app/api/          JSON routes; all require a session
app/auth/         magic-link callback and sign-out
lib/writer.ts     prompt assembly and the OpenAI call
lib/data.ts       voice loading (instructions + newest 10 past posts)
proxy.ts          refreshes the session cookie, redirects signed-out visits to /login
components/       logo, icons, motion helpers, nav, preview
```

## Scripts

- `npm run dev` – local server on :3000
- `npm run build` – production build
- `npm run lint`

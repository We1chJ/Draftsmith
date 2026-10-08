# Draftsmith

Turns raw ideas into LinkedIn posts in your own voice. Single-user tool, Next.js + Supabase + OpenAI.

## What it does

- **Ideas**: an inbox for anything worth a post.
- **Write**: generates three openings from an idea in your voice, then rewrite and edit. Live character count, up to 20 photos per draft (JPG/PNG/GIF, stored privately in Supabase Storage), a feed preview showing where "see more" cuts and how the photos lay out, and a collapsible table of LinkedIn's limits (`lib/platforms.ts`).
- **Drafts**: work in progress.
- **Published**: every post you've put on LinkedIn, including ones from before this app, added by hand (title, text, date). Read-only tiles that open in a pop-up; the database refuses any change to a published post. Later, posts the app publishes land here automatically.
- **Voice**: your own instructions for the writer, plus "what the writer has noticed": a model-written description of your style across all published posts. It refreshes 30 s after you change Published, or right before a generation if it's gone stale.

Every generation prompt = your instructions → the observed-style summary → your 10 newest published posts verbatim → the idea. Instructions take priority if anything conflicts.

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
| `OPENAI_MODEL` | Optional, defaults to `gpt-4.1-mini` |

Supabase project settings that must be on:

- Data API → Exposed schemas includes `draftsmith`.
- Authentication → URL Configuration → Redirect URLs includes `http://localhost:3000/**`.
- Authentication → Sign In / Providers → "Allow new users to sign up" off (single user).

## Database

All tables live in the `draftsmith` Postgres schema (migrations in `supabase/migrations/`). Drafts and published history share the `posts` table, told apart by `status`; published posts keep editable text but a frozen status, and anything LinkedIn accepted can't be deleted. The schema is not granted to the browser-facing roles; only the server's service key can read it, and every query is scoped by `user_id`. Sign-in is a Supabase magic link.

## Layout

```
app/(app)/        pages: ideas, write, posts (drafts), published, voice
app/api/          JSON routes; all require a session
app/auth/         magic-link callback and sign-out
lib/writer.ts     prompt assembly, the OpenAI calls, and the style summarizer
lib/data.ts       published history and voice loading
lib/voice-summary.ts  refreshes the observed-style summary; staleness check
lib/images.ts     photo upload/list/remove against the draftsmith-images bucket
lib/platforms.ts  LinkedIn limits used for enforcement and the lookup card
proxy.ts          refreshes the session cookie, redirects signed-out visits to /login
components/       logo, icons, motion helpers, nav, preview
```

## Scripts

- `npm run dev` – local server on :3000
- `npm run build` – production build
- `npm run lint`

# Draftsmith

Turns raw ideas into LinkedIn posts in your own voice. Single-user tool, Next.js + Supabase + OpenAI.

## What it does

- **Ideas**: an inbox for anything worth a post.
- **Write**: generates three openings from an idea in your voice, then rewrite and edit. Live character count, up to 20 photos per draft (JPG/PNG/GIF, stored privately in Supabase Storage), a feed preview showing where "see more" cuts and how the photos lay out, and a collapsible table of LinkedIn's limits (`lib/platforms.ts`).
- **Drafts**: work in progress.
- **Published**: every post you've put on LinkedIn, including ones from before this app, added by hand (title, text, date). Read-only tiles that open in a pop-up; the database refuses any change to a published post. Later, posts the app publishes land here automatically.
- **Voice**: your own instructions for the writer, plus "what the writer has noticed": a model-written description of your style across all published posts. It refreshes 30 s after you change Published, or right before a generation if it's gone stale.

Every generation prompt = your instructions → the observed-style summary → your 10 newest published posts verbatim → the idea. Instructions take priority if anything conflicts.

**Posting to LinkedIn**: from a draft, "Post now" (with a confirm step) or pick a time and "Schedule". Text and photos both go out; photos are uploaded to LinkedIn's Images API first (1 photo = single image, 2–20 = gallery). Scheduled posts are sent by `/api/cron/publish`, which a scheduler must call every few minutes with the `CRON_SECRET`. Every attempt is written to `publish_log`; a post LinkedIn accepted is never retried, and one stuck "publishing" for 15 minutes is flagged for a manual check instead of retried. LinkedIn tokens last 60 days and are stored AES-256-GCM encrypted; the Drafts page warns 7 days before expiry.

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
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64. Encrypts LinkedIn tokens. |
| `CRON_SECRET` | Random string; the scheduler sends it to `/api/cron/publish` |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn developer app → Auth tab |

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
lib/linkedin.ts   OAuth, image upload, post creation, publish-now and the due-post sweep
lib/crypto.ts     AES-256-GCM for tokens at rest
proxy.ts          refreshes the session cookie, redirects signed-out visits to /login
components/       logo, icons, motion helpers, nav, preview
```

## Scripts

- `npm run dev` – local server on :3000
- `npm run build` – production build
- `npm run lint`

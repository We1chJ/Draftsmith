<div align="center">
  <img src="app/icon.svg" alt="Draftsmith logo" width="88" height="88" />
  <h1>Draftsmith</h1>
  <p><strong>Turn rough ideas into LinkedIn posts that sound like you.</strong></p>
  <p>
    <a href="https://draftsmithai.vercel.app">draftsmithai.vercel.app</a>
    ·
    Next.js · Supabase · OpenAI · LinkedIn API
  </p>
</div>

---

Draftsmith is a single-user writing tool. You drop in a thought, it drafts a post in your voice, you polish it, and you post it to LinkedIn now or on a schedule. It learns your voice from the posts you've already published.

## How it works

| Page | What it's for |
| --- | --- |
| **Ideas** | Jot down a thought, long or short. A draft is written in the background and lands in Drafts. |
| **Drafts** | Everything in progress, with its status (draft, scheduled, failed) and LinkedIn connection status. |
| **Editor** | Edit the text yourself or tell the AI what to change (each edit can be undone). Attach up to 20 photos, then **Post now** or **Schedule**. |
| **Published** | Every post you've put on LinkedIn, including ones from before Draftsmith. Read-only. |
| **Voice** | Your standing instructions for the writer, plus a summary of your style the AI builds from your published posts. |

Every draft is written from: your instructions → the style summary → your 10 newest published posts → the idea. Your instructions win if anything conflicts.

### Posting to LinkedIn

- **Post now** asks for confirmation, then sends the text and photos (1 photo = single image, 2–20 = gallery).
- **Schedule** queues the post; `/api/cron/publish` sends it when it's due.
- Every attempt is logged. A post LinkedIn accepted is never retried, and one stuck "publishing" for 15 minutes is flagged for you to check rather than retried.
- LinkedIn tokens last 60 days and are stored encrypted (AES-256-GCM). The Drafts page warns you 7 days before they expire.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server-only. |
| `OPENAI_API_KEY` | platform.openai.com |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-4.1-mini`. |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CRON_SECRET` | Any long random string |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn developer app → Auth tab |

### Supabase

Apply the migrations in `supabase/migrations/`, then in the dashboard:

- **Data API → Exposed schemas**: add `draftsmith`.
- **Authentication → URL Configuration**: add `http://localhost:3000/**` (and your production `/auth/callback`) to Redirect URLs.
- **Authentication → Sign In / Providers**: turn off new sign-ups (it's a single-user app).

### LinkedIn

Create an app at [linkedin.com/developers](https://www.linkedin.com/developers/apps), add the **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** products, and add your callback to **Authorized redirect URLs**:

```
http://localhost:3000/api/linkedin/callback
https://<your-domain>/api/linkedin/callback
```

## Deploying

Draftsmith runs on Vercel. Import the repo, add the environment variables above, and add your production domain to the Supabase and LinkedIn redirect lists. Pushes to `main` deploy automatically.

Scheduled posts need something to call the publish endpoint every few minutes:

```bash
curl -X POST https://<your-domain>/api/cron/publish -H "Authorization: Bearer $CRON_SECRET"
```

Supabase `pg_cron` or any external scheduler works. **Post now** doesn't depend on it.

## Project layout

```
app/(app)/          pages: ideas, posts (drafts), write (editor), published, voice
app/api/            JSON routes, all behind a session (except the cron route, which uses CRON_SECRET)
app/auth/           magic-link callback and sign-out
lib/writer.ts       prompt assembly, OpenAI calls, style summary
lib/drafting.ts     background drafting for new ideas
lib/linkedin.ts     OAuth, image upload, posting, and the scheduled-post sweep
lib/crypto.ts       token encryption at rest
components/         UI building blocks (nav, publish panel, photo strip, …)
supabase/migrations database schema
```

All data lives in the `draftsmith` Postgres schema. Only the server's service key can read it, and every query is scoped to the signed-in user. Sign-in is a Supabase magic link.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Local server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

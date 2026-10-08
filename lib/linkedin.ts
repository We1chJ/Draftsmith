import "server-only";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/supabase/server";

// LinkedIn Posts API as the member's own profile (self-serve "Share on LinkedIn" + OpenID Connect).
// Docs: learn.microsoft.com/linkedin/marketing/community-management/shares/{posts-api,images-api,multiimage-post-api}

/** YYYYMM. LinkedIn retires versions about a year after release (a retired version returns 426). Bump yearly. */
export const LINKEDIN_VERSION = "202609";
export const SCOPES = "openid profile w_member_social";

const API = "https://api.linkedin.com";
const IMAGE_PROCESSING_WAIT_MS = 4000;
const MAX_RATE_LIMIT_RETRIES = 3;
/** A post left in "publishing" this long may or may not be live; a person has to check. */
export const STUCK_PUBLISHING_MS = 15 * 60_000;

export const redirectUri = (origin: string) => `${origin}/api/linkedin/callback`;

export function authorizeUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    state,
    scope: SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function exchangeCode(origin: string, code: string) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function fetchMember(token: string) {
  const res = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`LinkedIn userinfo failed (${res.status})`);
  const u = (await res.json()) as { sub: string; name?: string };
  return { urn: `urn:li:person:${u.sub}`, name: u.name ?? null };
}

// Commentary uses LinkedIn's "little" text format: reserved characters must be backslash-escaped.
// '#' before a word is left alone so hashtags still link.
export function escapeLittle(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`).replace(/#(?!\w)/g, "\\#");
}

function headers(token: string, json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

class LinkedInError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function uploadImage(token: string, owner: string, bytes: ArrayBuffer, mime: string): Promise<string> {
  const init = await fetch(`${API}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!init.ok) throw new LinkedInError(init.status, `Image upload setup failed: ${await init.text()}`);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    body: bytes,
  });
  if (!put.ok) throw new LinkedInError(put.status, `Image upload failed: ${await put.text()}`);
  return value.image;
}

type Image = { path: string; mime: string; alt: string | null };

async function createPost(token: string, author: string, text: string, images: { urn: string; alt: string | null }[]) {
  const content =
    images.length === 1
      ? { media: { id: images[0].urn, ...(images[0].alt ? { altText: images[0].alt } : {}) } }
      : images.length > 1
        ? { multiImage: { images: images.map((i) => ({ id: i.urn, ...(i.alt ? { altText: i.alt } : {}) })) } }
        : undefined;
  const res = await fetch(`${API}/rest/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author,
      commentary: escapeLittle(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (res.status !== 201) throw new LinkedInError(res.status, await res.text());
  const id = res.headers.get("x-restli-id");
  if (!id) throw new LinkedInError(res.status, "LinkedIn accepted the post but returned no post ID.");
  return id;
}

async function log(userId: string, postId: string, outcome: "success" | "failed" | "retrying", http: number | null, msg: string | null) {
  await db().from("publish_log").insert({ user_id: userId, post_id: postId, outcome, http_status: http, error_message: msg });
}

type Claimed = { id: string; user_id: string; text: string };

// Sends one post that is already claimed (status = publishing). Never retries once LinkedIn accepts.
async function send(post: Claimed): Promise<{ ok: true; linkedinId: string } | { ok: false; error: string }> {
  const fail = async (status: number | null, message: string, retry = false) => {
    if (retry) {
      const { count } = await db()
        .from("publish_log")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id)
        .eq("outcome", "retrying");
      if ((count ?? 0) < MAX_RATE_LIMIT_RETRIES) {
        const next = new Date(Date.now() + 5 * 60_000 * ((count ?? 0) + 1)).toISOString();
        await db()
          .from("posts")
          .update({ status: "scheduled", scheduled_at: next, locked_at: null, error: message })
          .eq("id", post.id);
        await log(post.user_id, post.id, "retrying", status, message);
        return { ok: false as const, error: `${message} Retrying at ${next}.` };
      }
    }
    await db().from("posts").update({ status: "failed", locked_at: null, error: message }).eq("id", post.id);
    await log(post.user_id, post.id, "failed", status, message);
    return { ok: false as const, error: message };
  };

  const { data: account } = await db()
    .from("linkedin_accounts")
    .select("author_urn,access_token_encrypted,expires_at")
    .eq("user_id", post.user_id)
    .maybeSingle();
  if (!account) return fail(null, "LinkedIn isn't connected. Connect it on the Drafts page.");
  if (new Date(account.expires_at).getTime() <= Date.now()) {
    return fail(401, "Your LinkedIn connection expired. Reconnect it on the Drafts page.");
  }
  if (!post.text.trim()) return fail(null, "The post is empty.");
  const token = decrypt(account.access_token_encrypted);

  let linkedinId: string;
  try {
    const { data: imgs } = await db()
      .from("post_images")
      .select("path,mime,alt")
      .eq("post_id", post.id)
      .order("position");
    const uploaded: { urn: string; alt: string | null }[] = [];
    for (const img of (imgs ?? []) as Image[]) {
      const { data: file, error } = await db().storage.from("draftsmith-images").download(img.path);
      if (error || !file) throw new LinkedInError(0, `Couldn't read a photo from storage: ${error?.message}`);
      uploaded.push({ urn: await uploadImage(token, account.author_urn, await file.arrayBuffer(), img.mime), alt: img.alt });
    }
    // The images API has no synchronous mode and w_member_social can't poll status; give processing a moment.
    if (uploaded.length) await new Promise((r) => setTimeout(r, IMAGE_PROCESSING_WAIT_MS));
    linkedinId = await createPost(token, account.author_urn, post.text, uploaded);
  } catch (e) {
    const status = e instanceof LinkedInError ? e.status : null;
    const detail = (e as Error).message.slice(0, 500);
    if (status === 401) return fail(401, "LinkedIn rejected the connection. Reconnect it on the Drafts page.");
    if (status === 426) return fail(426, `LinkedIn API version ${LINKEDIN_VERSION} is retired; update LINKEDIN_VERSION.`);
    if (status === 429) return fail(429, "LinkedIn rate limit hit.", true);
    if (status && status >= 500) {
      // A 5xx can arrive after the post went live, so don't auto-retry (N1).
      return fail(status, `LinkedIn had a server error. Check your profile before trying again. ${detail}`);
    }
    return fail(status, `LinkedIn refused the post: ${detail}`);
  }

  // LinkedIn accepted it: record it. Never retry from here, even if saving fails.
  const firstLine = post.text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const { error } = await db()
    .from("posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      linkedin_post_id: linkedinId,
      locked_at: null,
      error: null,
      title: firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || "Untitled",
    })
    .eq("id", post.id);
  await log(post.user_id, post.id, "success", 201, error ? `Live on LinkedIn but not saved: ${error.message}` : null);
  return { ok: true, linkedinId };
}

// Publish one draft right now, for its owner.
export async function publishNow(userId: string, postId: string) {
  const { data } = await db()
    .from("posts")
    .update({ status: "publishing", locked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", postId)
    .in("status", ["draft", "failed", "scheduled"])
    .select("id,user_id,text");
  const claimed = (data ?? [])[0] as Claimed | undefined;
  if (!claimed) return { ok: false as const, error: "This post is already being published, or isn't a draft." };
  return send(claimed);
}

// Cron entry point: claim every due scheduled post atomically, send each, flag stuck ones.
export async function publishDue() {
  const now = new Date().toISOString();
  const { data: claimed } = await db()
    .from("posts")
    .update({ status: "publishing", locked_at: now })
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .select("id,user_id,text");

  const results = [];
  for (const post of (claimed ?? []) as Claimed[]) results.push({ id: post.id, ...(await send(post)) });

  const stuckBefore = new Date(Date.now() - STUCK_PUBLISHING_MS).toISOString();
  const { data: stuck } = await db()
    .from("posts")
    .update({
      status: "failed",
      locked_at: null,
      error: "Stopped while publishing. Check your LinkedIn profile before trying again; it may already be live.",
    })
    .eq("status", "publishing")
    .lt("locked_at", stuckBefore)
    .select("id");

  return { sent: results, flaggedStuck: (stuck ?? []).map((s) => s.id) };
}

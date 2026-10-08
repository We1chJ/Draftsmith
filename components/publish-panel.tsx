"use client";

import { useState } from "react";
import { connectHref, useLinkedIn } from "@/components/linkedin-connection";
import { ArrowRight, Check, Send } from "@/components/icons";
import { Swap } from "@/components/motion";
import { api } from "@/lib/client";
import type { Post } from "@/lib/types";

type PostState = Pick<Post, "id" | "status" | "error"> & { scheduled_at?: string | null; linkedin_post_id?: string | null };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

// Post now or schedule. `beforeSend` saves unsaved edits first; `onChange` reports the new state.
export function PublishPanel({
  post,
  canSend,
  beforeSend,
  onChange,
}: {
  post: PostState;
  canSend: boolean;
  beforeSend: () => Promise<void>;
  onChange: (next: Partial<PostState>) => void;
}) {
  const linkedin = useLinkedIn();
  const [when, setWhen] = useState(toLocalInput(nextHour()));
  const [busy, setBusy] = useState<"" | "now" | "schedule" | "unschedule">("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function act(kind: typeof busy, fn: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      setConfirming(false);
    }
  }

  const postNow = () =>
    act("now", async () => {
      await beforeSend();
      onChange({ status: "publishing" });
      try {
        const res = await api<{ linkedinId: string }>(`/api/posts/${post.id}/publish-now`, { method: "POST" });
        onChange({ status: "published", linkedin_post_id: res.linkedinId, error: null });
      } catch (e) {
        onChange({ status: "failed", error: (e as Error).message });
        throw e;
      }
    });

  const schedule = () =>
    act("schedule", async () => {
      await beforeSend();
      const res = await api<{ scheduled_at: string }>(`/api/posts/${post.id}/schedule`, {
        body: { scheduled_at: new Date(when).toISOString() },
      });
      onChange({ status: "scheduled", scheduled_at: res.scheduled_at, error: null });
    });

  const unschedule = () =>
    act("unschedule", async () => {
      await api(`/api/posts/${post.id}/unschedule`, { method: "POST" });
      onChange({ status: "draft", scheduled_at: null });
    });

  return (
    <div className="card space-y-3">
      <span className="label mb-0">Post to LinkedIn</span>

      {post.status === "published" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[14px] text-mint-ink">
            <Check size={16} /> Posted to LinkedIn.
          </p>
          <div className="flex flex-wrap gap-2">
            {post.linkedin_post_id && (
              <a
                className="btn"
                href={`https://www.linkedin.com/feed/update/${post.linkedin_post_id}/`}
                target="_blank"
                rel="noreferrer"
              >
                View on LinkedIn <ArrowRight size={15} />
              </a>
            )}
            <a className="btn-ghost" href="/published">
              See it in Published
            </a>
          </div>
        </div>
      ) : post.status === "publishing" ? (
        <p className="flex items-center gap-2 text-[14px] text-ink-soft">
          <span className="spinner" /> Posting to LinkedIn… photos are uploaded first, this can take a few seconds.
        </p>
      ) : post.status === "scheduled" && post.scheduled_at ? (
        <div className="space-y-3">
          <p className="rounded-[10px] bg-sky-soft px-3 py-2.5 text-[14px] text-sky-ink">
            Scheduled for <span className="font-semibold">{fmt(post.scheduled_at)}</span>
          </p>
          <button className="btn w-full" disabled={!!busy} onClick={unschedule}>
            {busy === "unschedule" && <span className="spinner" />} Unschedule to edit
          </button>
        </div>
      ) : linkedin && !linkedin.connected ? (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-soft">
            {linkedin.expired ? "Your LinkedIn connection expired." : "Connect LinkedIn to post or schedule this draft."}
          </p>
          <a href={connectHref(`/write?post=${post.id}`)} className="btn-primary w-full">
            {linkedin.expired ? "Reconnect LinkedIn" : "Connect LinkedIn"}
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {post.status === "failed" && post.error && (
            <p className="rounded-[10px] bg-coral-soft px-3 py-2 text-[13px] text-coral-ink">Last attempt failed: {post.error}</p>
          )}
          {confirming ? (
            <div className="space-y-2 rounded-[10px] border border-line-strong p-3">
              <p className="text-[14px] font-medium">Post this to LinkedIn now?</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-ghost" disabled={!!busy} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={!!busy} onClick={postNow}>
                  {busy === "now" ? <span className="spinner" /> : <Send size={15} />}
                  <Swap id={busy === "now" ? "posting" : "yes"}>{busy === "now" ? "Posting" : "Yes, post it"}</Swap>
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-primary w-full"
              disabled={!canSend || !!busy || !linkedin}
              onClick={() => setConfirming(true)}
            >
              <Send size={15} /> Post now
            </button>
          )}
          <div className="space-y-2 border-t border-line pt-3">
            <label htmlFor="schedule-at" className="label mb-0">
              Or schedule it
            </label>
            <input
              id="schedule-at"
              type="datetime-local"
              className="input"
              value={when}
              min={toLocalInput(new Date())}
              onChange={(e) => setWhen(e.target.value)}
            />
            <button className="btn w-full" disabled={!canSend || !!busy || !when || !linkedin} onClick={schedule}>
              {busy === "schedule" && <span className="spinner" />} Schedule
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

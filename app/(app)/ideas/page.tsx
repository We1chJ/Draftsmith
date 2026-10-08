"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { ArrowRight, Check, Sparkles, X } from "@/components/icons";
import { AnimatePresence, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { IdeaDraft, IdeaWithDrafts } from "@/lib/types";

const POLL_MS = 3000;
// A draft still "generating" after this long was interrupted (e.g. a server restart).
const STUCK_MS = 2 * 60_000;
const isStuck = (d: IdeaDraft) => d.generating && Date.now() - new Date(d.updated_at).getTime() > STUCK_MS;

type Ready = { postId: string; snippet: string };

const latestDraft = (i: IdeaWithDrafts) =>
  [...i.posts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] as IdeaDraft | undefined;

// Ideas exist only until their draft is written; then they're removed and the draft lives in Drafts.
export default function IdeasPage() {
  const [ideas, setIdeas] = useState<IdeaWithDrafts[] | null>(null);
  const [ready, setReady] = useState<Ready[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const prev = useRef<IdeaWithDrafts[]>([]);

  const load = useCallback(async () => {
    try {
      const next = await api<IdeaWithDrafts[]>("/api/ideas");
      // Ideas that were drafting and are now gone have finished: announce their drafts.
      const stillHere = new Set(next.map((i) => i.id));
      const finished = prev.current
        .filter((i) => !stillHere.has(i.id))
        .map((i) => ({ i, d: latestDraft(i) }))
        .filter(({ d }) => d?.generating)
        .map(({ i, d }) => ({ postId: d!.id, snippet: i.text.slice(0, 80) }));
      if (finished.length) setReady((r) => [...finished, ...r]);
      prev.current = next;
      setIdeas(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Drafts are written in the background; check back until none are pending.
  const anyGenerating = ideas?.some((i) => i.posts.some((p) => p.generating && !isStuck(p))) ?? false;
  useEffect(() => {
    if (!anyGenerating) return;
    const t = setInterval(load, POLL_MS);
    // Browsers slow timers in background tabs; catch up the moment the tab is visible again.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [anyGenerating, load]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || saving) return;
    setError("");
    setSaving(true);
    try {
      const created = await api<IdeaWithDrafts>("/api/ideas", { body: { text } });
      setIdeas((list) => {
        const next = [created, ...(list ?? [])];
        prev.current = next;
        return next;
      });
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function retry(postId: string) {
    await api(`/api/posts/${postId}/redraft`, { method: "POST" });
    load();
  }

  async function remove(id: string) {
    setIdeas((list) => list?.filter((i) => i.id !== id) ?? null);
    prev.current = prev.current.filter((i) => i.id !== id);
    await api(`/api/ideas/${id}`, { method: "DELETE" });
  }

  return (
    <>
      <PageHeader
        mark="Ideas"
        subtitle="Drop in a thought, long or short. It's drafted in your voice in the background and lands in Drafts."
      />

      <form onSubmit={submit} className="card mb-6 space-y-3">
        <label htmlFor="idea" className="label">
          New idea
        </label>
        <textarea
          id="idea"
          required
          rows={6}
          className="input resize-y leading-[1.55]"
          placeholder="A thought, a story, a lesson, a rough paragraph…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-ink-faint">⌘ + Enter to submit</span>
          <button className="btn-primary" disabled={saving || !text.trim()}>
            {saving ? <span className="spinner" /> : <Sparkles size={16} />}
            <Swap id={saving ? "saving" : "idle"}>{saving ? "Saving" : "Save and draft"}</Swap>
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
      </form>

      {/* Finished drafts from this visit */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ready.map((r) => (
            <motion.div
              key={r.postId}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
              transition={soft}
              className="flex items-center gap-3 rounded-card border border-mint/40 bg-mint-soft px-4 py-3"
            >
              <Check size={18} className="shrink-0 text-mint-ink" />
              <span className="min-w-0 flex-1 truncate text-[14px] text-mint-ink">
                Draft ready: <span className="text-ink">{r.snippet}</span>
              </span>
              <Link href={`/write?post=${r.postId}`} className="btn min-h-9 shrink-0">
                Open <ArrowRight size={15} />
              </Link>
              <button
                aria-label="Dismiss"
                className="btn-ghost min-h-9 shrink-0 px-2"
                onClick={() => setReady((list) => list.filter((x) => x.postId !== r.postId))}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Ideas still being drafted, or that failed */}
      {ideas && ideas.length > 0 && <h2 className="mt-8 mb-3 text-[20px] leading-none font-semibold">In progress</h2>}
      <div className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {ideas?.map((idea) => {
            const draft = latestDraft(idea);
            const failed = !draft || (draft.error && !draft.text) || isStuck(draft);
            return (
              <motion.article
                key={idea.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
                transition={soft}
                className="card flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5"
              >
                <p className="line-clamp-2 min-w-0 flex-1 basis-80 text-[14px] leading-[1.5] whitespace-pre-wrap">
                  {idea.text}
                </p>
                {failed ? (
                  <span className="inline-flex items-center gap-2 text-[13px] text-danger">
                    Couldn&apos;t draft this.
                    {draft && (
                      <button className="font-medium underline underline-offset-2" onClick={() => retry(draft.id)}>
                        Try again
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-[13px] text-(--accent-ink)">
                    <span className="spinner" /> Drafting…
                  </span>
                )}
                {failed && <ConfirmButton label="Discard" onConfirm={() => remove(idea.id)} />}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

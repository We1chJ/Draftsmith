"use client";

import { useEffect, useRef, useState } from "react";
import { CardSkeletons } from "@/components/card-skeletons";
import { ConfirmButton } from "@/components/confirm-button";
import { Pen, Plus, X } from "@/components/icons";
import { AnimatePresence, Rise, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { Post } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

type CardForm = { title: string; text: string; published_on: string };
const EMPTY_CARD: CardForm = { title: "", text: "", published_on: "" };

// The voice summary re-reads all published posts this long after the last change.
const SUMMARY_REFRESH_DELAY_MS = 30_000;

const fmtDate = (iso: string | null, long = false) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        year: "numeric",
        month: long ? "long" : "short",
        day: "numeric",
      })
    : null;

export default function PublishedPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [open, setOpen] = useState<"new" | string | null>(null);
  const [card, setCard] = useState<CardForm>(EMPTY_CARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<Post[]>("/api/published")
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced: a burst of changes triggers one summary refresh. Generation also refreshes
  // on its own if this never fires (e.g. the tab is closed first).
  function scheduleSummaryRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      api("/api/voice/refresh", { method: "POST" }).catch(() => {});
    }, SUMMARY_REFRESH_DELAY_MS);
  }

  function openNew() {
    setError("");
    setCard(EMPTY_CARD);
    setOpen("new");
  }

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    if (!posts) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<Post>("/api/published", {
        body: { title: card.title, text: card.text, published_on: card.published_on || null },
      });
      setPosts([created, ...posts]);
      setOpen(null);
      scheduleSummaryRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePost(id: string) {
    if (!posts) return;
    const prev = posts;
    setPosts(posts.filter((p) => p.id !== id));
    setOpen(null);
    try {
      await api(`/api/published/${id}`, { method: "DELETE" });
      scheduleSummaryRefresh();
    } catch (e) {
      setPosts(prev);
      setError((e as Error).message);
    }
  }

  const sorted = posts
    ? [...posts].sort(
        (a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "") || b.created_at.localeCompare(a.created_at),
      )
    : [];
  const viewing = open && open !== "new" ? sorted.find((p) => p.id === open) : null;

  return (
    <>
      <PageHeader
        mark="Published"
        subtitle="Every post you've put on LinkedIn, including ones from before this app. Read-only; the writer learns your voice from these."
      >
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Add a post
        </button>
      </PageHeader>

      {posts === null && !error && (
        <CardSkeletons
          count={6}
          label="Loading published posts"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        />
      )}
      {error && !open && (
        <p role="alert" className="mb-4 rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
          {error}
        </p>
      )}

      {posts && posts.length === 0 && (
        <Rise className="card mx-auto flex max-w-xl flex-col items-center gap-3 border-dashed p-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft) text-(--accent-ink)">
            <Pen size={18} />
          </span>
          <div>
            <p className="font-display text-[20px] font-semibold">Nothing here yet</p>
            <p className="mt-1 text-[14px] text-ink-soft">
              Paste three to five posts you were happy with. That&apos;s the fastest way to get your voice right.
            </p>
          </div>
          <button className="btn-accent" onClick={openNew}>
            <Plus size={16} /> Add a post
          </button>
        </Rise>
      )}

      {/* Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {sorted.map((p, i) => (
            <motion.button
              key={p.id}
              layoutId={`tile-${p.id}`}
              type="button"
              onClick={() => setOpen(p.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
              transition={{ ...soft, delay: Math.min(i, 8) * 0.03 }}
              whileHover={{ y: -2 }}
              className="card card-hover flex cursor-pointer flex-col text-left"
            >
              <h3 className="text-[16px] leading-snug font-semibold">{p.title ?? "Untitled"}</h3>
              <p className="mt-2 line-clamp-5 text-[13.5px] leading-[1.55] whitespace-pre-wrap text-ink-soft">{p.text}</p>
              <div className="mt-auto flex items-center gap-2 pt-4 text-[12px] text-ink-faint">
                {fmtDate(p.published_at) && <span className="chip">{fmtDate(p.published_at)}</span>}
                <span className="tabular-nums">{p.text.length.toLocaleString()} chars</span>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Pop-up: read a post, or add one */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={() => setOpen(null)}
          >
            {viewing ? (
              <motion.article
                layoutId={`tile-${viewing.id}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="post-title"
                className="card relative my-6 w-full max-w-2xl p-7 shadow-[0_24px_60px_-20px_rgba(30,27,24,0.35)] sm:my-0"
                transition={soft}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  aria-label="Close"
                  className="btn-ghost absolute top-3 right-3 min-h-9 px-2"
                  onClick={() => setOpen(null)}
                >
                  <X size={18} />
                </button>
                <div className="mb-4 flex flex-wrap items-center gap-2 pr-10 text-[12px] text-ink-faint">
                  {fmtDate(viewing.published_at, true) && <span className="chip">{fmtDate(viewing.published_at, true)}</span>}
                  <span className="tabular-nums">{viewing.text.length.toLocaleString()} characters</span>
                  <span>{viewing.origin === "imported" ? "added by hand" : "published from Draftsmith"}</span>
                </div>
                <h2 id="post-title" className="text-[24px] leading-tight font-semibold">
                  {viewing.title ?? "Untitled"}
                </h2>
                <p className="mt-4 text-[15.5px] leading-[1.65] whitespace-pre-wrap">{viewing.text}</p>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-[12px] text-ink-faint">Published posts can&apos;t be edited.</span>
                  <ConfirmButton label="Remove from history" onConfirm={() => removePost(viewing.id)} />
                </div>
              </motion.article>
            ) : (
              <motion.form
                key="new"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-title"
                onSubmit={addPost}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
                transition={soft}
                className="card relative my-6 w-full max-w-2xl space-y-4 p-7 shadow-[0_24px_60px_-20px_rgba(30,27,24,0.35)] sm:my-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="Close"
                  className="btn-ghost absolute top-3 right-3 min-h-9 px-2"
                  onClick={() => setOpen(null)}
                >
                  <X size={18} />
                </button>
                <h2 id="new-title" className="pr-10 text-[22px] leading-tight font-semibold">
                  Add a published post
                </h2>
                <p className="-mt-2 text-[13px] text-ink-soft">
                  Paste it exactly as you posted it. Once added it can&apos;t be edited, only removed.
                </p>
                <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                  <div>
                    <label htmlFor="title" className="label">
                      Title
                    </label>
                    <input
                      id="title"
                      required
                      autoFocus
                      className="input"
                      placeholder="A short label you'll recognize"
                      value={card.title}
                      onChange={(e) => setCard({ ...card, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="published_on" className="label">
                      Date posted <span className="font-normal text-ink-faint">(optional)</span>
                    </label>
                    <input
                      id="published_on"
                      type="date"
                      className="input"
                      value={card.published_on}
                      onChange={(e) => setCard({ ...card, published_on: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="text" className="label">
                    The post
                  </label>
                  <textarea
                    id="text"
                    required
                    rows={10}
                    maxLength={POST_MAX_CHARS}
                    className="input resize-y text-[14px] leading-[1.55]"
                    value={card.text}
                    onChange={(e) => setCard({ ...card, text: e.target.value })}
                  />
                  <div className="mt-1 text-right text-[12px] text-ink-faint tabular-nums">
                    {card.text.length.toLocaleString()} / {POST_MAX_CHARS.toLocaleString()}
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-[14px] text-danger">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button className="btn-primary" disabled={busy}>
                    {busy && <span className="spinner" />}
                    <Swap id={busy ? "busy" : "idle"}>{busy ? "Adding" : "Add to published"}</Swap>
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>
                    Cancel
                  </button>
                </div>
              </motion.form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

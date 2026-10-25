"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, X } from "@/components/icons";
import { AnimatePresence, motion, soft } from "@/components/motion";
import { LINKEDIN } from "@/lib/platforms";

// Openverse: openly licensed images, no API key. Searched from the browser so the anonymous
// limits (about 20 searches a minute) are the user's own. Only public-domain / CC0 results,
// which can be posted without credit.
const OPENVERSE = "https://api.openverse.org/v1/images/";
const PAGE_SIZE = 20;

export type FoundPhoto = { id: string; title: string; url: string; thumbnail: string };

type OpenverseResult = FoundPhoto & { width: number | null; height: number | null; filesize: number | null };

// Skips anything LinkedIn (or our upload cap) would reject.
const fits = (r: OpenverseResult) =>
  (!r.filesize || r.filesize <= LINKEDIN.imageMaxBytes) &&
  (!r.width || !r.height || r.width * r.height <= LINKEDIN.imageMaxPixels);

async function searchOpenverse(q: string, page: number): Promise<{ photos: FoundPhoto[]; more: boolean }> {
  const params = new URLSearchParams({
    q,
    page: String(page),
    page_size: String(PAGE_SIZE),
    license: "cc0,pdm",
    extension: "jpg,png,gif",
    mature: "false",
  });
  const res = await fetch(`${OPENVERSE}?${params}`);
  if (res.status === 429) throw new Error("Too many searches in a short time. Wait a minute and try again.");
  if (!res.ok) throw new Error("The photo search isn't responding. Try again in a moment.");
  const data = (await res.json()) as { results: OpenverseResult[]; page_count: number };
  return {
    photos: data.results.filter(fits).map(({ id, title, url, thumbnail }) => ({ id, title, url, thumbnail })),
    more: page < data.page_count,
  };
}

// Search panel: type, click photos to attach them to the draft. Stays open for several picks.
export function PhotoSearch({
  open,
  onClose,
  onPick,
  remaining,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (photo: FoundPhoto) => Promise<void>;
  remaining: number;
}) {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [photos, setPhotos] = useState<FoundPhoto[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attaching, setAttaching] = useState<Set<string>>(new Set());
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // "Attached" marks only make sense for this visit; a photo removed later can be picked again.
  function close() {
    setAttached(new Set());
    onClose();
  }

  // While open: Escape closes, the page behind doesn't scroll, and the search box has focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAttached(new Set());
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  async function run(q: string, nextPage: number) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await searchOpenverse(q.trim(), nextPage);
      setPhotos((list) => (nextPage === 1 ? res.photos : [...(list ?? []), ...res.photos]));
      setPage(nextPage);
      setMore(res.more);
      setLastQuery(q.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function pick(photo: FoundPhoto) {
    if (attaching.has(photo.id) || attached.has(photo.id) || remaining - attaching.size <= 0) return;
    setError("");
    setAttaching((s) => new Set(s).add(photo.id));
    try {
      await onPick(photo);
      setAttached((s) => new Set(s).add(photo.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAttaching((s) => {
        const next = new Set(s);
        next.delete(photo.id);
        return next;
      });
    }
  }

  const full = remaining - attaching.size <= 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-ink/35 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onClick={close}
        >
          <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-8">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="photo-search-title"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={soft}
              className="card relative w-full max-w-3xl space-y-4 p-5 shadow-[0_24px_60px_-20px_rgba(30,27,24,0.35)] sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" aria-label="Close" className="btn-ghost absolute top-3 right-3 min-h-9 px-2" onClick={close}>
                <X size={18} />
              </button>
              <div className="pr-10">
                <h2 id="photo-search-title" className="text-[22px] leading-tight font-semibold">
                  Find photos
                </h2>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Public-domain photos from Openverse, free to post without credit. Click a photo to attach it.
                </p>
              </div>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(query, 1);
                }}
              >
                <input
                  ref={inputRef}
                  type="search"
                  aria-label="Search photos"
                  className="input"
                  placeholder="e.g. team meeting, city skyline, laptop on desk"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn-primary shrink-0" disabled={!query.trim() || loading}>
                  {loading && page === 1 ? <span className="spinner" /> : <Search size={16} />} Search
                </button>
              </form>

              <div className="flex items-center justify-between text-[12px] text-ink-faint">
                <span>{lastQuery && photos ? `${photos.length} photos for “${lastQuery}”` : " "}</span>
                <span className="tabular-nums">{full ? "This post has the maximum photos" : `Room for ${remaining - attaching.size} more`}</span>
              </div>

              {error && (
                <p role="alert" className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
                  {error}
                </p>
              )}

              {photos?.length === 0 && !loading && (
                <p className="rounded-[10px] border border-dashed border-line p-6 text-center text-[14px] text-ink-soft">
                  Nothing found. Try simpler words, like “office” instead of “modern open-plan office”.
                </p>
              )}

              {photos && photos.length > 0 && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((p) => {
                    const busy = attaching.has(p.id);
                    const done = attached.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={busy || done || full}
                          onClick={() => pick(p)}
                          aria-label={done ? `Attached: ${p.title}` : `Attach: ${p.title}`}
                          className="group relative block w-full cursor-pointer overflow-hidden rounded-[10px] border border-line bg-paper disabled:cursor-default"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.thumbnail}
                            alt=""
                            loading="lazy"
                            className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          />
                          {(busy || done) && (
                            <span className="absolute inset-0 grid place-items-center bg-ink/45 text-paper">
                              {busy ? (
                                <span className="spinner" />
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                                  <Check size={16} /> Attached
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {more && photos && photos.length > 0 && (
                <div className="flex justify-center">
                  <button type="button" className="btn" disabled={loading} onClick={() => run(lastQuery, page + 1)}>
                    {loading && <span className="spinner" />} Load more
                  </button>
                </div>
              )}

              <div className="flex justify-end border-t border-line pt-4">
                <button type="button" className="btn-primary" onClick={close}>
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

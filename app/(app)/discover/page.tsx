"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { CardSkeletons } from "@/components/card-skeletons";
import { ArrowRight, Check, Plus, Sparkles, X } from "@/components/icons";
import { AnimatePresence, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { Discovery } from "@/lib/types";

// The brief is remembered in this browser only; results are never stored.
const BRIEF_KEY = "draftsmith:discover-brief";
const briefListeners = new Set<() => void>();
let memoryBrief = ""; // used when storage is unavailable (e.g. a private window)

function readBrief(): string {
  try {
    return localStorage.getItem(BRIEF_KEY) ?? memoryBrief;
  } catch {
    return memoryBrief;
  }
}

function writeBrief(value: string) {
  memoryBrief = value;
  try {
    localStorage.setItem(BRIEF_KEY, value);
  } catch {}
  briefListeners.forEach((notify) => notify());
}

function subscribeBrief(notify: () => void) {
  briefListeners.add(notify);
  return () => briefListeners.delete(notify);
}

type Card = Discovery & { key: string };

const fmtNewsDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

// The text handed to the normal idea → draft flow when a card is added.
function ideaText(d: Discovery): string {
  return [
    `News${d.news_date ? ` (${d.news_date})` : ""}: ${d.headline}`,
    d.summary,
    `Angle for my post: ${d.angle}`,
    d.sources.length ? `Sources:\n${d.sources.map((s) => `- ${s.url}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// One-off news search: generate, add the ones worth writing about, and the rest disappear when you leave.
export default function DiscoverPage() {
  const brief = useSyncExternalStore(subscribeBrief, readBrief, () => "");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);

  async function generate() {
    if (!brief.trim() || searching) return;
    setSearching(true);
    setError("");
    setAdded(0);
    try {
      const found = await api<Discovery[]>("/api/discover", { body: { brief } });
      setCards(found.map((d, i) => ({ ...d, key: `${Date.now()}-${i}` })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const drop = (key: string) => setCards((list) => list?.filter((c) => c.key !== key) ?? null);

  async function add(card: Card) {
    drop(card.key);
    try {
      await api("/api/ideas", { body: { text: ideaText(card) } });
      setAdded((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
      setCards((list) => (list ? [card, ...list] : [card]));
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        mark="Discover"
        subtitle="Search the latest news in your space and pick what's worth a post. Anything you don't add is gone when you leave."
      />

      <section className="card mx-auto mb-8 max-w-3xl space-y-3">
        <label htmlFor="brief" className="label">
          What to look for
        </label>
        <textarea
          id="brief"
          rows={4}
          className="input resize-y leading-[1.55]"
          placeholder="e.g. AI tools for software teams, developer productivity, startup funding in dev tools. Prefer launches, research results and real numbers. Skip rumors and celebrity news."
          value={brief}
          onChange={(e) => writeBrief(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-ink-faint">
            {searching ? "Searching the latest news. This usually takes a minute or two." : "Your brief is remembered in this browser."}
          </span>
          <button className="btn-primary" disabled={!brief.trim() || searching} onClick={generate}>
            {searching ? <span className="spinner" /> : <Sparkles size={16} />}
            <Swap id={searching ? "busy" : "idle"}>{searching ? "Searching" : "Generate ideas"}</Swap>
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
            {error}
          </p>
        )}
      </section>

      <AnimatePresence>
        {added > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={soft}
            className="mx-auto mb-6 flex max-w-3xl items-center gap-3 rounded-card border border-mint/40 bg-mint-soft px-4 py-3"
            role="status"
          >
            <Check size={18} className="shrink-0 text-mint-ink" />
            <span className="min-w-0 flex-1 text-[14px] text-mint-ink">
              {added === 1 ? "1 idea added." : `${added} ideas added.`} Drafts are being written in your voice now.
            </span>
            <Link href="/posts" className="btn min-h-9 shrink-0">
              Drafts <ArrowRight size={15} />
            </Link>
            <button aria-label="Dismiss" className="btn-ghost min-h-9 shrink-0 px-2" onClick={() => setAdded(0)}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {searching && <CardSkeletons count={4} label="Searching" className="grid gap-4 sm:grid-cols-2" />}

      {!searching && cards?.length === 0 && (
        <div className="card mx-auto flex max-w-xl flex-col items-center gap-3 border-dashed p-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft) text-(--accent-ink)">
            <Sparkles size={18} />
          </span>
          <p className="font-display text-[20px] font-semibold">
            {added > 0 ? "All picked through" : "Nothing came back"}
          </p>
          <p className="text-[14px] text-ink-soft">
            {added > 0 ? "Generate again for a fresh batch." : "Try a broader brief, then generate again."}
          </p>
        </div>
      )}

      {!searching && cards && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {cards.map((c) => (
              <DiscoveryCard key={c.key} d={c} onAdd={() => add(c)} onDismiss={() => drop(c.key)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function DiscoveryCard({ d, onAdd, onDismiss }: { d: Discovery; onAdd: () => void; onDismiss: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
      transition={soft}
      className="card flex min-w-0 flex-col overflow-hidden p-0 [overflow-wrap:anywhere]"
    >
      {d.image_url && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.image_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="aspect-[16/9] w-full border-b border-line bg-paper object-cover"
        />
      ) : (
        <div className="grid aspect-[16/9] w-full place-items-center border-b border-line bg-(--accent-soft) text-(--accent-ink)">
          <Sparkles size={22} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
          {d.news_date && <span className="chip">{fmtNewsDate(d.news_date)}</span>}
          {d.sources[0] && <span>{host(d.sources[0].url)}</span>}
        </div>
        <h3 className="text-[17px] leading-snug font-semibold">{d.headline}</h3>
        <p className="text-[14px] leading-[1.55] text-ink-soft">{d.summary}</p>
        <p className="rounded-[10px] bg-paper px-3 py-2 text-[13.5px] leading-[1.5]">
          <span className="font-medium">Angle: </span>
          {d.angle}
        </p>
        {d.sources.length > 0 && (
          <ul className="space-y-1 text-[13px]">
            {d.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--accent-ink) underline-offset-2 hover:underline"
                >
                  {s.title || host(s.url)}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={16} /> Add to drafts
          </button>
          <button className="btn-ghost ml-auto" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </motion.article>
  );
}

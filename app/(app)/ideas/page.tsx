"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { ArrowRight, Plus, Search } from "@/components/icons";
import { AnimatePresence, Rise, Swap, motion } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { Idea, IdeaStatus } from "@/lib/types";

const STATUSES: IdeaStatus[] = ["new", "drafted", "used", "archived"];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    try {
      setIdeas(await api<Idea[]>(`/api/ideas?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/ideas", { body: { text } });
      setText("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: IdeaStatus) {
    await api(`/api/ideas/${id}`, { method: "PATCH", body: { status } });
    load();
  }

  async function remove(id: string) {
    setIdeas((list) => list?.filter((i) => i.id !== id) ?? null);
    await api(`/api/ideas/${id}`, { method: "DELETE" });
  }

  const filtering = Boolean(filters.q || filters.status);

  return (
    <>
      <PageHeader mark="Ideas" subtitle="Drop in anything worth a post. Shape it later." />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={capture} className="card h-fit space-y-3 lg:sticky lg:top-20">
          <label htmlFor="idea" className="label">
            New idea
          </label>
          <textarea
            id="idea"
            required
            rows={7}
            className="input resize-none"
            placeholder="A thought, a quote, a story, an observation…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim()) capture(e);
            }}
          />
          <button className="btn-primary w-full" disabled={saving || !text.trim()}>
            {saving ? <span className="spinner" /> : <Plus size={16} />}
            <Swap id={saving ? "saving" : "idle"}>{saving ? "Saving" : "Save idea"}</Swap>
          </button>
          {error && (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          )}
        </form>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
              <input
                aria-label="Search ideas"
                className="input pl-9"
                placeholder="Search"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </div>
            <select
              aria-label="Filter by status"
              className="input w-36"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {ideas === null && <p className="text-[14px] text-ink-faint">Loading…</p>}

          {ideas?.length === 0 && (
            <Rise className="card border-dashed p-8 text-center">
              <p className="font-display text-[20px] font-semibold">
                {filtering ? "No ideas match" : "Your inbox is empty"}
              </p>
              <p className="mt-1 text-[14px] text-ink-soft">
                {filtering ? "Try a different search or clear the filters." : "Capture your first idea on the left."}
              </p>
            </Rise>
          )}

          <AnimatePresence initial={false} mode="popLayout">
            {ideas?.map((idea) => (
              <motion.article
                key={idea.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
                className="card card-hover space-y-3"
              >
                <p className="text-[15px] leading-[1.55] whitespace-pre-wrap">{idea.text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/write?idea=${idea.id}`} className="btn-accent">
                    Write post <ArrowRight size={15} />
                  </Link>
                  <select
                    aria-label="Status"
                    className="input w-auto min-h-10 py-1.5"
                    value={idea.status}
                    onChange={(e) => setStatus(idea.id, e.target.value as IdeaStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <span className="text-[12px] text-ink-faint">
                    {new Date(idea.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <ConfirmButton className="ml-auto" onConfirm={() => remove(idea.id)} />
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </section>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Image as ImageIcon, Pen, Plus } from "@/components/icons";
import { Rise } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { Post } from "@/lib/types";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Post[]>("/api/posts")
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
  }, []);

  // While drafts are being written in the background, check back every few seconds.
  const anyGenerating = posts?.some((p) => p.generating) ?? false;
  useEffect(() => {
    if (!anyGenerating) return;
    const refresh = () => api<Post[]>("/api/posts").then(setPosts).catch(() => {});
    const t = setInterval(refresh, 3000);
    // Browsers slow timers in background tabs; catch up the moment the tab is visible again.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [anyGenerating]);

  return (
    <>
      <PageHeader mark="Drafts" subtitle="Work in progress. Open one to keep editing or copy it to LinkedIn.">
        <Link href="/ideas" className="btn-primary">
          <Plus size={16} /> New idea
        </Link>
      </PageHeader>

      {posts === null && !error && <p className="text-[14px] text-ink-faint">Loading your drafts…</p>}
      {error && (
        <p role="alert" className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
          Couldn&apos;t load drafts: {error}
        </p>
      )}

      {posts?.length === 0 && (
        <Rise className="card flex flex-col items-start gap-3 border-dashed p-8">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft) text-(--accent-ink)">
            <Pen size={18} />
          </span>
          <div>
            <p className="font-display text-[20px] font-semibold">Nothing saved yet</p>
            <p className="mt-1 text-[14px] text-ink-soft">Drop an idea in and a draft appears here.</p>
          </div>
          <Link href="/ideas" className="btn-accent">
            Add an idea <ArrowRight size={16} />
          </Link>
        </Rise>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {posts?.map((p, i) => (
          <Rise key={p.id} delay={Math.min(i, 8) * 0.04}>
            <Link href={`/write?post=${p.id}`} className="card card-hover group block h-full">
              <p className="line-clamp-4 text-[14px] leading-[1.55] whitespace-pre-wrap">
                {p.generating ? (
                  <span className="inline-flex items-center gap-2 text-ink-faint">
                    <span className="spinner" /> Drafting…
                  </span>
                ) : (
                  p.text || <em className="text-ink-faint">{p.error ? "Drafting failed" : "Empty draft"}</em>
                )}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-faint">
                <span className="chip">{p.status}</span>
                <span className="tabular-nums">{p.text.length.toLocaleString()} chars</span>
                {(p.image_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon size={13} /> {p.image_count}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </Rise>
        ))}
      </div>
    </>
  );
}

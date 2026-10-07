"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Pen, Plus } from "@/components/icons";
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

  return (
    <>
      <PageHeader mark="Drafts" subtitle="Everything you've saved. Open one to keep editing or copy it to LinkedIn.">
        <Link href="/write" className="btn-primary">
          <Plus size={16} /> New post
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
            <p className="mt-1 text-[14px] text-ink-soft">Start from an idea, or write one from scratch.</p>
          </div>
          <Link href="/write" className="btn-accent">
            Write a post <ArrowRight size={16} />
          </Link>
        </Rise>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {posts?.map((p, i) => (
          <Rise key={p.id} delay={Math.min(i, 8) * 0.04}>
            <Link href={`/write?post=${p.id}`} className="card card-hover group block h-full">
              <p className="line-clamp-4 text-[14px] leading-[1.55] whitespace-pre-wrap">
                {p.text || <em className="text-ink-faint">Empty draft</em>}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-faint">
                <span className="chip">{p.status}</span>
                <span className="tabular-nums">{p.text.length.toLocaleString()} chars</span>
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

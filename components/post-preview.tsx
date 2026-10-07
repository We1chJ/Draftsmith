"use client";

import { motion } from "motion/react";
import { LogoMark } from "@/components/logo";
import { POST_MAX_CHARS } from "@/lib/types";

// Approximation of LinkedIn's feed truncation: roughly 3 lines or ~210 characters,
// whichever comes first. The real cut depends on device width.
const PREVIEW_LINES = 3;
const PREVIEW_CHARS = 210;

export function seeMoreCut(text: string): number {
  let lines = 0;
  for (let i = 0; i < text.length && i < PREVIEW_CHARS; i++) {
    if (text[i] === "\n" && ++lines >= PREVIEW_LINES) return i;
  }
  return Math.min(text.length, PREVIEW_CHARS);
}

export function PostPreview({ text, name }: { text: string; name?: string }) {
  const cut = seeMoreCut(text);
  const truncated = cut < text.length;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft)">
          <LogoMark size={22} />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold">{name ?? "You"}</div>
          <div className="text-[12px] text-ink-faint">Feed preview, approximate</div>
        </div>
      </div>
      <p className="text-[14px] leading-[1.55] whitespace-pre-wrap">
        {text.slice(0, cut)}
        {truncated && <span className="text-ink-faint"> …see more</span>}
      </p>
      {truncated && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[13px] text-ink-soft hover:text-ink">
            <span className="group-open:hidden">Show the rest</span>
            <span className="hidden group-open:inline">Hide</span>
          </summary>
          <p className="mt-2 text-[14px] leading-[1.55] whitespace-pre-wrap text-ink-soft">{text.slice(cut)}</p>
        </details>
      )}
    </div>
  );
}

// Circular character budget. Fills with the section color, turns coral past the limit.
export function CharRing({ count, max = POST_MAX_CHARS }: { count: number; max?: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = Math.min(count / max, 1);
  const over = count > max;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] tabular-nums">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="-rotate-90">
        <circle cx="12" cy="12" r={r} stroke="var(--color-line)" strokeWidth="3" fill="none" />
        <motion.circle
          cx="12"
          cy="12"
          r={r}
          stroke={over ? "var(--color-coral)" : "var(--accent)"}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </svg>
      <span className={over ? "font-semibold text-danger" : "text-ink-soft"}>
        {count.toLocaleString()} / {max.toLocaleString()}
      </span>
    </span>
  );
}

export function TextChecks({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      <CharRing count={text.length} />
    </div>
  );
}

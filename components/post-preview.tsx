"use client";

import { motion } from "motion/react";
import { POST_MAX_CHARS } from "@/lib/types";

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

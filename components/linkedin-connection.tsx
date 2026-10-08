"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { LinkedInStatus } from "@/lib/types";

export function useLinkedIn() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  useEffect(() => {
    api<LinkedInStatus>("/api/linkedin/status").then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);
  return status;
}

export const connectHref = (next: string) => `/api/linkedin/connect?next=${encodeURIComponent(next)}`;

// Compact connection status with a connect / reconnect link.
export function LinkedInConnection({ next }: { next: string }) {
  const status = useLinkedIn();
  if (!status) return null;
  const warn = status.connected && status.days_left <= 7;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-card border px-4 py-3 text-[14px] ${
        status.connected && !warn ? "border-line bg-surface" : "border-lemon/60 bg-lemon-soft"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${status.connected ? (warn ? "bg-lemon" : "bg-mint") : "bg-coral"}`} />
      <span className="min-w-0 flex-1">
        {status.connected
          ? warn
            ? `LinkedIn connection expires in ${status.days_left} ${status.days_left === 1 ? "day" : "days"}. Reconnect to keep scheduled posts going.`
            : `LinkedIn connected · expires in ${status.days_left} days`
          : status.expired
            ? "Your LinkedIn connection expired. Reconnect to post."
            : "Connect LinkedIn to post and schedule from Draftsmith."}
      </span>
      {(!status.connected || warn) && (
        <a href={connectHref(next)} className="btn-primary min-h-9">
          {status.expired || warn ? "Reconnect LinkedIn" : "Connect LinkedIn"}
        </a>
      )}
    </div>
  );
}

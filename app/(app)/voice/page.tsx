"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles } from "@/components/icons";
import { AnimatePresence, Swap, motion } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { Voice } from "@/lib/types";

type VoiceState = Voice & { summary_stale: boolean };

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function VoicePage() {
  const [voice, setVoice] = useState<VoiceState | null>(null);
  const [instructions, setInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<VoiceState>("/api/voice")
      .then((v) => {
        setVoice(v);
        setInstructions(v.instructions ?? "");
        setSavedInstructions(v.instructions ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const dirty = instructions !== savedInstructions;

  async function saveInstructions() {
    setSaving("saving");
    setError("");
    try {
      await api("/api/voice", { method: "PATCH", body: { instructions } });
      setSavedInstructions(instructions);
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1600);
    } catch (e) {
      setSaving("idle");
      setError((e as Error).message);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      setVoice(await api<VoiceState>("/api/voice/refresh", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  const count = voice?.published_count ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        mark="Voice"
        subtitle="Two things shape every draft: what you tell the writer, and what it notices in your published posts."
      />

      {voice === null && error && (
        <p role="alert" className="mb-6 rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
          Couldn&apos;t load your voice: {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Instructions: written by the user, read by the app. */}
        <section className="card space-y-3">
          <div>
            <label htmlFor="instructions" className="label">
              Your instructions
            </label>
            <p className="-mt-0.5 mb-2 text-[13px] text-ink-faint">
              Anything the writer should always do or never do. These win over everything else.
            </p>
          </div>
          <textarea
            id="instructions"
            rows={12}
            className="input resize-y leading-[1.55]"
            placeholder={
              "Concrete beats vague.\n\n" +
              "Short sentences. First person. Open with a plain statement, never a question. " +
              "One idea per post. No emoji. Never say 'game-changer' or 'unlock'. Keep it under 1,300 characters."
            }
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={voice === null}
          />
          <div className="flex items-center gap-3">
            <button className="btn-primary min-w-36" disabled={!dirty || saving === "saving"} onClick={saveInstructions}>
              {saving === "saving" ? <span className="spinner" /> : saving === "saved" ? <Check size={16} /> : null}
              <Swap id={saving}>{saving === "saving" ? "Saving" : saving === "saved" ? "Saved" : "Save instructions"}</Swap>
            </button>
            <Swap id={dirty ? "dirty" : "clean"} className="text-[12px] text-ink-faint">
              {dirty ? "Unsaved changes" : ""}
            </Swap>
          </div>
        </section>

        {/* Summary: written by the app, read by the user. */}
        <section className="card flex flex-col space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="label mb-0">What the writer has noticed</span>
              <p className="mt-1 text-[13px] text-ink-faint">
                {count === 0
                  ? "Appears once you have published posts."
                  : voice?.summary_updated_at
                    ? `From ${voice.summary_post_count ?? count} published ${
                        (voice.summary_post_count ?? count) === 1 ? "post" : "posts"
                      } · updated ${timeAgo(voice.summary_updated_at)}`
                    : `${count} published ${count === 1 ? "post" : "posts"} waiting to be read.`}
              </p>
            </div>
            {count > 0 && (
              <button className="btn min-h-9 shrink-0" disabled={refreshing} onClick={refresh}>
                {refreshing ? <span className="spinner" /> : <Sparkles size={15} />}
                <Swap id={refreshing ? "r" : "i"}>{refreshing ? "Reading" : "Refresh"}</Swap>
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {voice?.summary_stale && !refreshing && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-[10px] bg-(--accent-soft) px-3 py-2 text-[13px] text-(--accent-ink)"
              >
                Your published posts changed since this was written. It refreshes on its own before the next draft, or
                now with Refresh.
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={voice?.summary_updated_at ?? "none"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="flex-1 text-[15px] leading-[1.6] whitespace-pre-wrap"
            >
              {voice?.summary ? (
                voice.summary
              ) : (
                <div className="flex h-full flex-col items-start justify-center gap-3 rounded-[10px] border border-dashed border-line p-6 text-[14px] text-ink-soft">
                  {count === 0 ? (
                    <>
                      <p>Add the posts you&apos;ve already published and the writer will describe your style here.</p>
                      <Link href="/published" className="btn-accent">
                        Go to Published <ArrowRight size={15} />
                      </Link>
                    </>
                  ) : (
                    <p>Click Refresh to have the writer read your published posts.</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && voice && (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

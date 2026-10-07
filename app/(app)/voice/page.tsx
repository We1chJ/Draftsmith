"use client";

import { useEffect, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Check, Pen, Plus } from "@/components/icons";
import { AnimatePresence, Rise, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import type { PastPost, Voice } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

type CardForm = { title: string; text: string; posted_on: string };
const EMPTY_CARD: CardForm = { title: "", text: "", posted_on: "" };

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;

export default function VoicePage() {
  const [voice, setVoice] = useState<Voice | null>(null);
  const [instructions, setInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [savingVoice, setSavingVoice] = useState<"idle" | "saving" | "saved">("idle");
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [card, setCard] = useState<CardForm>(EMPTY_CARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Voice>("/api/voice")
      .then((v) => {
        setVoice(v);
        setInstructions(v.instructions ?? "");
        setSavedInstructions(v.instructions ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const instructionsDirty = instructions !== savedInstructions;

  async function saveInstructions() {
    setSavingVoice("saving");
    setError("");
    try {
      await api("/api/voice", { method: "PATCH", body: { instructions } });
      setSavedInstructions(instructions);
      setSavingVoice("saved");
      setTimeout(() => setSavingVoice("idle"), 1600);
    } catch (e) {
      setSavingVoice("idle");
      setError((e as Error).message);
    }
  }

  function openCard(p?: PastPost) {
    setError("");
    setEditing(p?.id ?? "new");
    setCard(p ? { title: p.title, text: p.text, posted_on: p.posted_on ?? "" } : EMPTY_CARD);
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!voice) return;
    setBusy(true);
    setError("");
    const body = { title: card.title, text: card.text, posted_on: card.posted_on || null };
    try {
      if (editing === "new") {
        const created = await api<PastPost>("/api/voice/posts", { body });
        setVoice({ ...voice, posts: [created, ...voice.posts] });
      } else {
        const updated = await api<PastPost>(`/api/voice/posts/${editing}`, { method: "PATCH", body });
        setVoice({ ...voice, posts: voice.posts.map((p) => (p.id === updated.id ? updated : p)) });
      }
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(id: string) {
    if (!voice) return;
    setVoice({ ...voice, posts: voice.posts.filter((p) => p.id !== id) });
    if (editing === id) setEditing(null);
    await api(`/api/voice/posts/${id}`, { method: "DELETE" });
  }

  const posts = voice?.posts ?? [];
  const sorted = [...posts].sort((a, b) => (b.posted_on ?? "").localeCompare(a.posted_on ?? "") || b.created_at.localeCompare(a.created_at));

  const cardForm = (
    <motion.form
      layout
      onSubmit={saveCard}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={soft}
      className="card space-y-3 border-(--accent) sm:col-span-2"
    >
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
          <label htmlFor="posted_on" className="label">
            Date posted <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="posted_on"
            type="date"
            className="input"
            value={card.posted_on}
            onChange={(e) => setCard({ ...card, posted_on: e.target.value })}
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
          rows={8}
          maxLength={POST_MAX_CHARS}
          className="input resize-y text-[14px] leading-[1.55]"
          placeholder="Paste it exactly as you posted it"
          value={card.text}
          onChange={(e) => setCard({ ...card, text: e.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy}>
          {busy && <span className="spinner" />}
          <Swap id={busy ? "busy" : "idle"}>{busy ? "Saving" : editing === "new" ? "Add to history" : "Save changes"}</Swap>
        </button>
        <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
          Cancel
        </button>
        {editing !== "new" && editing && <ConfirmButton className="ml-auto" onConfirm={() => removeCard(editing)} />}
      </div>
    </motion.form>
  );

  return (
    <>
      <PageHeader
        mark="Voice"
        subtitle="How you want to sound, and the posts that prove it. The writer reads both every time."
      />

      {/* Instructions */}
      <section className="card mb-8 space-y-3">
        <label htmlFor="instructions" className="label">
          Instructions for the writer
        </label>
        <textarea
          id="instructions"
          rows={6}
          className="input resize-y leading-[1.55]"
          placeholder={
            "Anything the writer should know. Concrete beats vague.\n\n" +
            "Short sentences. First person. Open with a plain statement, never a question. " +
            "One idea per post. No emoji. Never say 'game-changer' or 'unlock'. Keep it under 1,300 characters."
          }
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={voice === null}
        />
        <div className="flex items-center gap-3">
          <button
            className="btn-primary min-w-36"
            disabled={!instructionsDirty || savingVoice === "saving"}
            onClick={saveInstructions}
          >
            {savingVoice === "saving" ? <span className="spinner" /> : savingVoice === "saved" ? <Check size={16} /> : null}
            <Swap id={savingVoice}>
              {savingVoice === "saving" ? "Saving" : savingVoice === "saved" ? "Saved" : "Save instructions"}
            </Swap>
          </button>
          <Swap id={instructionsDirty ? "dirty" : "clean"} className="text-[12px] text-ink-faint">
            {instructionsDirty ? "Unsaved changes" : ""}
          </Swap>
        </div>
      </section>

      {/* History */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[24px] leading-none font-semibold">Past posts</h2>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            Your history.{" "}
            {posts.length > 10 ? "The newest 10 are sent to the writer as voice examples." : "All of them are sent to the writer as voice examples."}
          </p>
        </div>
        <button className="btn-accent" onClick={() => openCard()} disabled={editing === "new"}>
          <Plus size={16} /> Add a past post
        </button>
      </div>

      {voice === null && !error && <p className="text-[14px] text-ink-faint">Loading…</p>}
      {voice === null && error && (
        <p role="alert" className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
          Couldn&apos;t load your voice: {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false} mode="popLayout">
          {editing === "new" && <motion.div key="new" layout className="sm:col-span-2">{cardForm}</motion.div>}

          {voice && posts.length === 0 && editing !== "new" && (
            <Rise key="empty" className="card flex flex-col items-start gap-3 border-dashed p-8 sm:col-span-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft) text-(--accent-ink)">
                <Pen size={18} />
              </span>
              <div>
                <p className="font-display text-[20px] font-semibold">No past posts yet</p>
                <p className="mt-1 text-[14px] text-ink-soft">
                  Paste three to five posts you were happy with. That&apos;s the fastest way to get your voice right.
                </p>
              </div>
              <button className="btn-accent" onClick={() => openCard()}>
                <Plus size={16} /> Add a past post
              </button>
            </Rise>
          )}

          {sorted.map((p) =>
            editing === p.id ? (
              <motion.div key={p.id} layout className="sm:col-span-2">
                {cardForm}
              </motion.div>
            ) : (
              <motion.article
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
                transition={soft}
                className="card card-hover group flex flex-col"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-[17px] leading-snug font-semibold">{p.title}</h3>
                  <button
                    aria-label="Edit"
                    className="btn-ghost -mt-1 -mr-2 min-h-8 px-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => openCard(p)}
                  >
                    <Pen size={15} />
                  </button>
                </div>
                <p className="line-clamp-6 text-[14px] leading-[1.55] whitespace-pre-wrap text-ink-soft">{p.text}</p>
                <div className="mt-auto flex items-center gap-2 pt-4 text-[12px] text-ink-faint">
                  {fmtDate(p.posted_on) && <span className="chip">{fmtDate(p.posted_on)}</span>}
                  <span className="tabular-nums">{p.text.length.toLocaleString()} chars</span>
                </div>
              </motion.article>
            ),
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

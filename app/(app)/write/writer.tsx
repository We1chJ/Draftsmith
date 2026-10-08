"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Check, Copy, Send, Sparkles } from "@/components/icons";
import { AnimatePresence, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { LimitsCard } from "@/components/limits-card";
import { PhotoStrip } from "@/components/photo-strip";
import { TextChecks } from "@/components/post-preview";
import { api } from "@/lib/client";
import type { Post, PostImage, Voice } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

const PRESETS = [
  { key: "shorter", label: "Shorter" },
  { key: "hook", label: "Stronger hook" },
  { key: "personal", label: "More personal" },
  { key: "question", label: "End with a question" },
] as const;

type Edit = { id: number; label: string; before: string; undone?: boolean };

// Edits one saved draft. Drafts are created from Ideas; the left panel asks the AI to revise it.
export function Writer({ postId }: { postId?: string }) {
  const router = useRouter();
  const [voice, setVoice] = useState<Voice | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [images, setImages] = useState<PostImage[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<"" | "edit" | "save">("");
  const [justSaved, setJustSaved] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [edits, setEdits] = useState<Edit[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const editSeq = useRef(0);

  // No draft to edit: the editor only opens from a draft.
  useEffect(() => {
    if (!postId) router.replace("/posts");
  }, [postId, router]);

  useEffect(() => {
    if (!postId) return;
    api<Voice>("/api/voice").then(setVoice).catch(() => {});
    api<PostImage[]>(`/api/posts/${postId}/images`).then(setImages).catch(() => {});
    // A draft submitted from Ideas may still be writing in the background; fill it in when done.
    let stop = false;
    const tick = async () => {
      const p = await api<Post>(`/api/posts/${postId}`).catch((e: Error) => {
        setError(e.message);
        return null;
      });
      if (stop || !p) return;
      setPending(!!p.generating);
      if (p.generating) return void setTimeout(tick, 3000);
      setText(p.text);
      setSavedText(p.text);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [postId]);

  const dirty = text !== savedText;
  const locked = pending || busy === "edit";

  async function persist(next: string) {
    await api(`/api/posts/${postId}`, { method: "PATCH", body: { text: next } });
    setSavedText(next);
  }

  // AI edits apply to the current text and are saved right away; each can be undone.
  async function aiEdit(preset?: (typeof PRESETS)[number]) {
    const ask = preset ? undefined : instruction.trim();
    if (!text.trim() || (!preset && !ask)) return;
    setBusy("edit");
    setError("");
    const before = text;
    try {
      const res = await api<{ text: string }>("/api/rewrite", {
        body: { text, preset: preset?.key, instruction: ask },
      });
      setText(res.text);
      await persist(res.text);
      setEdits((list) => [{ id: ++editSeq.current, label: preset?.label ?? ask!, before }, ...list]);
      if (!preset) setInstruction("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function undo(edit: Edit) {
    setText(edit.before);
    await persist(edit.before).catch((e: Error) => setError(e.message));
    // Undoing an edit also discards the ones made after it.
    setEdits((list) => list.map((e) => (e.id >= edit.id ? { ...e, undone: true } : e)));
  }

  async function save() {
    setBusy("save");
    setError("");
    try {
      await persist(text);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    await api(`/api/posts/${postId}`, { method: "DELETE" }).catch(() => {});
    router.push("/posts");
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!postId) return null;
  const saveState = busy === "save" ? "saving" : justSaved ? "saved" : "idle";
  const voiceEmpty = voice !== null && !voice.instructions && voice.published_count === 0;

  return (
    <>
      <PageHeader mark="Editing" rest="a draft" subtitle="Tell the AI what to change, or edit the text yourself." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: edit with AI */}
        <section className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card space-y-4">
            <div>
              <span className="label">Edit with AI</span>
              <p className="-mt-0.5 text-[13px] text-ink-faint">
                {voiceEmpty ? (
                  <>
                    No voice set yet.{" "}
                    <Link href="/published" className="font-medium text-(--accent-ink) hover:underline">
                      Add published posts
                    </Link>
                    .
                  </>
                ) : voice ? (
                  `Edits stay in your voice (${voice.published_count} published posts${
                    voice.instructions ? " + your instructions" : ""
                  }).`
                ) : (
                  " "
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.key} className="btn min-h-9" disabled={!text.trim() || locked} onClick={() => aiEdit(p)}>
                  {p.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                aiEdit();
              }}
              className="space-y-2"
            >
              <textarea
                aria-label="What should change?"
                rows={3}
                className="input resize-y"
                placeholder="e.g. cut the second paragraph, add the detail about the 2 AM pool table, make the ending punchier"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    aiEdit();
                  }
                }}
                disabled={locked}
              />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-faint">Enter to send · Shift+Enter for a new line</span>
                <button className="btn-primary" disabled={!instruction.trim() || !text.trim() || locked}>
                  {busy === "edit" ? <span className="spinner" /> : <Send size={15} />}
                  <Swap id={busy === "edit" ? "editing" : "idle"}>{busy === "edit" ? "Editing" : "Apply edit"}</Swap>
                </button>
              </div>
            </form>

            <AnimatePresence initial={false}>
              {edits.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-1.5 border-t border-line pt-3"
                  aria-label="Edits made"
                >
                  <AnimatePresence initial={false}>
                    {edits.map((e) => (
                      <motion.li
                        key={e.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={soft}
                        className={`flex items-start gap-2 text-[13px] ${e.undone ? "text-ink-faint line-through" : ""}`}
                      >
                        <Sparkles size={14} className="mt-0.5 shrink-0 text-(--accent)" />
                        <span className="min-w-0 flex-1">{e.label}</span>
                        {!e.undone && (
                          <button
                            className="shrink-0 text-[12px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                            disabled={locked}
                            onClick={() => undo(e)}
                          >
                            Undo
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right: the draft */}
        <section className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="post" className="label mb-0">
                Your post
              </label>
              <Swap id={pending ? "pending" : dirty ? "unsaved" : "saved"} className="text-[12px] text-ink-faint">
                {pending ? "Drafting…" : dirty ? "Unsaved changes" : "Saved"}
              </Swap>
            </div>
            <textarea
              id="post"
              rows={16}
              className="input resize-y text-[15px] leading-[1.6]"
              value={pending ? "" : text}
              disabled={locked}
              onChange={(e) => setText(e.target.value)}
              placeholder={pending ? "Writing your draft…" : ""}
            />
            <TextChecks text={text} />

            <div className="border-t border-line pt-4">
              <PhotoStrip images={images} onChange={setImages} ensurePostId={async () => postId} disabled={locked} />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 border-t border-line pt-4">
              <button
                className="btn-primary min-w-30"
                disabled={!text.trim() || text.length > POST_MAX_CHARS || !!busy || pending || !dirty}
                onClick={save}
              >
                {saveState === "saving" ? <span className="spinner" /> : saveState === "saved" ? <Check size={16} /> : null}
                <Swap id={saveState}>{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save draft"}</Swap>
              </button>
              <button className="btn" disabled={!text || pending} onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <Swap id={copied ? "copied" : "copy"}>{copied ? "Copied" : "Copy"}</Swap>
              </button>
              <ConfirmButton className="ml-auto" onConfirm={remove} />
            </div>
          </div>

          <LimitsCard />
        </section>
      </div>
    </>
  );
}

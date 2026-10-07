"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { ArrowRight, Check, Copy, Sparkles } from "@/components/icons";
import { AnimatePresence, Rise, Swap, motion, soft } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { PostPreview, TextChecks } from "@/components/post-preview";
import { api } from "@/lib/client";
import type { Idea, Post, Variant, Voice } from "@/lib/types";
import { POST_MAX_CHARS } from "@/lib/types";

const PRESETS = [
  { key: "shorter", label: "Shorter" },
  { key: "hook", label: "Stronger hook" },
  { key: "personal", label: "More personal" },
  { key: "question", label: "End with a question" },
] as const;

export function Writer({ ideaId, postId }: { ideaId?: string; postId?: string }) {
  const router = useRouter();
  const [voice, setVoice] = useState<Voice | null>(null);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [ideaText, setIdeaText] = useState("");
  const [notes, setNotes] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [post, setPost] = useState<Pick<Post, "id" | "idea_id"> | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [busy, setBusy] = useState<"" | "generate" | "rewrite" | "save">("");
  const [justSaved, setJustSaved] = useState(false);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [v, p] = await Promise.all([
          api<Voice>("/api/voice"),
          postId ? api<Post>(`/api/posts/${postId}`) : null,
        ]);
        setVoice(v);
        if (p) {
          setPost(p);
          setText(p.text);
          setSavedText(p.text);
        }
        const iid = p?.idea_id ?? ideaId;
        if (iid) {
          const i = await api<Idea>(`/api/ideas/${iid}`);
          setIdea(i);
          setIdeaText(i.text);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [ideaId, postId]);

  const dirty = text !== savedText;
  const voiceEmpty = voice !== null && !voice.instructions && voice.posts.length === 0;

  async function run<T>(kind: typeof busy, fn: () => Promise<T>) {
    setBusy(kind);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const generate = () =>
    run("generate", async () => {
      const body = idea && ideaText === idea.text ? { idea_id: idea.id } : { text: ideaText };
      const res = await api<{ variants: Variant[] }>("/api/generate", {
        body: { ...body, notes: notes || undefined },
      });
      setVariants(res.variants);
    });

  const rewrite = (preset?: string) =>
    run("rewrite", async () => {
      const res = await api<{ text: string }>("/api/rewrite", {
        body: { text, preset, instruction: preset ? undefined : custom },
      });
      setText(res.text);
    });

  const save = () =>
    run("save", async () => {
      if (post) {
        await api(`/api/posts/${post.id}`, { method: "PATCH", body: { text } });
      } else {
        const created = await api<Post>("/api/posts", { body: { text, idea_id: idea?.id ?? null } });
        setPost(created);
        // Update the URL without remounting, so the variants stay on screen.
        window.history.replaceState(null, "", `/write?post=${created.id}`);
      }
      setSavedText(text);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    });

  async function remove() {
    if (!post) return;
    await run("save", () => api(`/api/posts/${post.id}`, { method: "DELETE" }));
    router.push("/posts");
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const canGenerate = Boolean(ideaText.trim()) && !busy;
  const saveState = busy === "save" ? "saving" : justSaved ? "saved" : "idle";

  return (
    <>
      <PageHeader
        mark={post ? "Editing" : "Write"}
        rest={post ? "a draft" : "a post"}
        subtitle="Generate a few openings from an idea, then make it yours."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: source + AI variants */}
        <section className="space-y-4">
          <div className="card space-y-4">
            <div>
              <label htmlFor="idea" className="label">
                Idea
              </label>
              <textarea
                id="idea"
                rows={5}
                className="input resize-y"
                placeholder="Paste or type the idea for this post"
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="notes" className="label">
                Notes for this post <span className="font-normal text-ink-faint">(optional)</span>
              </label>
              <input
                id="notes"
                className="input"
                placeholder="Angle, audience, a detail to include"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Swap id={voiceEmpty ? "empty" : "ok"} className="min-w-0 text-[13px] text-ink-soft">
                {voiceEmpty ? (
                  <>
                    No voice set yet.{" "}
                    <Link href="/voice" className="font-medium text-(--accent-ink) underline-offset-2 hover:underline">
                      Add instructions or past posts
                    </Link>
                  </>
                ) : voice ? (
                  `Using your voice: ${voice.posts.length} past ${voice.posts.length === 1 ? "post" : "posts"}${
                    voice.instructions ? " and your instructions" : ""
                  }`
                ) : (
                  ""
                )}
              </Swap>
              <button className="btn-primary shrink-0" disabled={!canGenerate} onClick={generate}>
                {busy === "generate" ? <span className="spinner" /> : <Sparkles size={16} />}
                <Swap id={busy === "generate" ? "writing" : variants.length ? "again" : "go"}>
                  {busy === "generate" ? "Writing" : variants.length ? "Try again" : "Generate"}
                </Swap>
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {busy === "generate" &&
              [0, 1, 2].map((i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...soft, delay: i * 0.06 }}
                  className="card space-y-2.5"
                  aria-hidden="true"
                >
                  <div className="h-3 w-24 animate-pulse rounded bg-(--accent-soft)" />
                  <div className="h-3 w-full animate-pulse rounded bg-line" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-line" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-line" />
                </motion.div>
              ))}

            {busy !== "generate" &&
              variants.map((v, i) => (
                <motion.article
                  key={`${v.hook}-${i}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ ...soft, delay: i * 0.08 }}
                  className="card card-hover space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="chip">Opening {i + 1}</span>
                    <button className="btn-accent min-h-9" onClick={() => setText(v.text)}>
                      Use this <ArrowRight size={15} />
                    </button>
                  </div>
                  <p className="text-[14px] leading-[1.55] whitespace-pre-wrap">{v.text}</p>
                  <div className="text-[12px] text-ink-faint tabular-nums">{v.text.length.toLocaleString()} characters</div>
                </motion.article>
              ))}
          </AnimatePresence>
        </section>

        {/* Right: editor */}
        <section className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="post" className="label mb-0">
                Your post
              </label>
              <Swap id={post ? (dirty ? "unsaved" : "saved") : "new"} className="text-[12px] text-ink-faint">
                {post ? (dirty ? "Unsaved changes" : "Saved") : "Not saved yet"}
              </Swap>
            </div>
            <textarea
              id="post"
              rows={13}
              className="input resize-y text-[15px] leading-[1.6]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pick an opening on the left, or start typing"
            />
            <TextChecks text={text} />

            <div className="space-y-2 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.key} className="btn min-h-9" disabled={!text.trim() || !!busy} onClick={() => rewrite(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Custom rewrite instruction"
                  className="input"
                  placeholder="Or tell it what to change: 'drop the second paragraph'"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && custom.trim() && text.trim() && !busy && rewrite()}
                />
                <button className="btn shrink-0" disabled={!custom.trim() || !text.trim() || !!busy} onClick={() => rewrite()}>
                  {busy === "rewrite" ? <span className="spinner" /> : null}
                  <Swap id={busy === "rewrite" ? "rewriting" : "apply"}>{busy === "rewrite" ? "Rewriting" : "Apply"}</Swap>
                </button>
              </div>
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
                disabled={!text.trim() || text.length > POST_MAX_CHARS || !!busy || (post !== null && !dirty)}
                onClick={save}
              >
                {saveState === "saving" ? <span className="spinner" /> : saveState === "saved" ? <Check size={16} /> : null}
                <Swap id={saveState}>{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save draft"}</Swap>
              </button>
              <button className="btn" disabled={!text} onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <Swap id={copied ? "copied" : "copy"}>{copied ? "Copied" : "Copy"}</Swap>
              </button>
              {post && <ConfirmButton className="ml-auto" onConfirm={remove} />}
            </div>
          </div>

          <AnimatePresence>
            {text && (
              <Rise key="preview">
                <PostPreview text={text} />
              </Rise>
            )}
          </AnimatePresence>
        </section>
      </div>
    </>
  );
}

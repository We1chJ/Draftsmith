"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, X } from "@/components/icons";
import { AnimatePresence, motion, soft } from "@/components/motion";
import { upload, api } from "@/lib/client";
import { LINKEDIN } from "@/lib/platforms";
import type { PostImage } from "@/lib/types";

const ACCEPT = LINKEDIN.imageMimes.join(",");

// Photos attached to a draft: drop zone, thumbnails with alt text, remove.
// `ensurePostId` saves the draft first if it has never been saved.
export function PhotoStrip({
  images,
  onChange,
  ensurePostId,
  disabled,
}: {
  images: PostImage[];
  onChange: (images: PostImage[]) => void;
  ensurePostId: () => Promise<string>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [postId, setPostId] = useState<string | null>(null);

  const remaining = LINKEDIN.maxImages - images.length;

  // Client-side checks mirror the server so the message arrives before any upload.
  function validate(files: File[]): string | null {
    if (files.length > remaining) return `LinkedIn allows ${LINKEDIN.maxImages} images per post. Room for ${remaining} more.`;
    for (const f of files) {
      if (!LINKEDIN.imageMimes.includes(f.type as (typeof LINKEDIN.imageMimes)[number])) return `${f.name}: only JPG, PNG and GIF.`;
      if (f.size > LINKEDIN.imageMaxBytes) return `${f.name}: larger than ${LINKEDIN.imageMaxBytes / 1024 / 1024} MB.`;
    }
    return null;
  }

  async function add(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError("");
    const problem = validate(files);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const id = postId ?? (await ensurePostId());
      setPostId(id);
      onChange(await upload<PostImage[]>(`/api/posts/${id}/images`, files));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setAlt(img: PostImage, alt: string) {
    const id = postId ?? (await ensurePostId());
    onChange(await api<PostImage[]>(`/api/posts/${id}/images/${img.id}`, { method: "PATCH", body: { alt } }));
  }

  async function remove(img: PostImage) {
    const id = postId ?? (await ensurePostId());
    onChange(images.filter((i) => i.id !== img.id));
    onChange(await api<PostImage[]>(`/api/posts/${id}/images/${img.id}`, { method: "DELETE" }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Photos</span>
        <span className="text-[12px] text-ink-faint tabular-nums">
          {images.length} of {LINKEDIN.maxImages}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {images.length > 0 && (
          <motion.ul layout className="grid grid-cols-2 gap-2 sm:grid-cols-3" initial={false}>
            <AnimatePresence initial={false} mode="popLayout">
              {images.map((img) => (
                <motion.li
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                  transition={soft}
                  className="group relative overflow-hidden rounded-[10px] border border-line bg-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt ?? ""} className="aspect-[4/3] w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    className="absolute top-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-ink/70 text-paper opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => remove(img)}
                  >
                    <X size={14} />
                  </button>
                  <input
                    aria-label="Alt text"
                    className="w-full border-t border-line bg-surface px-2 py-1.5 text-[12px] outline-none placeholder:text-ink-faint focus:bg-paper"
                    placeholder="Describe the photo (alt text)"
                    defaultValue={img.alt ?? ""}
                    onBlur={(e) => e.target.value !== (img.alt ?? "") && setAlt(img, e.target.value)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>

      {remaining > 0 && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
          className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed px-3 py-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            dragging ? "border-(--accent) bg-(--accent-soft) text-(--accent-ink)" : "border-line text-ink-soft hover:border-line-strong hover:bg-paper"
          }`}
        >
          {busy ? <span className="spinner" /> : <ImageIcon size={16} />}
          {busy ? "Uploading" : images.length ? "Add more photos" : "Drop photos here, or click to choose"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

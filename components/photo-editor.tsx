"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "@/components/icons";
import { motion, soft } from "@/components/motion";
import { LINKEDIN } from "@/lib/platforms";
import type { PostImage } from "@/lib/types";

// Redaction editor: black boxes, pixelated boxes and a black pen, drawn over the photo.
// Saving flattens everything into one new image in the browser and replaces the original,
// so what's posted is exactly what's shown here.

type Rect = { x: number; y: number; w: number; h: number };
type Op =
  | { kind: "box"; rect: Rect }
  | { kind: "pixelate"; rect: Rect }
  | { kind: "pen"; width: number; points: [number, number][] };
type Tool = "box" | "pixelate" | "pen";

// Pen widths as a share of the photo's longer side, so they look the same on any size of photo.
const PEN_SIZES = [
  { key: "S", label: "Small", share: 0.006 },
  { key: "M", label: "Medium", share: 0.015 },
  { key: "L", label: "Large", share: 0.03 },
] as const;
// Browsers (notably iOS Safari) refuse canvases much past ~16.7M pixels.
const MAX_CANVAS_PIXELS = 16_000_000;

const rectBetween = (a: [number, number], b: [number, number]): Rect => ({
  x: Math.min(a[0], b[0]),
  y: Math.min(a[1], b[1]),
  w: Math.abs(a[0] - b[0]),
  h: Math.abs(a[1] - b[1]),
});

function applyOp(ctx: CanvasRenderingContext2D, op: Op) {
  const { canvas } = ctx;
  if (op.kind === "box") {
    ctx.fillStyle = "#000";
    ctx.fillRect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
  } else if (op.kind === "pen") {
    ctx.fillStyle = ctx.strokeStyle = "#000";
    ctx.lineWidth = op.width;
    ctx.lineCap = ctx.lineJoin = "round";
    const [first, ...rest] = op.points;
    if (rest.length === 0) {
      ctx.beginPath();
      ctx.arc(first[0], first[1], op.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (const [x, y] of rest) ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    // Shrink the area to a few blocks, then scale it back up without smoothing.
    const x = Math.max(0, Math.floor(op.rect.x));
    const y = Math.max(0, Math.floor(op.rect.y));
    const w = Math.min(canvas.width - x, Math.ceil(op.rect.w));
    const h = Math.min(canvas.height - y, Math.ceil(op.rect.h));
    if (w < 1 || h < 1) return;
    const block = Math.max(12, Math.round(Math.max(canvas.width, canvas.height) / 30));
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.ceil(w / block));
    small.height = Math.max(1, Math.ceil(h / block));
    small.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    ctx.restore();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), type, quality),
  );
}

export function PhotoEditor({
  postId,
  image,
  onClose,
  onSaved,
}: {
  postId: string;
  image: PostImage;
  onClose: () => void;
  onSaved: (images: PostImage[]) => void;
}) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null); // the photo as loaded
  const doneRef = useRef<HTMLCanvasElement | null>(null); // the photo plus finished edits
  const draftRef = useRef<Op | null>(null); // the edit being drawn right now
  const startRef = useRef<[number, number] | null>(null);
  const frameRef = useRef(0);

  const [ops, setOps] = useState<Op[]>([]);
  const [tool, setTool] = useState<Tool>("box");
  const [penSize, setPenSize] = useState<(typeof PEN_SIZES)[number]["key"]>("M");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Shows the finished edits plus whatever is being drawn.
  function paint() {
    const view = viewRef.current;
    const done = doneRef.current;
    if (!view || !done) return;
    const ctx = view.getContext("2d")!;
    ctx.drawImage(done, 0, 0);
    const draft = draftRef.current;
    if (!draft) return;
    if (draft.kind === "pixelate") {
      // Previewed as an outline; the mosaic is applied when the drag ends.
      const unit = Math.max(view.width, view.height) / 400;
      ctx.save();
      ctx.lineWidth = unit * 1.5;
      ctx.setLineDash([unit * 5, unit * 4]);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(draft.rect.x, draft.rect.y, draft.rect.w, draft.rect.h);
      ctx.strokeStyle = "#000";
      ctx.lineDashOffset = unit * 4.5;
      ctx.strokeRect(draft.rect.x, draft.rect.y, draft.rect.w, draft.rect.h);
      ctx.restore();
    } else {
      applyOp(ctx, draft);
    }
  }

  // Redraws the photo with every finished edit, in order.
  function rebuild(list: Op[]) {
    const base = baseRef.current;
    const done = doneRef.current;
    if (!base || !done) return;
    const ctx = done.getContext("2d")!;
    ctx.drawImage(base, 0, 0);
    for (const op of list) applyOp(ctx, op);
    paint();
  }

  // Load the original from our own server (same origin, so the canvas can be exported).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/images/${image.id}`);
        if (!res.ok) throw new Error("Couldn't load the photo.");
        const bitmap = await createImageBitmap(await res.blob());
        if (cancelled) return;
        const scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (bitmap.width * bitmap.height)));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const make = () => Object.assign(document.createElement("canvas"), { width: w, height: h });
        baseRef.current = make();
        baseRef.current.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
        doneRef.current = make();
        doneRef.current.getContext("2d")!.drawImage(baseRef.current, 0, 0);
        bitmap.close();
        const view = viewRef.current!;
        view.width = w;
        view.height = h;
        paint();
        setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, image.id]);

  // The page behind doesn't scroll while editing.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const view = e.currentTarget;
    const box = view.getBoundingClientRect();
    return [((e.clientX - box.left) * view.width) / box.width, ((e.clientY - box.top) * view.height) / box.height];
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready || saving || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    startRef.current = p;
    const view = e.currentTarget;
    const share = PEN_SIZES.find((s) => s.key === penSize)!.share;
    draftRef.current =
      tool === "pen"
        ? { kind: "pen", width: Math.max(2, share * Math.max(view.width, view.height)), points: [p] }
        : { kind: tool, rect: rectBetween(p, p) };
    paint();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const draft = draftRef.current;
    if (!draft || !startRef.current) return;
    const p = pointAt(e);
    if (draft.kind === "pen") draft.points.push(p);
    else draft.rect = rectBetween(startRef.current, p);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(paint);
  }

  function onUp() {
    const draft = draftRef.current;
    draftRef.current = null;
    startRef.current = null;
    if (!draft) return;
    const tooSmall = draft.kind !== "pen" && (draft.rect.w < 3 || draft.rect.h < 3);
    if (tooSmall) return paint();
    const next = [...ops, draft];
    setOps(next);
    rebuild(next);
  }

  function undo() {
    const next = ops.slice(0, -1);
    setOps(next);
    rebuild(next);
  }

  function startOver() {
    setOps([]);
    rebuild([]);
  }

  async function save() {
    const done = doneRef.current;
    if (!done || ops.length === 0) return;
    setSaving(true);
    setError("");
    try {
      // Keep JPEGs as JPEG; PNG and GIF (first frame) become PNG. Fall back to JPEG if a PNG is too big.
      let type = image.mime === "image/jpeg" ? "image/jpeg" : "image/png";
      let blob = await toBlob(done, type, 0.92);
      if (blob.size > LINKEDIN.imageMaxBytes && type === "image/png") {
        type = "image/jpeg";
        blob = await toBlob(done, type, 0.9);
      }
      const form = new FormData();
      form.append("file", new File([blob], `edited.${type === "image/png" ? "png" : "jpg"}`, { type }));
      const res = await fetch(`/api/posts/${postId}/images/${image.id}`, { method: "PUT", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Saving failed (${res.status})`);
      onSaved(data as PostImage[]);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const toolButton = (key: Tool, label: string) => (
    <button
      type="button"
      aria-pressed={tool === key}
      onClick={() => setTool(key)}
      className={`btn min-h-9 ${tool === key ? "border-ink bg-ink text-paper hover:border-ink! hover:bg-ink!" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-ink/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-6">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-editor-title"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={soft}
          className="card relative w-full max-w-5xl space-y-3 p-4 shadow-[0_24px_60px_-20px_rgba(30,27,24,0.45)] sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="photo-editor-title" className="text-[20px] leading-tight font-semibold">
                Redact photo
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                Drag to cover areas, or draw with the pen. The saved photo looks exactly like this.
              </p>
            </div>
            <button type="button" aria-label="Close without saving" className="btn-ghost min-h-9 px-2" onClick={onClose} disabled={saving}>
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Redaction tools">
            {toolButton("box", "Black box")}
            {toolButton("pixelate", "Pixelate")}
            {toolButton("pen", "Pen")}
            {tool === "pen" && (
              <span className="ml-1 inline-flex items-center gap-1" role="group" aria-label="Pen size">
                {PEN_SIZES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-label={`${s.label} pen`}
                    aria-pressed={penSize === s.key}
                    onClick={() => setPenSize(s.key)}
                    className={`btn min-h-9 w-10 px-0 ${penSize === s.key ? "border-ink" : ""}`}
                  >
                    <span
                      className="rounded-full bg-ink"
                      style={{ width: { S: 4, M: 8, L: 14 }[s.key], height: { S: 4, M: 8, L: 14 }[s.key] }}
                    />
                  </button>
                ))}
              </span>
            )}
            <span className="ml-auto inline-flex gap-1">
              <button type="button" className="btn-ghost min-h-9" disabled={ops.length === 0 || saving} onClick={undo}>
                Undo
              </button>
              <button type="button" className="btn-ghost min-h-9" disabled={ops.length === 0 || saving} onClick={startOver}>
                Start over
              </button>
            </span>
          </div>

          <div className="grid min-h-48 place-items-center overflow-hidden rounded-[10px] border border-line bg-paper">
            {!ready && !error && (
              <span className="flex items-center gap-2 py-16 text-[14px] text-ink-soft">
                <span className="spinner" /> Loading photo…
              </span>
            )}
            <canvas
              ref={viewRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={`max-h-[65vh] max-w-full cursor-crosshair touch-none select-none ${ready ? "" : "hidden"}`}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-[10px] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn-primary min-w-32" onClick={save} disabled={!ready || ops.length === 0 || saving}>
              {saving ? <span className="spinner" /> : <Check size={16} />}
              {saving ? "Saving" : "Save photo"}
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

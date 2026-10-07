"use client";

import { useEffect, useState } from "react";
import { Swap } from "@/components/motion";
import { Trash } from "@/components/icons";

// Two-step delete without a browser dialog: first click asks, second confirms.
export function ConfirmButton({
  onConfirm,
  label = "Delete",
  className = "",
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  className?: string;
}) {
  const [arming, setArming] = useState(false);

  useEffect(() => {
    if (!arming) return;
    const t = setTimeout(() => setArming(false), 3500);
    return () => clearTimeout(t);
  }, [arming]);

  if (arming) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <button type="button" className="btn-ghost min-h-9 px-2.5 text-danger hover:bg-coral-soft" onClick={() => onConfirm()}>
          <Swap id="confirm">Yes, delete</Swap>
        </button>
        <button type="button" className="btn-ghost min-h-9 px-2.5" onClick={() => setArming(false)}>
          Keep
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={`btn-ghost min-h-9 px-2.5 ${className}`} onClick={() => setArming(true)}>
      <Trash size={16} />
      <Swap id="idle">{label}</Swap>
    </button>
  );
}

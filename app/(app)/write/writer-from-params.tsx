"use client";

import { useSearchParams } from "next/navigation";
import { Writer } from "./writer";

export function WriterFromParams() {
  const post = useSearchParams().get("post") ?? undefined;
  // Key resets the editor when switching between drafts.
  return <Writer key={post ?? ""} postId={post} />;
}

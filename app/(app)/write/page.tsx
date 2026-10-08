import { Suspense } from "react";
import { WriterFromParams } from "./writer-from-params";

export const metadata = { title: "Write" };

// Query params are read on the client (useSearchParams) so a direct load of /write?post=…
// doesn't depend on the server resuming a partially prerendered shell.
export default function WritePage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-ink-faint">Loading…</p>}>
      <WriterFromParams />
    </Suspense>
  );
}

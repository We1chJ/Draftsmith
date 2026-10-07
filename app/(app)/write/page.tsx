import { Suspense } from "react";
import { Writer } from "./writer";

export const metadata = { title: "Write" };

async function WriterFromParams({ searchParams }: PageProps<"/write">) {
  const { idea, post } = await searchParams;
  return (
    <Writer
      key={`${idea ?? ""}-${post ?? ""}`}
      ideaId={typeof idea === "string" ? idea : undefined}
      postId={typeof post === "string" ? post : undefined}
    />
  );
}

export default function WritePage(props: PageProps<"/write">) {
  return (
    <Suspense fallback={<p className="text-[14px] text-ink-faint">Loading…</p>}>
      <WriterFromParams {...props} />
    </Suspense>
  );
}

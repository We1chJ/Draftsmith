// Placeholder cards shaped like the real ones, so the grid doesn't jump when data arrives.
export function CardSkeletons({ count, label, className }: { count: number; label: string; className: string }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card animate-pulse space-y-2.5" aria-hidden="true">
          <div className="h-3 w-11/12 rounded bg-line" />
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-4/5 rounded bg-line" />
          <div className="h-3 w-2/3 rounded bg-line" />
          <div className="!mt-6 h-5 w-24 rounded-full bg-line" />
        </div>
      ))}
    </div>
  );
}

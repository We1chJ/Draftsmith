// Three fanned drafts: coral behind, lemon middle, sky on top with two lines of text.
// Same mark as app/icon.svg; keep them in sync.
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="18" y="14" width="28" height="36" rx="6" fill="#F0707E" transform="rotate(-18 32 46)" />
      <rect x="18" y="12" width="28" height="36" rx="6" fill="#F7D354" transform="rotate(-2 32 46)" />
      <g transform="rotate(14 32 46)">
        <rect x="18" y="14" width="28" height="36" rx="6" fill="#5B8DEF" />
        <rect x="24" y="23" width="16" height="3.5" rx="1.75" fill="#FBFAF6" />
        <rect x="24" y="31" width="11" height="3.5" rx="1.75" fill="#FBFAF6" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark />
      <span className="font-display text-[19px] font-semibold tracking-tight">Draftsmith</span>
    </span>
  );
}

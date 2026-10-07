// Section heading with the marker swipe behind one word. `mark` is the highlighted word.
export function PageHeader({
  mark,
  rest,
  subtitle,
  children,
}: {
  mark: string;
  rest?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] leading-none font-semibold sm:text-[38px]">
          <span className="hl">{mark}</span>
          {rest && <span> {rest}</span>}
        </h1>
        {subtitle && <p className="mt-2.5 max-w-prose text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

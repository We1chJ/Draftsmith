import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-30 rounded-[10px] bg-ink px-3 py-2 text-[14px] text-paper focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Wordmark } from "@/components/logo";
import { soft } from "@/components/motion";

export const SECTIONS = [
  { href: "/ideas", label: "Ideas", section: "ideas" },
  { href: "/write", label: "Write", section: "write" },
  { href: "/posts", label: "Drafts", section: "posts" },
  { href: "/voice", label: "Voice", section: "voice" },
] as const;

export function sectionFor(path: string) {
  return SECTIONS.find((s) => path.startsWith(s.href))?.section ?? "write";
}

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-6">
        <Link href="/ideas" className="rounded-md" aria-label="Draftsmith home">
          <Wordmark />
        </Link>
        <nav className="-mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1" aria-label="Sections">
          {SECTIONS.map((s) => {
            const active = path.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                data-section={s.section}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-[10px] px-3 py-1.5 text-[14px] transition-colors duration-200 ${
                  active ? "font-semibold text-(--accent-ink)" : "text-ink-soft hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-[10px] bg-(--accent-soft)"
                    transition={soft}
                  />
                )}
                <span className="relative">{s.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost -mr-2 min-h-9 px-2.5 text-[13px]">Sign out</button>
        </form>
      </div>
    </header>
  );
}

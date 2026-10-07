"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { sectionFor } from "@/components/nav";

// Remounts on every navigation, so each section arrives with one quiet rise.
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <motion.div
      data-section={sectionFor(path)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-6xl flex-1 px-4 pt-7 pb-16"
    >
      {children}
    </motion.div>
  );
}

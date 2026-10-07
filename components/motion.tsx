"use client";

import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";

export const soft = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;
export const quick = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const;

// Fades and lifts children in; used for page content and newly added rows.
export function Rise({ children, delay = 0, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: quick }}
      transition={{ ...soft, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Crossfades its content whenever `id` changes (button labels, status text).
export function Swap({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={className}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={quick}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

export { AnimatePresence, motion };

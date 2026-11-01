"use client";

import { AnimatePresence, motion } from "motion/react";

// Content that slides open and closed. Anything already open when the page
// appears shows straight away, so a page you return to keeps its shape.
export function Collapse({
  open,
  id,
  className = "",
  children,
}: {
  open: boolean;
  id?: string;
  // For the inner wrapper; padding on the animated element would break the height animation.
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

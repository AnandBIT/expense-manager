"use client";

import { motion } from "motion/react";

// An on/off toggle whose knob slides across.
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-full text-xs font-medium text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-zinc-300"
    >
      {label}
      <span
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
          checked ? "justify-end bg-emerald-600" : "justify-start bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
          className="h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </span>
    </button>
  );
}

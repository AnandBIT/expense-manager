"use client";

import { useId } from "react";
import { motion } from "motion/react";

// A row of choices with a pill that slides to the selected one.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  // Each control needs its own pill, or two on one page would trade it.
  const pillId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:text-sm ${
              selected
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                aria-hidden="true"
                transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-950 dark:ring-white/10"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

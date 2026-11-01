"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { inviteUrl } from "@/lib/groups";
import type { Group } from "@/lib/types";
import { buttonClass, inputClass } from "./ui";

export function InviteLink({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = inviteUrl(group);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // navigator.clipboard only exists on https and localhost. Elsewhere, like a
      // phone opening the dev server over the local network, copy the selected
      // link the older way. If that's blocked too, it stays selected to copy by hand.
      inputRef.current?.select();
      if (!document.execCommand("copy")) return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <p className="text-xs text-zinc-500">
        To add people, send them this link. Anyone with it can join after signing in with Google.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.target.select()}
          className={`${inputClass} font-mono text-xs`}
        />
        <button type="button" onClick={copy} className={`${buttonClass("secondary")} min-w-24`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1"
            >
              {copied && (
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-600">
                  <path d="M3 8.5l3 3 7-7" />
                </svg>
              )}
              {copied ? "Copied" : "Copy"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </>
  );
}

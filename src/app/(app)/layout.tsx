"use client";

import { useEffect, useLayoutEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { useAuth } from "@/components/AuthProvider";
import { ScrollMemory } from "@/components/ScrollMemory";
import { arriveAt, commitArrival } from "@/lib/viewMemory";

// Every page inside (app) requires a signed-in user. Signed-out visitors are
// sent to sign in, then brought back here (e.g. to an invite link).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  // Every commit: records a page visit once it's on screen (see arriveAt below).
  useLayoutEffect(() => commitArrival());

  if (loading || !user) {
    return (
      <div role="status" className="flex flex-1 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-600 dark:border-zinc-700 dark:border-t-emerald-500" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  // Before the page renders, so it reads its state as you left it, or clean.
  arriveAt(pathname);

  return (
    // Animations switch off for people who've asked their device for less motion.
    <MotionConfig reducedMotion="user">
      <ScrollMemory />
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/75 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-600/30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
            </span>
            Expense Manager
          </Link>
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <Image
                src={user.photoURL}
                alt=""
                width={28}
                height={28}
                unoptimized
                referrerPolicy="no-referrer"
                className="rounded-full ring-2 ring-white dark:ring-zinc-900"
              />
            )}
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {/* Each page fades in. Opacity and transform only, so it can't upset ScrollMemory. */}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"
      >
        {children}
      </motion.main>
    </MotionConfig>
  );
}

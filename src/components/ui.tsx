import Image from "next/image";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import type { Group } from "@/lib/types";

const BUTTON_VARIANTS = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950",
};

// Works for both <button> and <Link>.
export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = "primary",
  size: "md" | "sm" = "md",
): string {
  const sizing = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANTS[variant]}`;
}

// No width, for inputs that set their own (e.g. `${inputBaseClass} w-24`).
export const inputBaseClass =
  "h-10 min-w-0 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950";

export const inputClass = `${inputBaseClass} w-full`;

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function Avatar({ name, photoURL, size = 28 }: { name: string; photoURL?: string; size?: number }) {
  if (photoURL) {
    return (
      <Image
        src={photoURL}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Uses the member's real name, not the "You" label, for the initial.
export function MemberAvatar({ group, uid, size }: { group: Group; uid: string; size?: number }) {
  const member = group.members[uid];
  return <Avatar name={member?.name ?? "?"} photoURL={member?.photoURL} size={size} />;
}

const BADGE_TONES = {
  unpaid: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  settled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      ← {children}
    </Link>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") return "You don't have permission to do that.";
    if (error.code === "unavailable") return "You seem to be offline. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

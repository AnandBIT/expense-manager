"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/components/AuthProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import { safeNextPath } from "@/lib/redirect";

// Closing the Google popup is a normal choice, not an error worth showing.
const SILENT_ERRORS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

function destinationAfterSignIn(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(next, window.location.origin);
}

export default function Home() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for signIn() to finish saving the profile before leaving the page.
  useEffect(() => {
    if (user && !signingIn) router.replace(destinationAfterSignIn());
  }, [user, signingIn, router]);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signIn();
    } catch (err) {
      if (err instanceof FirebaseError && SILENT_ERRORS.has(err.code)) return;
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Expense Manager</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Split expenses with your group and see exactly who owes whom.
        </p>

        {isFirebaseConfigured ? (
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading || signingIn || Boolean(user)}
            className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <GoogleIcon />
            {signingIn || user ? "Signing in…" : "Continue with Google"}
          </button>
        ) : (
          <p className="mt-8 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Firebase isn&apos;t configured yet. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and fill in your project&apos;s values (see README).
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

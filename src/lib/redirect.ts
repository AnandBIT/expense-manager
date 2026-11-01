// Where to go after signing in: the `next` path from the sign-in link, but only
// if it stays on this site, so a link can't bounce people elsewhere. It's
// resolved the way the browser will, which also catches tricks like
// "/%09/evil.com" (the parser drops the tab, leaving "//evil.com").
export function safeNextPath(next: string | null, origin: string): string {
  if (next) {
    try {
      const url = new URL(next, origin);
      if (url.origin === origin) return url.pathname + url.search + url.hash;
    } catch {
      // Not a URL at all.
    }
  }
  return "/dashboard";
}

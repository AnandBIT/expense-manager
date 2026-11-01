// How each page looked when you left it (scroll position, open sections, the
// expense sort), so it's the same when you come back to it: with the browser's
// back and forward buttons, or by going up to the page you came from (the "←"
// links). Going into a page (tapping a group, opening an expense) or reloading
// starts it clean. Only kept in memory, so a reload forgets it all.

type Arrival = "back" | "forward" | "fresh";

const views = new Map<string, Map<string, string>>(); // pathname -> key -> value
const trail: string[] = []; // pages visited in this tab, most recent last
const ahead: string[] = []; // pages you went back from, for the forward button
let traversingTo: string | null = null;
// The page being rendered, until React commits the navigation to it.
let arriving: { pathname: string; how: Arrival } | null = null;

// The browser's back or forward button is taking you to `pathname`.
export function noteTraversal(pathname: string): void {
  traversingTo = pathname;
}

// The "←" links go up: to the dashboard at the top, or to a page whose
// address this one's extends (a group from its expense, for example).
function isUp(from: string, to: string): boolean {
  return to === "/dashboard" || from.startsWith(`${to}/`);
}

function arrival(pathname: string): Arrival | null {
  const current = trail.at(-1);
  if (current === pathname) return null;
  const traversal = traversingTo === pathname;
  if (current !== undefined && trail.at(-2) === pathname && (traversal || isUp(current, pathname))) {
    return "back";
  }
  if (traversal && ahead.at(-1) === pathname) return "forward";
  return "fresh";
}

// The signed-in layout calls this while rendering a page, so the page's first
// render reads the right state. It only looks: React can throw a render away,
// so the visit is recorded by commitArrival once it's on screen.
export function arriveAt(pathname: string): void {
  const how = arrival(pathname);
  arriving = how ? { pathname, how } : null;
}

// The signed-in layout calls this after each commit.
export function commitArrival(): void {
  if (!arriving) return;
  const { pathname, how } = arriving;
  arriving = null;
  traversingTo = null;
  if (how === "back") {
    ahead.push(trail.pop()!);
  } else if (how === "forward") {
    ahead.pop();
    trail.push(pathname);
  } else {
    trail.push(pathname);
    views.delete(pathname);
    ahead.length = 0;
  }
}

export function recall(pathname: string, key: string): string | undefined {
  if (arriving?.pathname === pathname && arriving.how === "fresh") return undefined;
  return views.get(pathname)?.get(key);
}

// null forgets the key.
export function remember(pathname: string, key: string, value: string | null): void {
  const view = views.get(pathname) ?? new Map<string, string>();
  if (value === null) view.delete(key);
  else view.set(key, value);
  views.set(pathname, view);
}

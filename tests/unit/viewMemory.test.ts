import { beforeEach, describe, expect, it, vi } from "vitest";

// viewMemory keeps module-level state, like the open tab it stands for; a
// fresh import per test is a fresh tab.
let memory: typeof import("../../src/lib/viewMemory");
beforeEach(async () => {
  vi.resetModules();
  memory = await import("../../src/lib/viewMemory");
});

const DASHBOARD = "/dashboard";
const GROUP = "/groups/g1";
const EXPENSE = "/groups/g1/expenses/e1";

// A navigation as the layout sees it: rendered, then committed.
function go(pathname: string) {
  memory.arriveAt(pathname);
  memory.commitArrival();
}
// The same, by the browser's back or forward button.
function traverse(pathname: string) {
  memory.noteTraversal(pathname);
  go(pathname);
}

describe("viewMemory", () => {
  it("keeps a page as you left it when you go back to it", () => {
    go(DASHBOARD);
    go(GROUP);
    memory.remember(GROUP, "scroll", "640");
    memory.remember(GROUP, "open:day:2026-10-17", "1");
    go(EXPENSE);
    go(GROUP); // the "←" link
    expect(memory.recall(GROUP, "scroll")).toBe("640");
    expect(memory.recall(GROUP, "open:day:2026-10-17")).toBe("1");
  });

  it("starts a page clean when you arrive from somewhere else", () => {
    go(DASHBOARD);
    go(GROUP);
    memory.remember(GROUP, "open:day:2026-10-17", "1");
    go(DASHBOARD); // "← All groups"
    go(GROUP); // then tapping the group again
    expect(memory.recall(GROUP, "open:day:2026-10-17")).toBeUndefined();
  });

  it("starts a group clean when you go up to All groups and tap it again", () => {
    go(GROUP); // opened directly, or after a reload
    memory.remember(GROUP, "open:day:2026-10-17", "1");
    go(DASHBOARD); // "← All groups"
    go(GROUP); // tapping the group: going down, not back
    expect(memory.recall(GROUP, "open:day:2026-10-17")).toBeUndefined();
  });

  it("keeps the group if the browser's back button returns to it", () => {
    go(GROUP);
    memory.remember(GROUP, "scroll", "640");
    go(DASHBOARD); // "← All groups"
    traverse(GROUP); // then the browser's back button
    expect(memory.recall(GROUP, "scroll")).toBe("640");
  });

  it("keeps the page you went back from for the forward button", () => {
    go(GROUP);
    go(EXPENSE);
    memory.remember(EXPENSE, "scroll", "300");
    traverse(GROUP); // back
    traverse(EXPENSE); // forward
    expect(memory.recall(EXPENSE, "scroll")).toBe("300");
  });

  it("starts an expense clean when you open it again from its group", () => {
    go(GROUP);
    go(EXPENSE);
    memory.remember(EXPENSE, "scroll", "300");
    go(GROUP); // "←"
    go(EXPENSE); // opened again: going down
    expect(memory.recall(EXPENSE, "scroll")).toBeUndefined();
  });

  it("reads a fresh page as clean while it renders, before the visit is recorded", () => {
    go(GROUP);
    go(DASHBOARD);
    memory.remember(GROUP, "open:day:2026-10-17", "1"); // left over from before
    memory.arriveAt(GROUP); // rendering, going down
    expect(memory.recall(GROUP, "open:day:2026-10-17")).toBeUndefined();
  });

  it("changes nothing for a render that never commits", () => {
    go(DASHBOARD);
    go(GROUP);
    memory.remember(GROUP, "scroll", "640");
    go(EXPENSE);
    memory.arriveAt("/groups/g1/settings"); // a render React threw away
    go(GROUP); // then the "←" link
    expect(memory.recall(GROUP, "scroll")).toBe("640");
  });

  it("goes back more than one step", () => {
    go(DASHBOARD);
    memory.remember(DASHBOARD, "scroll", "120");
    go(GROUP);
    memory.remember(GROUP, "scroll", "640");
    go(EXPENSE);
    go(GROUP);
    go(DASHBOARD);
    expect(memory.recall(DASHBOARD, "scroll")).toBe("120");
  });

  it("ignores the same page rendering again", () => {
    go(GROUP);
    memory.remember(GROUP, "view", "sort=amount");
    go(GROUP);
    expect(memory.recall(GROUP, "view")).toBe("sort=amount");
  });

  it("forgets a key set to null", () => {
    go(GROUP);
    memory.remember(GROUP, "open:person:bob", "1");
    memory.remember(GROUP, "open:person:bob", null);
    expect(memory.recall(GROUP, "open:person:bob")).toBeUndefined();
  });

  it("forgets everything on a reload", async () => {
    go(GROUP);
    memory.remember(GROUP, "scroll", "640");
    vi.resetModules();
    const reloaded = await import("../../src/lib/viewMemory");
    expect(reloaded.recall(GROUP, "scroll")).toBeUndefined();
  });
});

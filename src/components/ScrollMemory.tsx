"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { noteTraversal, recall, remember } from "@/lib/viewMemory";

// How long to wait for a page's data to make it tall enough to scroll back to.
const RESTORE_TIMEOUT_MS = 10_000;

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

// Scrolls back to where you were when you return to a page (see viewMemory);
// a page you arrive at afresh starts at the top. Pages load their data after
// they appear, so it waits until the page is tall enough.
export function ScrollMemory() {
  const pathname = usePathname();

  useEffect(() => {
    // Otherwise the browser restores scroll on back before the page has its
    // data, while it's still too short, and lands at the top.
    history.scrollRestoration = "manual";
    // Fires before Next renders the page back/forward goes to.
    const onPopState = () => noteTraversal(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // A layout effect, so the old page stops saving during the commit, before
  // Next scrolls the new page into view. A plain effect can still be listening
  // then, and record the new page's scroll as the old page's.
  useLayoutEffect(() => {
    const target = Number(recall(pathname, "scroll")) || 0;
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    let restoring = true;
    let frame = 0;

    const observer = new ResizeObserver(tryRestore);
    const timeout = setTimeout(() => stopRestoring(true), RESTORE_TIMEOUT_MS);

    function tryRestore() {
      if (restoring && maxScroll() >= target) {
        window.scrollTo(0, target);
        stopRestoring(false);
      }
    }

    // `closest`: the page never got tall enough, so go as near as it allows.
    function stopRestoring(closest: boolean) {
      if (!restoring) return;
      restoring = false;
      if (closest) window.scrollTo(0, Math.min(target, maxScroll()));
      observer.disconnect();
      clearTimeout(timeout);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onUserScroll);
      window.removeEventListener("keydown", onKey);
    }

    // You started scrolling yourself, so leave the page where you put it. Taps
    // and clicks don't count, nor do the sideways wheel events a trackpad's
    // swipe-back gesture leaves behind.
    function onUserScroll() {
      stopRestoring(false);
    }
    function onWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) stopRestoring(false);
    }
    function onKey(event: KeyboardEvent) {
      if (SCROLL_KEYS.has(event.key)) stopRestoring(false);
    }

    // Not while restoring, so the brief loading screen can't overwrite it.
    function save() {
      if (restoring || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        remember(pathname, "scroll", String(Math.round(window.scrollY)));
      });
    }

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", save, { passive: true });
    observer.observe(document.body);
    // After Next has done its own scrolling for this navigation.
    const firstTry = requestAnimationFrame(tryRestore);

    return () => {
      stopRestoring(false);
      cancelAnimationFrame(firstTry);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
    };
  }, [pathname]);

  return null;
}

# Lessons

## 2026-11-02: Scroll memory passed tests but failed in real use
- **What happened.** The browser tests used Playwright's programmatic `goBack()` against a fast local emulator. In real use there's real Firebase (slower), clicks and taps while the page loads, and the trackpad swipe-back. The restore was cancelled by *any* click, touch or wheel event, so on real data it landed at the top.
- **Rule.** Test UI behaviour the way a person drives it:
  - real input (a click or tap while loading, trackpad swipes with trailing events),
  - realistic latency (throttle the network),
  - not only programmatic navigation on localhost.
- **Rule.** When user input should interrupt automation, be specific about which input: only the input that conflicts (vertical scrolling), not every click.

## 2026-11-02: Dropdowns stayed open after a reload or a fresh visit
- **What happened.** Open/closed state lived in sessionStorage keyed by group, so it survived reloads and fresh visits (All groups → tap the group). The user meant "when I come back to where I was", not "remember forever".
- **Rule.** When asked to preserve UI state, pin down the scope: coming back only, every visit, or across reloads. Default to the narrowest: going back (browser back, or up via "←") to the page just left, kept in memory.
- **Rule.** "Coming back" has a direction. Going up to the page you came from is a return. Going down into a page is a fresh visit, even if it's the page you were just on.

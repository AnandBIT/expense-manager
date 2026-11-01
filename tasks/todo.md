# Group management, expense sorting/accordion, balance details, lighter dashboard

Full plan: ~/.claude/plans/enchanted-tinkering-lollipop.md

## Phase 0 — environment
- [x] Restore the lockfile (backup in scratchpad) and `npm ci`
- [x] Baseline green: lint, tsc, unit tests (22), rules tests (26, JDK 23 on PATH)

## Phase 1 — UI only
- [x] Dashboard: group name · members · currency only (no expense listeners)
- [x] `ExpenseShares` + `DebtStatusBadge` shared by the expense page and the balance dropdown
- [x] Your balances: collapse per person, read-only details dropdown per expense
- [x] `src/lib/expenseList.ts` (sort + sections) with unit tests
- [x] `ExpenseList`: sort select + accordion toggle, kept in the URL
- [x] Verify Phase 1: tsc 0, lint 0, unit 29/29, build OK (group route is dynamic, so no Suspense needed)

## Phase 2 — group management
- [x] Types: `deletion`; `members` keeps former members
- [x] Rules: leave, remove (+ invite rotation), rename, reset, deletion request/approve/cancel/delete, expense freeze, invites
- [x] Rules tests for all of the above (49/49; mutation check: removing 4 guards fails exactly the 4 matching tests)
- [x] `groups.ts`: write functions, `finishDeletion`, `memberName` "(left)", `watchGroup` missing-doc fix
- [x] Settings page, `InviteLink`, `DeletionBanner`, group page + dashboard + join page updates
- [x] README
- [x] Verify Phase 2 (lint, tsc, unit + rules tests, build, end-to-end run on emulators)

## Added mid-way (user request)
- [x] Optional notes on an expense: form, rules (+ tests), expense page and details panel
- [x] Expenses card: clicking a row opens the same read-only breakup as Your balances (shared `ExpenseDetails`)

## Known bugs from the first review
- [x] Open redirect: `?next=/%09/evil.com` passes the old check and leaves the site after sign-in
- [x] "Settled" badge on expenses nobody owes anything on (`isFullySettled` of no debts was true)
- [x] Amounts over the rules' cap fail with a misleading "permission" error; catch them in the form
- [x] Invite "Copy" throws on plain http (no `navigator.clipboard`), e.g. a phone on the LAN
- [x] Verify: unit 34/34 (5 new), tsc/lint 0, build OK, browser run 8/8 checks with 0 errors

## Scroll memory + polished, animated UI
- [x] Install `motion`; `session.ts`, `useRememberedOpen`, `ScrollMemory`
- [x] `Collapse`, `SegmentedControl`, `Switch`
- [x] Your balances + Expenses: animated collapses with remembered open state; sort pill + group switch; reorder animation
- [x] Polish: ui.tsx primitives, app shell (sticky blurred header, page fade), dashboard cards, banner, Copied, badges
- [x] Verify: tsc/lint 0, unit 34/34, build OK; full browser flow passed 3 runs in a row (0 errors), light + dark screenshots reviewed

**Notes:**
- **Scroll bugs found by the browser run:**
  - Race: Next scrolls the new page before a plain `useEffect` detaches, so it could overwrite the old page's saved position. Fixed with `useLayoutEffect`, plus the first restore attempt on the next frame.
  - The "←" links drop the URL's query, so the Expenses view now falls back to the last one used in the tab.
- **npm 11.6 lockfile bug:** `npm install <pkg>` strips the optional platform builds of peer packages (rolldown, which vitest needs), and `libc` tags. The lockfile was repaired by putting those entries back from HEAD unchanged. The diff is now purely additive, and `npm ci` keeps it.

## Switch to Yarn 1 (user preference)
- [x] `vite` added as a devDependency. vitest needs it as a peer; npm installed it automatically, Yarn doesn't.
- [x] `yarn.lock` converted from `package-lock.json` with the same versions.
  - `yarn import` can't read npm's v3 lockfile, and its node_modules mode re-resolved about 130 packages.
  - So a converter followed npm's layout for every range. Result: all 1,069 versions identical, plus two WebAssembly-only packages npm never had a fitting copy of.
- [x] `package.json` sets `"packageManager": "yarn@1.22.22"`; `package-lock.json` removed and ignored by git.
- [x] Updated to Yarn: README commands, `scripts/with-emulators.mjs` (`yarn firebase`), comments.
- [x] Verify: frozen install from scratch with no warnings; `yarn test` 34/34, tsc/lint 0, `yarn build` OK, `yarn test:rules` 51/51, `yarn dev:local` plus the full browser flow, 0 errors.

## Scroll memory fixes (user report: back landed at the top; dropdowns stuck open)
- [x] Reproduced: a click or tap while the page loads cancelled the restore (667 → 0). On real Firebase, loading is slow enough for this to happen.
- [x] Restore now stops only on real scrolling: a vertical wheel, a finger drag, or scroll keys. The timeout is 10s.
- [x] View state moved from sessionStorage to memory (`src/lib/viewMemory.ts`), tied to *coming back*:
  - The browser's back button, or a link up to the page you came from (the "←" links), restores it.
  - Going down into a page, or reloading, starts clean.
- [x] Verified:
  - Unit tests 43/43 (9 new for viewMemory).
  - Five scroll scenarios pass: back, swipe, slow network, slow network with a swipe, a click while loading.
  - The full flow passed twice with 0 errors, including the new "All groups → group" and reload checks.

## Bug hunt (user: "if there are any more bugs, fix them yourself")
A code review of the whole diff since the initial commit found 9 findings. Each was checked against the code.

**Fixed (7):**
- [x] Group frozen after everyone approved deletion: payment, edit, delete and add buttons failed with a permission error. They're now read-only or hidden, with a reason.
- [x] `finishDeletion` failed if the group was already gone (two people finishing, or a retry). It now treats that as done.
- [x] `arriveAt` changed shared state during render, which React can discard. Render now only looks; `commitArrival` records the visit in a layout effect.
- [x] Group deletion deleted expenses one commit each. It now uses batches of 10, with a rules test proving a 10-delete batch is allowed.
- [x] Dashboard badge said "waiting for others" when everyone had approved. It now says to open the group and finish.
- [x] Joining with a link that was reset meanwhile said "can't take new members". It now says the link expired.
- [x] The browser's forward button reopened pages fresh. Pages you went back from are now remembered for forward.

**Left as is (2):**
- Any member can remove any other: the trade-off the user approved; fixing it needs an admin role.
- `handleDelete` duplicating `useAction`: code style, not a bug.

**Verified:**
- tsc and lint 0, unit 46/46, rules 52/52, build OK.
- Five scroll scenarios pass, and the full flow passed twice with 0 errors. The flow now also covers the expired link and the frozen group.

## Review

**Final checks:**
- `npx tsc --noEmit` and `npm run lint` exit 0.
- `npm test`: 29/29.
- `test:rules`: 51/51.
- `npm run build` OK, including the new `/groups/[groupId]/settings` route.

**End-to-end run:**
- A headless Chrome (playwright-core in the scratchpad) drove the real app against the emulators: 4 users, 50 checks, 0 browser errors.
- It covered:
  - Sorting and the per-day accordion with totals, and the view surviving back-navigation.
  - Inline breakups with notes.
  - The balance collapse and its read-only dropdown.
  - Renaming, which also shows on the join page.
  - Resetting the link: the old one becomes invalid.
  - Removing a member: blocked while they're unsettled, and it resets the link.
  - Leaving.
  - Deleting the group: reject, then approve → nothing left in Firestore.
- Run it with the test server on :3001, because a `next dev` was already running on :3000: build with `NEXT_PUBLIC_USE_EMULATORS=true next build`, then `with-emulators … "next start -p 3001"`. Afterwards `.next` was rebuilt with the normal config.

**Things to know:**
- `firestore.rules` must be published to the real project, or the new features will be refused there.
- Rules can't scan expenses, so "settled up before leaving/removal" is enforced by the app only, like share totals.
- Because any member can remove anyone, a member could remove everyone else (once they're settled up) and then delete alone. Closing that needs an admin role.

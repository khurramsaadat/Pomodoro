# PRD — Pomodoro timer

> The overall view of the app: what it is, what it must do, and what it must
> never do.
> Companions: [`input.md`](./input.md) (prompts), [`plan.md`](./plan.md) (stages),
> [`suggest.md`](./suggest.md) (next steps).

---

## 1. What this is

A **Pomodoro timer** for focused work. It runs as a native Tauri v2 desktop
app and as a standalone static web app from one source tree, so the same build
serves both.

The app answers one question well — *how long until my next break?* — and
records the answer so the user can see whether the method is working.

## 2. Who it is for

**The deep worker.** Works for long stretches, wants the timer visible
without navigating, and wants it out of the way when it is not needed.

**The tracker.** Wants to know what they actually worked on and whether they
kept the streak, not just that a timer ran.

**The reviewer.** Checks the timer occasionally. For them the only critical
thing is that the number is *right* — a timer that silently stops is worse
than no timer at all.

## 3. Goals

| # | Goal | Why it matters |
|---|------|----------------|
| G1 | The countdown is visible without navigating | Checking the timer must not cost focus |
| G2 | The timer is trustworthy | It must never drift, stall, or be wrong |
| G3 | The clock is permanent | A clock that can be unmounted is a clock that can disappear |
| G4 | Work is attributed to tasks | Progress is real progress, not guesswork |
| G5 | The numbers can be recomputed | History is append-only, so the stats are never a guess |
| G6 | It runs everywhere | Web and desktop from one source tree |

## 4. Functional requirements

### 4.1 The timer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Focus, short break, and long break phases on a configurable cycle | Must |
| FR-2 | Session lengths are configurable in minutes; the engine works in ms | Must |
| FR-3 | The countdown is derived from an absolute deadline, never a counter | Must |
| FR-4 | Start, pause, reset, and skip are always available | Must |
| FR-5 | A skipped focus session is void — it counts towards nothing | Must |
| FR-6 | Breaks and focus sessions can auto-start | Should |
| FR-7 | A long break is earned every *N* completed focus sessions | Must |
| FR-8 | Phases that elapsed while the app was closed are replayed on load | Must |
| FR-9 | The clock sits permanently in a left-hand column | Must |
| FR-10 | Every other element sits in a right-hand workspace column | Must |
| FR-11 | Changing the workspace tab never unmounts the clock | Must |
| FR-12 | Below `lg`, the columns stack with the clock first | Must |
| FR-13 | A draggable mini timer can dock in a viewport corner | Must |
| FR-14 | The mini timer shares the one timer — it holds no countdown of its own | Must |
| FR-15 | The mini timer's corner and offset survive a reload and a resize | Must |
| FR-16 | The footer is a single line and carries `© 2006 Khurram` | Must |

### 4.2 Tasks

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17 | A task has a title, an estimate in focus sessions, and a completed count | Must |
| FR-18 | One task is active at a time | Must |
| FR-19 | A completed focus session is credited to the active task | Must |
| FR-20 | `autoAdvanceTask` moves to the next open task once an estimate is met | Should |

### 4.3 History and statistics

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-21 | Completed phases are appended to an immutable log | Must |
| FR-22 | The daily goal, streak, per-day totals, and per-task breakdown are derived from that log | Must |
| FR-29 | The streak counts consecutive *calendar* days, across daylight-saving changes | Must — **not yet met** |
| FR-23 | Interruptions are recorded and reported | Must — **not yet met** |

### 4.4 Preferences

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | The daily goal is configurable | Must |
| FR-25 | `soundEnabled` gates the completion chime | Must |
| FR-26 | `showCompletedTasks` controls queue visibility | Must |
| FR-27 | `confirmBeforeClearing` guards the destructive actions | Must |
| FR-28 | `autoAdvanceTask` has a settings toggle | Should |
## 5. Non-functional requirements

| ID | Requirement | How it is met |
|----|-------------|---------------|
| NFR-1 | No `any`, no non-null assertions outside tests | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| NFR-2 | The domain layer is pure — no React, DOM, or Tauri imports | `src/domain/**` is plain functions over plain data, exhaustively unit-tested |
| NFR-3 | The web build contains no Tauri code | `@tauri-apps/api` may only be imported dynamically inside `src/platform/tauri.ts` |
| NFR-4 | A corrupt or outdated payload can never crash the app | Every payload carries a schema version and is validated on read |
| NFR-5 | Storage failures must not break the app | The repository never throws; every operation degrades to a no-op |
| NFR-6 | The countdown must survive browser throttling | `endsAt` is stored; `remaining` is derived from `Date.now()` |
| NFR-7 | State is never mutated in place | Immutable updates, so React and zustand can diff correctly |
| NFR-8 | Every control is keyboard accessible | Real `<button>` elements with accessible names |
| NFR-9 | The layout works from 320 px up to a wide desktop | Responsive Tailwind breakpoints; no fixed-width assumptions |
| NFR-10 | A grid child can never force a horizontal scrollbar | `minmax(0, ...)` tracks and `min-w-0` on flexible columns |

## 6. Architecture

```
src/
  domain/     pure logic - no React, no DOM, no Tauri    (unit-tested)
  platform/   the web/desktop seam (PlatformBridge)      [Phase 5]
  storage/    versioned, validated localStorage repositories
  store/      zustand stores
  hooks/      custom hooks
  lib/        time formatting, Web Audio chime, persistence
  components/ layout . ui . mini . timer . tasks . stats . settings
src-tauri/    Rust backend: commands, tray, window events [Phase 5]
```

**Three separations carry the design:**

1. **The engine is deadline-based.** `endsAt` is the single source of truth;
   `remaining` is always derived. A throttled tab cannot lose time.
2. **The engine is lifecycle-independent.** It lives above the tab boundary,
   so no tab can stop the countdown.
3. **The history is append-only.** Every statistic is recomputed from the log,
   so the numbers can always be audited.

## 7. Success metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test coverage | Every acceptance criterion has a test | **Met** - 220 tests / 17 files |
| Tests, typecheck, lint, build | All green | **Met** |
| Console errors in the browser | 0 | **Met** - light and dark mode |
| The clock is ever unmounted | 0 occurrences | **Met** - verified in-browser |
| The mini timer disagrees with the main panel | 0 disagreements | **Met** - by construction and by test |
| A corrupt payload crashes the app | 0 occurrences | **Met** - validated on read |

## 8. Out of scope

- Any second, independent timer. The brief is explicit: the mini timer
  *shares* the main one.
- Changing the Pomodoro method itself - durations, break structure, and the
  skip rules are the user's to configure, not the app's to reinterpret.
- Accounts, sync, or a server. The app is local-first; the history lives on
  the device.
- Phase 5 - the Tauri native tier - is designed for but not yet built.

## 9. Release notes

**Suggestion review**

- Audited every entry in `suggest.md` against the source. Two standing
  suggestions had already been implemented — the reduced-motion preference is
  honoured in `src/index.css`, and `autoAdvanceTask` is live in the timer
  store — and were replaced with fresh ones.
- The record now separates *correctness first* from the enhancements, and
  lists four defects that were previously unrecorded: the daylight-saving
  streak bug, the always-zero "Interruptions" metric, the ineffective
  "Reset session" button, and the estimated "Focus time" in the session
  summary.
- No application behaviour changed. The defects are recorded, not yet fixed.

**Dashboard layout**

- Restructured the app into a two-column dashboard: the clock is permanently
  on the left, the tabbed workspace on the right.
- The clock moved **outside** the tab boundary, so switching tabs can never
  take the countdown off the screen.
- The "Focus" tab became "Session" - it now holds only the session settings.
- The footer is a single line carrying `© 2006 Khurram`.

**Mini mode (`3c0f7e6`)**

- Added a draggable mini timer that docks in a viewport corner, with
  start/pause and close controls, and a header toggle to open it.
- Fixed a structural bug: the timer engine was being unmounted with the tab,
  so the countdown stopped whenever the user visited Tasks or Stats.
- Placement is stored as a corner plus an offset, so it stays anchored across
  resizes and survives a reload.
- Wired up two preferences that were declared but never used: `soundEnabled`
  and `autoAdvanceTask`.

**Task queue, history, statistics (`3670f69`)**

- Added the task queue, the append-only session history, the statistics
  derived from it, and the preferences panel.

**Core engine (`5a9727d`)**

- The deadline-based Pomodoro engine, the countdown ring, the controls, the
  session settings, the chime, and the catch-up that replays phases that
  elapsed while the app was closed.

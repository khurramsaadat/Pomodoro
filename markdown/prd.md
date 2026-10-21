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

### 4.1a The native tier

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-40 | The app runs natively as a Tauri v2 desktop app from the same source tree | Must |
| FR-41 | The web build contains no Tauri code; the runtime is loaded only when it is present | Must |
| FR-42 | A system-tray icon shows the live timer and offers start/pause, show, and quit | Must |
| FR-43 | Closing the window ends the app — the tray is a control panel, not a hiding place | Must |
| FR-44 | A global shortcut starts and pauses the timer from any application | Must |
| FR-45 | A phase that ends while the window is in the background still notifies **on time** | Must |
| FR-46 | The native alarm is scheduled against the timer's own deadline, never a duration | Must |
| FR-47 | A second launch focuses the running app rather than starting a second timer | Must |
| FR-48 | The web tier offers no affordance the browser cannot honour | Must |
| FR-49 | The window can be kept above the others, and the choice is persisted | Must |

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
| FR-29 | The streak counts consecutive *calendar* days, across daylight-saving changes | Must — **met** |
| FR-23 | Interruptions are recorded and reported | Must — **met** |

### 4.4 Preferences

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | The daily goal is configurable | Must |
| FR-25 | `soundEnabled` gates the completion chime | Must |
| FR-26 | `showCompletedTasks` controls queue visibility | Must |
| FR-27 | `confirmBeforeClearing` guards the destructive actions | Must |
| FR-28 | `autoAdvanceTask` has a settings toggle | Should — **met** |
| FR-30 | The active task and the daily goal sit above the tabs, the daily goal under the task | Must — **met** |
| FR-31 | A task's title and estimate can be edited after it is added | Should — **met** |
| FR-32 | The session log is visible in the UI | Should — **met** |
| FR-33 | The timer has keyboard shortcuts | Should — **met** |
| FR-34 | The web build installs and works offline | Should — **met** |
| FR-35 | The completion sound is chosen from a catalogue, and each one can be previewed | Must — **met** |
| FR-36 | The completed tasks are a section of their own, not a tail of the queue | Must — **met** |
| FR-37 | The session log comes before the statistics derived from it | Must — **met** |
| FR-38 | The whole workspace can be exported to a file and restored from one | Must — **met** |
| FR-39 | An imported backup is validated; an unreadable one is refused and a damaged one is reported | Must — **met** |

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
  platform/   the web/desktop seam (PlatformBridge)
  storage/    versioned, validated localStorage repositories
  store/      zustand stores
  hooks/      custom hooks
  lib/        time formatting, Web Audio chime, persistence
  components/ layout . ui . mini . timer . tasks . stats . settings
src-tauri/    Rust backend: commands, tray, alarm, window events
```

**Four separations carry the design:**

1. **The engine is deadline-based.** `endsAt` is the single source of truth;
   `remaining` is always derived. A throttled tab cannot lose time.
2. **The engine is lifecycle-independent.** It lives above the tab boundary,
   so no tab can stop the countdown.
3. **The history is append-only.** Every statistic is recomputed from the log,
   so the numbers can always be audited.
4. **The tiers meet at one seam.** `src/platform` is the only place that
   knows whether the app is in a browser or a desktop window. Everything
   above it calls the `PlatformBridge` and never asks which tier it is on.

## 7. Success metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test coverage | Every acceptance criterion has a test | **Met** - 283 tests / 24 files, plus 6 Rust tests |
| Tests, typecheck, lint, build | All green | **Met** |
| Console errors in the browser | 0 | **Met** - light and dark mode |
| The clock is ever unmounted | 0 occurrences | **Met** - verified in-browser |
| The mini timer disagrees with the main panel | 0 disagreements | **Met** - by construction and by test |
| A corrupt payload crashes the app | 0 occurrences | **Met** - validated on read |
| The web build loads Tauri code | 0 chunks | **Met** - code-split, verified in the bundle |
| A native affordance appears in the browser | 0 | **Met** - the web tier reports no native capability |

## 8. Out of scope

- Any second, independent timer. The brief is explicit: the mini timer
  *shares* the main one.
- Changing the Pomodoro method itself - durations, break structure, and the
  skip rules are the user's to configure, not the app's to reinterpret.
- Accounts, sync, or a server. The app is local-first; the history lives on
  the device.
- A mobile build. The Tauri scaffold can target Android and iOS, but the
  native tier here is desktop-only: a tray and a global shortcut have no
  meaning on a phone.

## 9. Release notes

**Always on top, and the end of hide-to-tray**

- The window can now be **kept above the other windows**. The choice is a
  preference, so it is persisted, and it is offered in the header and in the
  preferences panel. A timer the user has to go looking for is a timer whose
  deadline they will miss.
- **Closing the window now ends the app.** It used to hide to the tray
  instead, which meant a program that survived its own close button — a
  program the user could not get rid of. The tray is still there, and it is
  still useful: it shows the live timer and offers *Show*, *Start / pause*
  and *Quit*. It is a control panel now, not a hiding place.
- The web tier **does not offer the always-on-top control at all**: a
  browser tab has no z-order, and a switch that does nothing is a lie.
- The mini timer is still always on top — it is a floating thing — but
  **leaving mini mode restores the window to the state the user asked
  for** rather than forcing it down.

**Completion sounds the user can choose**

- The completion cue is no longer a fixed two-note chime. It is a **stack** —
  a body tone, a partial above it, and, for the struck sounds, a short
  burst of noise that is the *transient* — in **five distinct shapes**:
  Chime, Bell, Marimba, Pulse and Digital.
- The sound is a **preference**, chosen in the settings panel, and every
  option can be **previewed**. A sound the user has never heard is a sound
  they cannot choose between.
- A finished **break** plays the next voice along from the chosen one, so
  the two phases are audibly different without a second setting.

**Showing what has been done**

- The **completed tasks are a section of their own**, under the open queue,
  rather than a tail of the same sorted list where they were below the fold.
- The **recent sessions come before the statistics** in their tab. The
  statistics are derived from the log, so the thing they are derived from
  should be the thing that is read first — and the log card is the one that
  was below the fold at laptop heights.

**Backups**

- The whole workspace — the task queue, the session history, the
  preferences and the session settings — can be **exported to a file** and
  **restored from one**, from the preferences panel.
- An imported backup is **validated against the same rules as a stored
  payload**. A file that cannot be read is refused outright; a file that
  can be read but has damage in it is restored as far as it goes, and the
  damage is reported. A silent partial restore would be worse than a
  refusal, because the user would not know what did not survive.
- The backup format **carries a version**, so a file written by a different
  build is recognised and refused rather than half-read.

**The native tier (`Phase 5`)**

- The app now runs as a **native Tauri v2 desktop app** from the same source
  tree, and the web build is untouched by it.
- A **system tray** shows the live timer. Its tooltip is the countdown, its
  menu offers *Show*, *Start / pause* and *Quit*, and a double click brings
  the window forward.
- **Closing the window ends the app.** A timer that stopped when its window
  closed could not be trusted to be there when the break was due — which is
  why the window can now be pinned above the others instead.
- A **global shortcut** (`Ctrl+Shift+Space`) starts and pauses the timer from
  any application, so the app can be driven without being on screen.
- A phase that ends while the window is in the background now **notifies on
  time**. The native alarm is scheduled against the timer's own deadline —
  the same `endsAt` the countdown is drawn from — so it is not a second
  opinion about when the phase ends, it is the same fact.
- A **second launch focuses the running app** rather than starting a second
  timer, which would have doubled every statistic.
- The **web tier is honest about itself**: the tray button and the global
  shortcut are simply absent in a browser, and the Tauri runtime is loaded
  only when it is actually there.
- The app **installs as a desktop application** — an NSIS installer and an
  MSI — and a second launch focuses the running app rather than starting a
  second timer.
- On Windows the app **registers itself with the notification system**, so
  a toast carries the app's name and icon rather than an anonymous one.

**The four defects, repaired (`1a1cbe0`)**

- **The streak counts calendar days.** It walked back by a fixed
  86 400 000 ms per day, which visited one day twice and skipped another
  across a daylight-saving boundary. The chart's seven-day window had the
  same bug and was fixed with it. A regression test pins the time zone to
  `America/New_York`, because the bug is invisible in UTC.
- **"Interruptions" can now be non-zero.** Skipping a focus session that
  had begun voids it: the session is written to the history as a voided
  entry, which is excluded from every count of completed sessions but
  counted as an interruption. A phase that never started is not voided.
- **"Reset session" now resets something visible.** The session count, the
  focus time and the interruption count are all cleared with the cycle. The
  history is untouched — the log is append-only.
- **"Focus time" is a measurement, not an estimate.** The measured duration
  of each focus phase is banked as it completes, so the summary no longer
  changes when the focus length does. A snapshot written by an earlier
  build is repaired on read.

**The improvements (`f3ce6f9`)**

- The clock column now shows the **active task** — its title, its progress
  against the estimate — and the **daily goal** as a bar, both without a tab
  switch.
- The `autoAdvanceTask` preference has the settings toggle its behaviour
  always deserved.
- A task's **title and estimate can be edited** in place, so a rough guess
  can be corrected without losing the task's history.
- The **session log is visible**, with an abandoned session marked as
  abandoned.
- **Keyboard shortcuts**: space or K to start and pause, the arrow keys or
  J and L to skip and reset, documented in a dialog rather than left to be
  guessed. They are ignored while a text field has the focus.
- The web build is **installable and works offline** through a service
  worker.
- Four unused Radix packages are dropped, and the two that were only
  declared — progress and dialog — are now genuinely used.

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

**Dashboard layout**

- Restructured the app into a two-column dashboard: the clock is permanently
  on the left, the tabbed workspace on the right.
- The clock moved **outside** the tab boundary, so switching tabs can never
  take the countdown off the screen.
- The "Focus" tab became "Session" - it now holds only the session settings.
- The footer is a single line carrying `© 2006 Khurram`.

**The dashboard's balance, and a mini timer that replaces it**

- **The mini timer now replaces the dashboard rather than covering it.** The
  old behaviour drew a small widget over a full-size dashboard, which left
  the user looking at two timers. Opening the mini timer now removes the
  dashboard on both tiers.
- **The native tier's own window becomes the mini timer.** The desktop app's
  window is made frameless, always-on-top and 240 by 150, and placed in the
  corner it was left in. The dashboard is gone because the window that held
  it is gone, and the operating system moves the widget rather than the page
  dragging it.
- **The empty space is filled with the session plan** - the phases ahead,
  derived from the configuration. It sits below the tabs, because it is true
  whichever tab is open.
- **The clock column was compacted**: the session summary, the active task and
  the daily goal are single rows rather than stacked blocks, and the countdown
  ring is smaller. The column went from 1081 pixels to 827.
- **Fixed a scale bug in the native window.** The window was sized in physical
  pixels *and* multiplied by the display's scale factor, so a 240-pixel timer
  arrived on screen as 156 on a scaled display. Measurements now cross the
  platform seam in physical pixels, and the conversion is done by the webview,
  which knows the display's real ratio.

**Moving "working on" and the daily goal**

- **The active task and the daily goal moved out of the clock column and above
  the tabs.** The clock column now holds only the timer and the session
  summary; the two cards that answer *what am I working on* and *how far have I
  got today* sit in the workspace column, with the daily goal directly under
  the task.
- **The clock column was compacted twice over.** The task and the goal left
  it, and the cards that moved were also tightened: the `Card` primitive's own
  vertical padding was doubling up with the content's, so a two-line card was
  rendering as 131 pixels tall instead of 83.
- The two cards read as a pair because they are one: the task is the *what* and
  the goal is the *how far*, and both are true whichever tab is open.

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

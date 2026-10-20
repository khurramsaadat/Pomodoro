# Plan - stagewise implementation

> What was built, in the order it was built, and why that order.
> Companions: [`input.md`](./input.md) (prompts), [`prd.md`](./prd.md) (requirements),
> [`suggest.md`](./suggest.md) (next steps).

---

## Stage 1 - The shell

**Commit:** `3347fb4`

Vite + React + TypeScript + Tailwind v4, ESLint, Prettier, Vitest, and the
shadcn/ui primitive set. The app shell, the theme provider, and the light and
dark themes.

**Why first:** everything else needs a place to live, and the theme decision
has to be made before any component is written, not after.

---

## Stage 2 - The core engine

**Commit:** `5a9727d`

The pure timer engine in `src/domain/timer.ts`, the deadline-based hook, the
countdown ring, the controls, the cycle indicator, the session settings, the
Web Audio chime, the catch-up that replays phases which elapsed while the app
was closed, and the versioned storage repository.

**Why here:** the engine is the product. Everything else is a view of it, and
it is the only part that must be provably correct, so it was made pure and
unit-tested before any UI was attached to it.

**The decision that shaped everything:** the countdown is derived from an
absolute deadline (`endsAt`), never from a decrementing counter. A throttled
background tab cannot lose time, because no time is being counted at all.

---

## Stage 3 - Tasks, history, statistics

**Commit:** `3670f69`

The task queue, the append-only session history, the statistics derived from
it, the preferences domain, and the preferences panel.

**Why here:** the statistics are only meaningful once the app knows *what* was
worked on, and the task queue is what gives the history its second dimension.

**The decision:** the history is append-only, so every statistic is recomputed
from the log rather than accumulated in a counter. The numbers can always be
audited and recomputed.

---

## Stage 4 - The mini timer

**Commit:** `3c0f7e6`

The corner arithmetic in `src/domain/mini-mode.ts`, the store and its
repository, the floating widget, and the header toggle. Plus a fix for a
structural bug found along the way: the timer engine was being unmounted with
the Radix tab, so the countdown stopped whenever the user visited Tasks or
Stats.

**Why here:** a widget that must survive independently of any tab forces the
engine to be lifecycle-independent, and that fix was worth having on its own.

**The decision:** the widget holds *layout* only. It reads the countdown from
the shared engine, so there is exactly one timer and the two readouts cannot
disagree.

**Two bugs caught only in the browser:** pointer capture was bound to the
widget instead of the grip handle, which retargets every subsequent pointer
event; and `setPointerCapture` throws in environments that do not implement
it, so capture and release are best-effort.

---

## Stage 5 - The dashboard layout

**Commit:** `3ad8301`

The two-column dashboard, the permanent clock column, and the one-line footer.

**Why here:** the clock was still living inside the "Focus" tab, one of four.
Putting it in a permanent left-hand column makes it the thing the user always
sees, and moves everything else into a workspace column that has the width to
be useful.

**The decision:** the clock moved *outside* the tab boundary entirely. Radix
unmounts inactive tab content, so a clock inside a tab is a clock that can
disappear. "Permanent" had to mean a lifetime guarantee, not just a position.

**Two consequences:** the "Focus" tab became "Session", because the timer left
it and only the session settings remained; and `TimerPanel` dropped its
`max-w-xl` centring, which would have stranded it in a wider column.

---

## Stage 6 - Reviewing the suggestions

**Commit:** the current one

Every item in `suggest.md` was checked against the source rather than carried
forward on trust. The review found four defects the record had not mentioned,
and showed that two of the standing suggestions had already been built.

**The decision:** a suggestion that is wrong is worse than no suggestion, so
each one was traced to the line that implements it before it was kept. The
record now separates *correctness first* - things a user can see today - from
the enhancements.

**What the review found:**

- The streak is computed by subtracting a fixed 86 400 000 ms per day, which
  breaks on the day the clocks go back. Reproduced in a fixed time zone: a
  user who worked on 30 Oct and 1 Nov, having missed 31 Oct, is reported as
  being on a two-day streak.
- The "Interruptions" metric can never be non-zero. The domain function, the
  store action, and the engine context all exist, but no control calls them.
- "Reset session" preserves the two counters the session summary displays, so
  the button appears to do nothing.
- The session summary's "Focus time" is a session count multiplied by the
  *current* focus length, so it drifts from the real total in the statistics.
- Two standing suggestions were already implemented: the reduced-motion
  preference is honoured in `src/index.css`, and the `autoAdvanceTask`
  behaviour is live in the timer store.

---

## Stage 7 - Repairing the four defects

**Commit:** `1a1cbe0`

The four defects the Stage 6 review found, repaired one at a time.

**The decision:** the streak walks back by *calendar* day rather than by a
fixed 86 400 000 ms. The `shiftLocalDay` helper in `src/lib/time.ts` does it,
and the same bug was latent in `focusMsByDay`, which built the chart's window
the same way - so both were fixed together.

**The test had to be honest.** A daylight-saving test in UTC passes against
the bug, because UTC has no daylight saving. The test file pins the time
zone to `America/New_York`, and it was checked by reverting the fix and
confirming that four of its assertions failed. A regression test that passes
against the bug it is meant to catch is worse than no test at all.

**What the other three fixes required.** An abandoned focus session is now a
*voided* history entry: it is excluded from every count of completed
sessions, so the skip still counts towards nothing, but it is counted as an
interruption, so the metric can finally be non-zero. "Reset session" clears
the counters the summary displays, and the summary's "Focus time" is the
measured duration rather than a count multiplied by the current focus length.

---

## Stage 8 - The improvements

**Commit:** `f3ce6f9`

The active task and the daily goal in the clock column, the
`autoAdvanceTask` toggle, inline task editing, the visible session log, the
keyboard shortcuts, the service worker, and the dependency pruning.

**The decision:** the clock column was the right home for the active task and
the goal, because it is the one surface that is never unmounted. The
shortcuts live with the engine rather than with the panel, for the same
reason - a shortcut that only worked on one tab would be worse than none.

**Two things the browser caught that the tests did not.** The measured focus
time needed a repair on read: a snapshot written by the earlier build has no
`completedFocusMs` field, and the summary rendered `NaN min` for every
existing user. Only the screenshot showed it. And `@radix-ui/react-progress`
had been declared but never used - rather than dropping it, the daily-goal
bar now uses it, which is what the package was there for.

---

## Stage 9 - The native tier

**Commit:** *(see the history)*

The Tauri v2 desktop app: the Rust backend, the `PlatformBridge` seam, and
the native affordances built on top of them.

**The decision: one seam, and the web build must not notice it.** The whole
native tier is reached through `src/platform`, which exposes a single
`PlatformBridge` interface. The web implementation does nothing; the Tauri
implementation talks to the backend. Nothing above the seam asks which tier
it is running on, so the app has exactly one code path and the browser and
the desktop cannot drift apart.

`@tauri-apps/api` is imported **dynamically** and only in
`src/platform/tauri.ts`. The build proves it: the Tauri code is split into
its own chunk, and the web page never requests it. A static import would
have put the Tauri runtime into the web bundle, where
`window.__TAURI_INTERNALS__` does not exist.

**The decision: the native alarm is scheduled against the deadline, not a
duration.** The web tier can only fire a chime while the tab is alive,
because a browser gives a backgrounded tab no timer it can trust. The
native tier has no such limitation, so the alarm sleeps until the *same*
`endsAt` the countdown is drawn from and fires a notification there. It is
not a second opinion about when the phase ends - it is the same fact, read
by a thread that does not care whether the webview is being painted.

**The alarm is a thread, not a `tokio` timer,** precisely because the point
is that the notification does not depend on the webview's event loop being
alive. A request interrupts the sleep, so pausing or restarting the timer
takes effect immediately rather than at the next deadline.

**The decision: the window hides, it does not quit.** A Pomodoro timer that
stops when its window is closed cannot be trusted to be there when the
break is due, so the close button hides the window and the process stays
alive. The tray is the way back, and a second launch focuses the existing
app rather than starting a second timer that would double every statistic.

**The web tier is honest about itself.** The tray button and the global
shortcut are simply absent in a browser, because the browser cannot honour
them. A button that does nothing is worse than no button.

**Three bugs that only a real run found.** None of them were visible in
the tests, and all three would have shipped:

- **The tray update panicked the app.** The tray icon is created in the
  setup hook, so a lookup by managed state found nothing — and
  `state()` panics when it is called before `manage()`. A panic in a
  command handler takes the whole process down, so the app died on its
  first tray update. The icon is now found by its id, and the flags the
  tray and the runtime both need are shared by clone rather than looked
  up on demand.
- **The alarm was never sent.** The alarm is scheduled on mount, and the
  native bridge is loaded asynchronously, so the request was dropped on
  the floor. A deadline that is never sent is a phase that ends in
  silence. The request is now held and sent as soon as the bridge is
  ready.
- **The service worker cached the native app's shell.** The desktop app
  serves its own assets, and a worker caching the shell would keep
  serving it after an upgrade — old code against a new backend. The
  worker is now registered only on the web tier.

**The verification was the interesting part.** Driving the real app
through UI Automation — finding the "Hide to the system tray" button by
its accessible name, invoking it, and checking that the window was hidden
and the process was still alive — is what proved the flow. The unit
tests could not have caught any of it.

---

## Verification

| Stage | Tests | Typecheck | Lint | Build | Browser |
|-------|-------|-----------|------|-------|---------|
| 1 | green | green | green | green | shell renders |
| 2 | green | green | green | green | countdown and phases verified |
| 3 | green | green | green | green | queue, stats, persistence verified |
| 4 | green | green | green | green | drag, snapping, reload, dark mode |
| 5 | 220 / 17 files | green | green | green | two columns, tab switch, mobile, dark mode, 0 console errors |
| 6 | 236 / 18 files | green | green | green | defects reproduced in a fixed time zone |
| 7 | 236 / 18 files | green | green | green | 4 assertions fail against the old code |
| 8 | 256 / 19 files | green | green | green | two columns, dialog, task editing, shortcuts, 0 console errors |
| 9 | 283 / 24 files + 6 Rust | green | green | green | web tier loads no Tauri chunk, 0 console errors; native app drives hide-to-tray, the global shortcut, and the tray countdown |

**Current state:** 283 tests across 24 files and 6 Rust tests, typecheck,
lint, the production build, the native release build, and the installers
(NSIS + MSI) all clean.

# Suggest - recommended improvements

> Overall improvements to this app, refreshed after every completed task.
> Companions: [`input.md`](./input.md) (prompts), [`prd.md`](./prd.md) (requirements),
> [`plan.md`](./plan.md) (stages).

---

## Correctness first

These are defects, not enhancements. Each one is visible to a user today.

### 1. The streak breaks across a daylight-saving boundary

`currentStreak` walks back with `now - offset * 86_400_000`
(`src/domain/history.ts:227`). A day is not always 86 400 000 ms, so on the
day the clocks go back the same day is visited twice and the day before it is
skipped. A user who worked on 30 Oct and 1 Nov, having missed 31 Oct, is
reported as being on a two-day streak.

Step back with calendar arithmetic instead - `setDate(date.getDate() - 1)` -
and normalise to midnight with the `startOfLocalDay` helper that already
exists in `src/lib/time.ts` and currently has no caller. The test needs a
fixed time zone, because the bug only appears in one.

### 2. "Interruptions" is a metric that can never be non-zero

The action exists - `recordInterruption` in the domain, `interrupt` on the
store, `interrupt` on the engine context - but no control ever calls it. Both
the session summary and the statistics show the number, and the code comment
claims it is the metric that predicts whether the method is working.

Counting a skipped focus phase as an interruption is the natural fix, and
`skipPhase` already knows how much time the phase had served. A session that
was abandoned is exactly what the method calls an interruption.

### 3. "Reset session" resets nothing the user can see

`resetSession` (`src/domain/timer.ts:231`) preserves `totalWorkSessions` and
`totalInterruptions`, which are precisely the two numbers the session summary
displays. Clicking the button clears the cycle and leaves the panel looking
unchanged. Either reset the counters as well, or rename the button to "Reset
cycle", which is what it actually does.

### 4. The session summary's "Focus time" is an estimate, not a measurement

`focusMinutes` is `totalWorkSessions * config.workMs`
(`src/components/timer/session-summary.tsx:24`) - a session count multiplied by
the *current* focus length. Change the focus length and the reported total
changes with it, and it will not agree with the statistics panel, which sums
the real durations from the history. Use `totalFocusMs(entries)` and the two
panels tell the same story.

---

## Recommended next

### 5. Show the active task in the clock column

The clock column has room below the countdown and nothing to put in it. The
active task's title, its estimate, and a progress bar would answer "what am I
working on?" without a tab switch - which is the same reason the clock moved
out of the tab in the first place.

**Why it is next:** it is the highest-value use of the space the dashboard
change created, and it needs no new domain logic.

### 6. Add the `autoAdvanceTask` settings toggle

The behaviour is implemented and tested, but there is no control for it, so
the user cannot change it - and the queue can move on by itself with no
indication that it did. The preferences panel already has the pattern.

### 7. Rename `SessionSummary`

The name says "summary" but the component is a live session-status panel. It
should be renamed to match what it does, and the rename is a good moment to
give it a clear, permanent place in the clock column.

### 8. Let tasks be edited

`updateTask` and `TaskPatch` exist in the domain and are unit-tested, and the
store exposes the action - but no control calls it. A task title cannot be
corrected after a typo and an estimate cannot be changed, even though both are
one field away.

### 9. Begin Phase 5 - the Tauri native tier

The `PlatformBridge` seam is designed for and not yet built. It is what makes
the desktop tier real: a system tray, a global shortcut, a window that hides
to the tray, and a native notification at phase completion.

---

## Longer-term

### 10. Keyboard shortcuts

Start/pause, skip, and reset are all frequent actions and all currently
require a mouse. A shortcut map would make the app feel native, and it is the
kind of thing that is much easier to add before the layout settles than after.

### 11. A week view in the statistics

The statistics already compute per-day totals, so a seven-day bar chart is
mostly a rendering job. The daily bars are useful on their own; a week view
is where a streak becomes visible.

### 12. Export the history

The log is append-only and local-first, which means a user who wants their
data elsewhere has no way to get it. A JSON or CSV export is a small feature
and the data is already in the right shape for it.

### 13. Notifications when the window is hidden

The chime only plays if the browser tab is alive and unmuted. On the web tier
this is a browser limitation; on the native tier it is a tray notification,
and the app would then be usable for someone who keeps it in the background.

### 14. Show the daily goal as a progress bar

`dailyProgress` already returns a `ratio`, and it is used by nothing. The
statistics panel shows "3 / 8" as text, but a bar would make the goal
readable at a glance — and it belongs in the clock column, where the goal is
the thing being worked toward. There is no `Progress` primitive in
`src/components/ui/`, though `@radix-ui/react-progress` is already a
dependency.
### 15. Make the app installable and offline-capable

There is a `manifest.webmanifest` with a standalone display mode, but no
service worker, so the app cannot be installed to a home screen and does not
work offline. A timer is a poor companion for a disconnected laptop.

### 16. Prune the unused dependencies

Eleven `@radix-ui` packages are declared, and only five are imported:
`label`, `separator`, `slot`, `switch`, `tabs`. `dialog`, `progress`,
`scroll-area`, `select`, `slider`, and `tooltip` are installed and never used.
Either use them or drop them — the install is carrying weight for nothing.

### 17. Expose the history in the UI

The history is the app's only durable record, and the statistics are derived
from it, but the user cannot see the log itself. There is no way to ask "what
did I do last Tuesday?" beyond the seven-day chart and the per-task
breakdown. A short, scrollable list of recent sessions would make the
append-only log legible.

### 18. Show which task a session is spent on, in the clock column

The history captures `taskId` and `taskTitle`, and the statistics break the
focus time down by task — but the live clock column shows no task at all, so
the connection between the running timer and the queue is invisible until the
stats tab is opened. This is the same gap as item 5, seen from the other
side.

---

## Keep doing

- **Keep the domain layer pure.** Every hard bug so far has been a lifecycle
  or timing bug, and every one of them was cheap to find because the logic
  was testable without a DOM.
- **Keep the engine above the UI.** The tab-unmount bug and the permanent
  clock are the same lesson twice.
- **Keep verifying in the browser.** The pointer-capture bug and the
  setPointerCapture throw were both invisible to jsdom and to the test suite.

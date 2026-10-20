# Suggest - recommended improvements

> Overall improvements to this app, refreshed after every completed task.
> Companions: [`input.md`](./input.md) (prompts), [`prd.md`](./prd.md) (requirements),
> [`plan.md`](./plan.md) (stages).

---

## Recommended next

### 1. Show the active task in the clock column

The clock column has room below the countdown and nothing to put in it. The
active task's title, its estimate, and a progress bar would answer "what am I
working on?" without a tab switch - which is the same reason the clock moved
out of the tab in the first place.

**Why it is first:** it is the highest-value use of the space that the
dashboard change just created, and it needs no new domain logic.

### 2. Add the `autoAdvanceTask` settings toggle

The behaviour is implemented and tested, but there is no control for it, so
the user cannot change it. The preferences panel already has the pattern for
this, so the work is small.

### 3. Rename `SessionSummary`

The name says "summary" but the component is a live session-status panel. It
should be renamed to match what it does, and the rename is a good moment to
give it a clear, permanent place in the clock column.

### 4. Begin Phase 5 - the Tauri native tier

The `PlatformBridge` seam is designed for and not yet built. It is what makes
the desktop tier real: a system tray, a global shortcut, a window that hides
to the tray, and a native notification at phase completion.

---

## Longer-term

### 5. Keyboard shortcuts

Start/pause, skip, and reset are all frequent actions and all currently
require a mouse. A shortcut map would make the app feel native, and it is the
kind of thing that is much easier to add before the layout settles than after.

### 6. A week view in the statistics

The statistics already compute per-day totals, so a seven-day bar chart is
mostly a rendering job. The daily bars are useful on their own; a week view
is where a streak becomes visible.

### 7. Export the history

The log is append-only and local-first, which means a user who wants their
data elsewhere has no way to get it. A JSON or CSV export is a small feature
and the data is already in the right shape for it.

### 8. Notifications when the window is hidden

The chime only plays if the browser tab is alive and unmuted. On the web tier
this is a browser limitation; on the native tier it is a tray notification,
and the app would then be usable for someone who keeps it in the background.

### 9. Respect the system reduced-motion preference

The countdown ring animates. It is a small, tasteful animation, but the
`prefers-reduced-motion` media query is the standard way to offer an opt-out
and it is not yet honoured.

---

## Keep doing

- **Keep the domain layer pure.** Every hard bug so far has been a lifecycle
  or timing bug, and every one of them was cheap to find because the logic
  was testable without a DOM.
- **Keep the engine above the UI.** The tab-unmount bug and the permanent
  clock are the same lesson twice.
- **Keep verifying in the browser.** The pointer-capture bug and the
  setPointerCapture throw were both invisible to jsdom and to the test suite.

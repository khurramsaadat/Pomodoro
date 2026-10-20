# PRD — Mini Mode: a draggable, corner-docked timer

> Product requirements for the mini timer.
> Status: **shipped** in commit `3c0f7e6`.
> Companions: [`input.md`](./input.md) (brief), [`plan.md`](./plan.md) (execution),
> [`suggest.md`](./suggest.md) (next steps).

---

## 1. Problem

The Pomodoro timer only exists as a tab inside the main window. That is a real
problem for the app's core use case: **a Pomodoro timer is meant to be
consulted constantly and resented constantly.**

Three concrete failures follow from the current design:

1. **Consulting the timer costs focus.** Every check of the remaining time
   means switching tabs in a browser, or finding and raising a window in the
   desktop app. The very act of checking the timer pulls attention away from
   the work the timer is protecting.
2. **The timer stops when you look away.** Because the timer engine lived
   inside a Radix tab, and Radix unmounts inactive tabs, the countdown
   *actually stopped* whenever the user visited the task queue or the
   statistics. The timer was not merely hidden — it was not running.
3. **An expiring phase goes unnoticed.** With the engine torn down, a phase
   that reached its deadline while the user was on another tab was not noticed
   until they returned. The completion chime, the history entry, and the task
   credit all arrived late — or, in the worst case, were reconstructed on
   return by the catch-up logic rather than happening when they should have.

The user asked for a small, always-available window onto the timer. That
request also happens to fix the two structural bugs above, because a widget
that must survive independently of any tab *forces* the engine to be
lifecycle-independent.

## 2. Goals

| # | Goal | Why it matters |
|---|------|----------------|
| G1 | The countdown is visible without switching context | Removes the focus cost of checking the timer |
| G2 | The timer runs regardless of what the user is looking at | The timer must be trustworthy |
| G3 | The widget can be moved out of the way, permanently | The user controls the trade-off between visibility and obstruction |
| G4 | Placement survives a restart and a resize | Placement the user chose is a decision worth keeping |
| G5 | Exactly one timer exists | Two copies of a countdown drift; the user must never see a disagreement |

## 3. Non-goals

- A second, independent timer. The brief explicitly says the mini timer
  *shares* the main timer.
- Replacing the main panel. The mini widget is a companion, not a rival.
- Any change to the Pomodoro cycle itself — durations, break structure, and
  the skip/interrupt rules are untouched.
- Native (Tauri) platform work. This phase is web-only; the seam is designed
  so Phase 5 can build on it.

---

## 4. Personas

**The deep worker.** Has the app open on a second monitor, or minimised.
Wants a small always-visible readout in the corner of the screen, positioned
where it will not cover the work, and wants it to stay there across restarts.

**The tab-switcher.** Works in a browser with many tabs open. Wants to glance
at the timer without losing their place. The current app forces a tab switch
that loses their place in the page they were reading.

**The reviewer.** Checks the timer occasionally. For them the critical
requirement is only that the number is *right* — a timer that silently stops
is worse than no timer at all.

---

## 5. User stories

### US-1 — Open and close the mini timer
> As a user, I want to open a small timer from the header and close it again,
> so that I control whether it occupies screen space.

**Acceptance criteria**
1. A control in the header toggles the mini timer.
2. The mini timer is hidden on a first run.
3. Closing it from the widget works, as does closing it from the header.
4. The widget can be closed without affecting the main panel or the running
   timer.

### US-2 — The mini timer shows the same countdown
> As a user, I want the mini timer to show exactly the same remaining time as
> the main panel, so that I can trust it.

**Acceptance criteria**
1. The two readouts agree to the second.
2. There is exactly one source of truth; the widget does not keep a copy.
3. Starting and pausing from the widget controls the same timer the panel
   controls.

### US-3 — The timer runs even when the main panel is not on screen
> As a user, I want the timer to keep running while I am looking at something
> else, so that it is a real timer and not a display.

**Acceptance criteria**
1. Switching to the Tasks or Stats tab does not stop the countdown.
2. Closing the mini timer does not stop the countdown.
3. A phase that expires while the user is away is recorded at the time it
   expired, not at the time the user returned.

### US-4 — Move the widget and keep it there
> As a user, I want to drag the mini timer to a corner and have it stay there,
> so that it does not cover what I am working on.

**Acceptance criteria**
1. The widget is draggable by its grip handle.
2. On drop it snaps to the nearest of the four corners.
3. The chosen corner and any offset from it survive a reload.
4. The widget stays anchored to its corner when the window is resized.
5. The widget can never be dragged out of reach.

### US-5 — The timer behaves as configured
> As a user, I expect the preferences I set to actually apply, so that the app
> behaves the way I configured it.

**Acceptance criteria**
1. With `soundEnabled` off, no chime plays on phase completion.
2. With `autoAdvanceTask` on, a task that has met its estimate is followed by
   the next open task.
3. `autoAdvanceTask` is evaluated against the *updated* session count, so a
   task estimated at one session advances on its first completion.

---

## 6. Functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The header provides a toggle for the mini timer | Must |
| FR-2 | The widget shows phase, remaining time, and progress | Must |
| FR-3 | The widget provides start/pause and close controls | Must |
| FR-4 | The widget is draggable by a dedicated handle | Must |
| FR-5 | Dropping the widget snaps it to the nearest corner | Must |
| FR-6 | The position is stored as a corner plus an offset | Must |
| FR-7 | Visibility and position are persisted and validated on read | Must |
| FR-8 | The widget and the main panel read one timer | Must |
| FR-9 | The timer runs independently of the tab layout | Must |
| FR-10 | `soundEnabled` gates the completion chime | Must |
| FR-11 | `autoAdvanceTask` advances the active task when its estimate is met | Should |
| FR-12 | The widget is clamped inside the viewport | Must |
| FR-13 | The widget is never rendered off screen after a corrupt read | Must |

## 7. Non-functional requirements

| ID | Requirement | How it is met |
|----|-------------|---------------|
| NFR-1 | No `any`, no non-null assertions outside tests | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| NFR-2 | The domain layer has no React, DOM, or Tauri imports | Corner maths lives in `src/domain/mini-mode.ts`, pure and unit-tested |
| NFR-3 | The web build contains no Tauri code | No Tauri import was added in this phase |
| NFR-4 | A corrupt payload must never crash the app | `normalizeMiniPosition` + repository validation |
| NFR-5 | Storage failures must not break the app | The repository never throws; every operation degrades to a no-op |
| NFR-6 | The countdown must survive browser throttling | Deadline-based: `endsAt` is stored, `remaining` is derived from `Date.now()` |
| NFR-7 | The widget must be keyboard accessible | Every control is a real `<button>` with an accessible name |

## 8. Data model

```ts
type MiniCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface MiniPosition {
  readonly corner: MiniCorner;
  readonly offsetX: number;  // pixels from the corner's anchor
  readonly offsetY: number;
}

interface MiniModeState {
  readonly enabled: boolean;
  readonly position: MiniPosition;
}
```

Persisted under the key `pomodoro-mini-mode`, wrapped in the versioned
envelope `{ version, data }` with `STORAGE_SCHEMA_VERSION = 1`.

---

## 9. Success metrics

| Metric | Target | Status |
|--------|--------|--------|
| Mini-mode test coverage | Every acceptance criterion above has a test | **Met** — 10 tests in `src/test/mini-mode.test.tsx` |
| Mini widget never disagrees with the main panel | 0 disagreements | **Met** — verified in-browser and by test |
| Timer stops when the user changes tab | 0 occurrences | **Met** — engine lifted above the tab boundary |
| Tests, typecheck, lint, build | All green | **Met** — 215 tests / 16 files, all clean |
| Console errors in the browser | 0 | **Met** — verified in light and dark mode |

## 10. Risks

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| A second countdown copy drifts from the main one | High — the user sees two different numbers | The widget reads the timer store and engine directly; it holds no countdown state of its own | Mitigated by design |
| Pointer capture is unavailable | Medium — the widget would be undraggable | Capture and release are best-effort and wrapped in `try`/`catch` | Mitigated |
| A corrupt position strands the widget off screen | High — unrecoverable state | `normalizeMiniPosition` repairs each field independently | Mitigated |
| The engine is unmounted with the tab | High — the timer stops | Engine lifted into `TimerEngineProvider` above the tabs | Mitigated |
| The tick re-renders the whole app | Medium — jank at 5 Hz | `RemainingContext` is separate from the engine context | Mitigated |
| The 5 Hz tick is visible in the mini widget only | Low | The widget is a single small component | Accepted |

## 11. Out of scope / deferred

- A settings toggle for `autoAdvanceTask` (the behaviour is implemented and
  tested; the control is not built). Tracked in `suggest.md`.
- Showing the active task's title in the mini widget.
- Phase 5 — the Tauri native tier.

## 12. Release notes

**Mini mode (commit `3c0f7e6`)**

- Added a draggable mini timer that docks in a viewport corner, with start/pause
  and close controls, and a header toggle to open it.
- Fixed a structural bug: the timer engine was being unmounted with the Focus
  tab, so the countdown stopped whenever the user visited Tasks or Stats. The
  engine now lives above the tab boundary and always runs.
- The mini timer's placement is stored as a corner plus an offset, so it stays
  anchored across window resizes and survives a reload.
- Wired up two preferences that were previously declared but never used:
  `soundEnabled` now suppresses the completion chime, and `autoAdvanceTask`
  now advances the queue once a task's estimate is met.




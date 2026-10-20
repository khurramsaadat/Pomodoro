# Plan — Mini Mode execution record

> The order the work was actually done in, and why.
> Completed in commit `3c0f7e6`.
> Companions: [`input.md`](./input.md), [`prd.md`](./prd.md), [`suggest.md`](./suggest.md).

---

## 1. Strategy

The feature was decomposed in dependency order, **not** in visual order. The
widget is the visible deliverable, but it could not be built first: it has
nothing to display until the timer survives being unmounted, and nothing to
live in until the domain maths exists.

The chosen order:

```
1. Domain maths (pure)      → testable corner arithmetic
2. Engine lift               → the timer stops dying with its tab
3. Store + storage           → state and persistence
4. Widget UI                 → the visible surface
5. Preferences wiring        → make the dead preferences real
6. Verification              → tests, browser, regression
```

Each step was verifiable before the next began. Nothing was built on an
unverified assumption.

---

## 2. Step 1 — Domain maths, first and pure

**Why first:** the corner arithmetic is the fiddly part, and it is the part
that must be exactly right. Putting it in `src/domain/mini-mode.ts` — pure
functions over plain data, no React and no DOM — made it exhaustively
unit-testable and kept it in line with `AGENTS.md` rule 2.

**Delivered**

| Export | Purpose |
|--------|---------|
| `MiniCorner` | The four corners |
| `MiniPosition` | `{ corner, offsetX, offsetY }` |
| `MINI_MARGIN` (16) | Gap kept from the viewport edge |
| `MINI_WIDTH` / `MINI_HEIGHT` | Nominal size, used before measurement |
| `DEFAULT_MINI_POSITION` | Bottom right, out of the way |
| `isMiniCorner` | Type guard |
| `normalizeMiniPosition` | Repairs an arbitrary value into a usable position |
| `cornerAnchor` | Top-left of the widget for a given corner |
| `clampToViewport` | Keeps the widget fully on screen |
| `nearestCorner` | Which corner a position is closest to |
| `positionToMiniPosition` | Converts a dragged position into corner + offset |

**Two decisions worth recording**

- *The centre decides the corner, not the top-left.* A widget straddling the
  middle of the screen still snaps to the side the user was aiming at.
- *Right and bottom corners are measured from the far edge.* The widget keeps
  its margin from that edge when the window is resized.

**Verification:** `src/domain/mini-mode.test.ts` — 197 lines covering
anchoring, clamping, nearest-corner, normalisation of corrupt input, and the
round trip from a dragged position to a stored one.

---

## 3. Step 2 — Lift the engine above the tabs

**Why second:** this was the blocking defect. Every other part of the feature
depends on a timer that keeps running, and the bug was found only because the
mini timer made it obvious.

**The problem:** `TimerPanel` hosted `usePomodoroTimer`, and `TimerPanel`
lives inside a Radix `TabsContent`, which **unmounts** when inactive. The
countdown therefore stopped on every trip to Tasks or Stats.

**The fix**

| File | Role |
|------|------|
| `src/components/timer/timer-engine.ts` | The two contexts and the hooks |
| `src/components/timer/timer-engine-provider.tsx` | Mounts the engine once, for the app's lifetime |
| `src/components/timer/timer-panel.tsx` | Now a *consumer* of the engine, not its owner |

**The split that matters.** `remaining` changes five times a second. If it
lived in the same context as the engine actions, every consumer would
re-render on every tick. So:

- `TimerEngineContext` — the stable action bag (`start`, `pause`, `toggle`,
  `reset`, `skip`, `interrupt`). Stable identity, memoised.
- `RemainingContext` — the ticking number. Only the countdown subscribes.

`useRemaining` throws outside the provider, and its context default is
`null` rather than `0`, because zero is a *legitimate* remaining time — a
phase that has just expired — and a default of zero would make a missing
provider indistinguishable from an expired phase.

**Side effect:** the audio unlock listener also moved into the provider. It
has to live with the engine, because the panel is unmounted whenever the user
is on another tab — and the mini widget is exactly the case where the user
never visits the Focus tab at all.

**Verification:** `src/test/mini-mode.test.tsx` — "keeps counting down while
the user is on another tab"; plus in-browser confirmation that the countdown
continued with the main panel unmounted (19:30 → 18:xx observed).

---

## 4. Step 3 — Store and persistence

**Why third:** the widget needs somewhere to live before it can be rendered.

**Delivered**

| File | Role |
|------|------|
| `src/store/mini-mode-store.ts` | zustand store: `enabled`, `position`, `hydrated` |
| `src/storage/mini-mode.ts` | The repository for the mini-mode state |
| `src/hooks/use-mini-mode-persistence.ts` | Restore-once, persist-always |

**The store deliberately holds no countdown state.** It holds *layout*. The
widget reads the countdown from the timer store and the engine. This is the
single most important structural decision in the feature: two copies of a
countdown would drift, and the user would eventually see the two disagree.

**The persistence rule was inherited, and it is a trap.** `AGENTS.md` records
it, and it applies here exactly as it does to the rest of the app:

> *Stores are subscribed to, not watched through render state.* A render-driven
> effect writes the value captured during the render that preceded the restore,
> which overwrites the stored data with the empty initial state.
> *Subscribe before restoring.*

`useMiniModePersistence` subscribes **first**, then restores. The restore is
guarded by a ref so React's StrictMode remount cannot cause it to run twice —
but the subscription is re-established on every mount, so StrictMode cannot
leave the app without persistence either.

**Validation on read:** `normalizeMiniPosition` repairs each field
independently. A corrupt corner falls back to the default; a corrupt offset
falls back to zero. A mostly-corrupt payload still yields a usable
configuration rather than being discarded wholesale.

**Verification:** `src/test/mini-mode.test.tsx` — "persists its visibility",
"restores its visibility from storage".

---

## 5. Step 4 — The widget

**Why fourth:** all the state it depends on now exists and is tested.

**Delivered**

| File | Role |
|------|------|
| `src/components/mini/mini-timer.tsx` | The floating widget |
| `src/components/mini/mini-mode-toggle.tsx` | The header button |
| `src/lib/phase.ts` | Shared phase colour, so the widget and the panel agree |

**The widget is a view, not an owner.** It reads `useTimerStore` for the phase
and config, `useRemaining()` for the ticking number, and `useTimerEngine()` for
the actions. It owns exactly two things of its own: the drag state and its
measured size.

**Sizing.** The widget measures itself with `getBoundingClientRect` in a
layout effect so the drag maths uses its real size rather than a guess. A
`ResizeObserver` keeps that accurate if the content changes the size — but it
is guarded, because jsdom does not implement `ResizeObserver` and neither does
an older browser. The one-off measurement is enough to place the widget; the
observer is only a refinement.

**Repositioning on resize.** A `resize` listener recomputes the resting
position from the corner anchor, so the widget stays anchored to its corner
and stays inside the viewport when the window changes.

---

## 6. Step 5 — Two bugs found by browser verification

These are recorded because they are the kind of defect that unit tests alone
will not catch.

### 6.1 Pointer capture on the wrong element

The first implementation called `setPointerCapture` on the **outer widget**,
while the drag handlers lived on the **grip handle**.

Pointer capture **retargets** every subsequent pointer event for that pointer
to the capturing element. So `onPointerMove` on the handle never fired — the
moves were delivered to the widget instead — and dragging did nothing at all.
The widget looked draggable and was not.

**Fix:** capture on the handle, the element that actually owns the handlers.

### 6.2 `setPointerCapture` throwing in jsdom

With the capture on the right element, the drag still did not work in the
tests. The reason: jsdom does not implement `setPointerCapture`, and it
**throws**. The throw aborted the handler before the drag state was recorded,
so the widget never entered drag mode.

This mattered beyond the tests — any environment lacking pointer capture would
have had a completely dead widget.

**Fix:** capture and release are best-effort, each wrapped in `try`/`catch`. A
failed capture must never stop the drag from working. The widget degrades to
"the drag ends when the pointer leaves the window", which is the correct
fallback.

**Also fixed at this stage:** the widget's buttons had ambiguous accessible
names — "Start the mini timer" and "Start timer" collided when the main panel
was on screen. They were given distinct names.

---

## 7. Step 6 — Wire up the two dead preferences

These were declared in Phase 4 and never read. The mini timer made them
visible, so they were closed out here.

### 7.1 `soundEnabled`

`src/hooks/use-pomodoro-timer.ts` now checks the preference before playing the
chime. The check reads the preference from the store at call time rather than
closing over it, so toggling the setting takes effect immediately instead of
waiting for a re-render — a stale-closure bug in the first attempt.

### 7.2 `autoAdvanceTask`

`src/store/timer-store.ts` advances the queue when a focus session completes
and the active task has met its estimate.

The subtle part is *when* the check happens. The task is re-read **after** the
session has been recorded, because the check is against the **updated** count:

```ts
useTaskStore.getState().recordFocusSession();

const updated = selectActiveTask(useTaskStore.getState());
if (preferences.autoAdvanceTask && updated !== null && isOverEstimate(updated)) {
  useTaskStore.getState().advanceToNextTask();
}
```

Checking *before* the increment would mean a task estimated at one session
never advanced on its first completion — the estimate would only be met
afterwards.

---

## 8. Verification

### 8.1 Automated

| Check | Result |
|-------|--------|
| `npm test` | **215 tests / 16 files passed** |
| `npm run typecheck` | Clean |
| `npm run lint` | Clean |
| `npm run build` | Clean — 371.76 kB JS (114.06 kB gzip) |

### 8.2 New tests

`src/domain/mini-mode.test.ts` — 197 lines of pure corner arithmetic.

`src/test/mini-mode.test.tsx` — 10 integration tests, one per acceptance
criterion:

1. is hidden by default
2. opens from the header button
3. shows the same countdown as the main panel
4. can be closed again from the widget
5. persists its visibility
6. restores its visibility from storage
7. keeps counting down while the user is on another tab
8. starts and pauses the timer from the widget
9. moves to the corner it is dropped nearest to
10. records the offset from the anchor when dropped away from the corner

### 8.3 Manual browser verification

| Check | Result |
|-------|--------|
| Countdown continuity with the main panel unmounted | Pass |
| All four corner drops | Pass |
| Position survives a reload | Pass |
| Dark mode | Pass |
| Console errors | None |

### 8.4 A note on the "flaky test suite"

During this work the suite intermittently reported
`Vitest failed to find the current suite` across all 16 files. It was
investigated rather than dismissed, and the cause turned out to be **the test
invocation itself**: running Vitest through a `cmd /c` wrapper broke the
worker context, while invoking it directly from PowerShell was reliable.
Clearing caches, rebuilding, and checking for duplicate `vitest` installs all
correctly came up empty.

Running the suite directly, three consecutive runs gave 215/215 each time.
**The suite is not flaky.** The earlier claim in this session's working notes
that a dev server was the trigger was wrong — it was the `cmd /c` wrapper.

---

## 9. Files changed

| File | Change | Lines |
|------|--------|-------|
| `src/domain/mini-mode.ts` | New — pure corner arithmetic | +181 |
| `src/domain/mini-mode.test.ts` | New — unit tests | +197 |
| `src/components/mini/mini-timer.tsx` | New — the widget | +327 |
| `src/components/mini/mini-mode-toggle.tsx` | New — the header button | +30 |
| `src/components/timer/timer-engine.ts` | New — the two contexts | +75 |
| `src/components/timer/timer-engine-provider.tsx` | New — mounts the engine | +50 |
| `src/components/timer/timer-panel.tsx` | Now consumes the engine | modified |
| `src/store/mini-mode-store.ts` | New — layout state | +51 |
| `src/storage/mini-mode.ts` | New — the repository | +34 |
| `src/hooks/use-mini-mode-persistence.ts` | New — restore + persist | +33 |
| `src/lib/phase.ts` | New — shared phase colour | +19 |
| `src/store/timer-store.ts` | `autoAdvanceTask` wiring | modified |
| `src/store/task-store.ts` | Estimate helpers | modified |
| `src/hooks/use-pomodoro-timer.ts` | `soundEnabled` wiring | modified |
| `src/App.tsx` | Provider + widget + toggle | modified |
| `src/test/mini-mode.test.tsx` | New — integration tests | +203 |

**Total: 16 files, +1318 / −81.**

---

## 10. What went right, and what did not

### Went right

- **Building the domain maths first.** Every later step depended on it, and
  having it pure meant it could be tested exhaustively without a DOM.
- **Lifting the engine before building the widget.** Had the widget been built
  first, the "the timer stops when you change tab" bug would have been much
  harder to attribute — it would have looked like a widget bug.
- **Verifying in a real browser, not only in jsdom.** Both drag defects were
  invisible to the unit tests in a way that only manual interaction exposed.

### Went less well

- **The drag tests were written last and initially failed for the wrong
  reason.** The first failure was `setEnabled(true)` not re-rendering
  synchronously — the fix was to wrap it in `act`. Chasing the *actual* cause
  then surfaced the real bug: `setPointerCapture` throwing. It would have been
  easy to mock the missing API in the test and declare victory, which would
  have left the widget broken in every environment lacking pointer capture.
- **The `cmd /c` wrapper masqueraded as a flaky suite for a long time.** A
  suspected "stale Vite cache" and "a dev server running" were both
  investigated and both came up empty. The actual cause was the shell
  invocation. It was only found by testing the *invocation* as a variable
  rather than continuing to test the *code* as a variable.




# Input — Mini Mode (Draggable Corner Timer)

> Living record of the brief this feature was built against.
> Feature commit at time of writing: `3c0f7e6`.

---

## 1. Feature request

Build a **persistent, draggable mini Pomodoro timer** that:

- stays docked in a viewport corner,
- shares the **always-running main timer** (no second countdown),
- survives a reload,
- can be opened and closed by the user at will.

### Verbatim intent

> "Build a persistent, draggable mini Pomodoro timer that stays in a viewport corner
> and shares the always-running main timer."

### Derived acceptance criteria

| # | Criterion | Where it is verified |
|---|-----------|----------------------|
| 1 | Mini timer can be opened and closed | `src/test/mini-mode.test.tsx` — "opens from the header button", "can be closed again from the widget" |
| 2 | It is hidden by default | `src/test/mini-mode.test.tsx` — "is hidden by default" |
| 3 | It can be dragged and snaps to the nearest of the four corners | `src/test/mini-mode.test.tsx` — "moves to the corner it is dropped nearest to" |
| 4 | A drop away from the corner is remembered as an offset | `src/test/mini-mode.test.tsx` — "records the offset from the anchor when dropped away from the corner" |
| 5 | Position + visibility survive a reload | `src/test/mini-mode.test.tsx` — "persists its visibility", "restores its visibility from storage" |
| 6 | The countdown is identical to the main panel | `src/test/mini-mode.test.tsx` — "shows the same countdown as the main panel" |
| 7 | The timer keeps running when the main panel is unmounted | `src/test/mini-mode.test.tsx` — "keeps counting down while the user is on another tab" |
| 8 | Start/pause works from the widget | `src/test/mini-mode.test.tsx` — "starts and pauses the timer from the widget" |
| 9 | No Tauri code in the web build | `AGENTS.md` rule 3 — dynamic import only, inside `src/platform/tauri.ts` |

---

## 2. Pre-existing context

The feature arrived on top of three committed phases:

| Commit | Phase | What it delivered |
|--------|-------|------------------|
| `3347fb4` | Scaffold | Vite + React 19 + TS 5.9 + Tailwind v4 shell |
| `5a9727d` | Core engine | Deadline-based timer, catch-up, Web Audio chime, persistence |
| `3670f69` | Workspace | Task queue, session history, statistics, preferences |
| `3c0f7e6` | **Mini mode** | This feature |

### Two dead preferences inherited from Phase 4

Phase 4 declared these preferences but never wired them to behaviour. They were
in scope because the mini timer is the surface where "does the app beep" and
"does the queue move on" actually become visible:

| Preference | State before | Action taken |
|------------|--------------|--------------|
| `soundEnabled` | Declared, never read | Wired to the completion chime |
| `autoAdvanceTask` | Declared, never read | Wired to the task queue |

---

## 3. Constraints inherited from `AGENTS.md`

These are hard rules, not preferences. Every one of them shaped the design.

1. **TypeScript strictness is not negotiable** — `strict`, `noImplicitAny`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Zero `any`,
   zero non-null assertions outside tests.
2. **The domain layer is pure** — `src/domain/**` must not import React, the
   DOM, or `@tauri-apps/*`. It is pure functions over plain data and is
   exhaustively unit-tested.
3. **The web build contains no Tauri code** — `@tauri-apps/api` may only be
   imported *dynamically* inside `src/platform/tauri.ts`.
4. **Never mutate state in place** — immutable updates so React and zustand
   can diff correctly.
5. **Timers are deadline-based, never tick-based** — store `endsAt` (epoch ms);
   derive `remaining = endsAt - Date.now()`. Never decrement a counter.
6. **Every user preference is persisted** and schema-validated on read, so a
   corrupt or outdated payload can never crash the app.

### Conventions in force

- Function components with typed props. No `React.FC`.
- `cn()` from `@/lib/utils` for class composition.
- Icons from `lucide-react`.
- All user-facing strings are plain text; the UI is English-only.
- Comments explain *why*, not *what*.

---

## 4. Key technical findings

These are the discoveries that shaped the implementation. Each was verified
empirically rather than assumed.

### 4.1 Radix Tabs unmount inactive content

`TabsContent` **unmounts** when its tab is inactive. Because `TimerPanel` —
which hosted the timer engine — lived inside a tab, the engine was torn down
whenever the user visited Tasks or Stats.

Consequences:

- the countdown stopped while the user was on another tab,
- a phase that expired in the background was not noticed until the user
  returned,
- the mini timer had nothing to read from when the Focus tab was not mounted.

**Resolution:** lift the engine into `TimerEngineProvider`, mounted once for
the lifetime of the app, above the tab boundary.

### 4.2 The 5 Hz tick must not re-render every consumer

`remaining` changes five times a second. Keeping it in the same React context
as the engine actions would re-render every consumer of the engine on every
tick.

**Resolution:** two contexts. `TimerEngineContext` holds the stable actions;
`RemainingContext` holds the ticking value. Only the countdown subscribes to
the latter.

### 4.3 Pointer capture retargets events

`setPointerCapture` on an element causes all subsequent pointer events for
that pointer to be delivered **to the capturing element**. The first
implementation captured on the outer widget while the handlers lived on the
grip handle — so `onPointerMove` never fired and dragging did nothing at all.

**Resolution:** capture on the *handle*, the element that actually owns the
handlers.

### 4.4 `setPointerCapture` is not universally implemented

jsdom does not implement it, and it threw, aborting the handler before the
drag state was recorded. Any environment lacking it would have had a
completely dead widget.

**Resolution:** capture and release are best-effort, wrapped in `try`/`catch`.
A failed capture must never stop the drag from working.

### 4.5 Position must be a corner, not pixels

Storing raw pixel coordinates breaks the moment the window is resized or the
screen size changes: the widget would drift away from the corner it was
docked to, or off screen entirely.

**Resolution:** persist `{ corner, offsetX, offsetY }`. The corner defines the
anchor; the offset is the user's nudge away from it. The widget stays anchored
across resizes.

### 4.6 The "corrupt position strands the widget" hazard

A corrupt persisted position (unknown corner, non-numeric offset) would place
the widget off screen where the user could not drag it back — an unrecoverable
app state.

**Resolution:** `normalizeMiniPosition` repairs each field independently, so a
mostly-corrupt payload still yields a usable configuration.

---

## 5. Non-goals

Explicitly out of scope for this feature:

- **Phase 5 — the Tauri tier.** The native shell, tray, and window events.
- **A settings toggle for `autoAdvanceTask`.** The preference is honoured by
  the engine but has no UI control yet. (Recorded as a known gap — see
  `suggest.md`.)
- **A free-floating mode.** The widget always snaps to a corner.
- **Multiple simultaneous mini timers.**
- **Per-corner remembered offsets.** A single offset pair is stored.

---

## 6. Open questions carried forward

| Question | Status |
|----------|--------|
| Should `autoAdvanceTask` get a UI toggle? | Unresolved — see `suggest.md` |
| Should the mini timer show the active task's title? | Unresolved — deferred to a later phase |
| Is the `try`/`catch` around pointer capture the right long-term shape, or should the environment be polyfilled? | Accepted as-is; it degrades gracefully |


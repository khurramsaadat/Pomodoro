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

**Commit:** the current one

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

## Verification

| Stage | Tests | Typecheck | Lint | Build | Browser |
|-------|-------|-----------|------|-------|---------|
| 1 | green | green | green | green | shell renders |
| 2 | green | green | green | green | countdown and phases verified |
| 3 | green | green | green | green | queue, stats, persistence verified |
| 4 | green | green | green | green | drag, snapping, reload, dark mode |
| 5 | 220 / 17 files | green | green | green | two columns, tab switch, mobile, dark mode, 0 console errors |

**Current state:** 220 tests across 17 files, typecheck, lint, and the
production build all clean.

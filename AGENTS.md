# AGENTS.md — Workspace Rules

Production-grade Pomodoro timer. Runs natively as a Tauri v2 desktop app and as a
standalone static web app from the same source tree.

## Hard rules

1. **TypeScript strictness is not negotiable.** `strict`, `noImplicitAny`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are all on. Zero
   `any`. Zero non-null assertions (`!`) outside of tests.
2. **The domain layer is pure.** `src/domain/**` must not import from `react`,
   the DOM, or `@tauri-apps/*`. It is pure functions over plain data and is
   exhaustively unit-tested.
3. **The web build contains no Tauri code.** `@tauri-apps/api` may only be
   imported *dynamically* inside `src/platform/tauri.ts`. A static import
   anywhere else breaks the standalone web deploy.
4. **Never mutate state in place.** Use immutable updates so React and zustand
   can diff correctly.
5. **Timers are deadline-based, never tick-based.** Store `endsAt` (epoch ms);
   derive `remaining = endsAt - Date.now()`. Never decrement a counter — browser
   throttling in background tabs would silently lose time.
6. **Every user preference is persisted** and schema-validated on read, so a
   corrupt or outdated payload can never crash the app.
7. **The project records in `markdown/` are maintained, not written once.**
   Every feature updates all four, in `markdown/`:

   | File | Holds | Updated |
   |------|-------|---------|
   | `markdown/input.md` | The prompts as received, verbatim and nothing else | When a feature is requested |
   | `markdown/prd.md` | The overall view: what the app is, its goals, its requirements, and the release notes | When requirements change, and at release |
   | `markdown/plan.md` | The stagewise implementation: what was built, in order, and why | As the work proceeds, and at the end |
   | `markdown/suggest.md` | The recommended overall improvements to the app | At the end of a feature, carrying them forward |

   A feature is not finished until all four are updated. The release notes in
   `markdown/prd.md` are the single place a shipped change is announced, so
   they must match the code. Keep all four concise — they are a record, not a
   log.

## Layout

```
src/
  domain/    pure logic, zero platform imports   (unit-tested)
  platform/  the web/desktop seam (PlatformBridge)          [Phase 5]
  storage/   versioned, validated localStorage repositories
  store/     zustand stores
  hooks/     custom hooks
  lib/       time formatting, Web Audio chime, persistence
  components/layout/    app shell, dashboard grid, theme
  components/ui/        shadcn/ui primitives
  components/mini/      the floating mini timer
  components/timer/     timer UI
  components/tasks/     task queue UI
  components/stats/     statistics UI
  components/settings/  preferences UI
src-tauri/  Rust backend: commands, tray, window events    [Phase 5]
```

## Dashboard layout

The desktop UI is a two-column dashboard, and the split is load-bearing.

- **The clock is permanent.** `src/components/layout/dashboard.tsx` puts the
  clock in its own column, *outside* the Radix tab boundary, so switching
  tabs can never unmount the countdown. "Permanent" is a lifetime guarantee,
  not a position.
- **The engine and the clock are separate concerns.**
  `TimerEngineProvider` sits above the dashboard, so the timer keeps running
  even if the clock column itself is ever rearranged.
- **The workspace column holds the tabs.** Session settings, the task queue,
  the statistics, and the preferences.
- **Below the `lg` breakpoint the columns stack, clock first.** The phone
  layout keeps the timer above the fold.
- **A grid child must not be able to force a horizontal scrollbar.** Use
  `minmax(0, …)` on the tracks and `min-w-0` on the flexible column.
- **The footer is one line** and carries the copyright. It wraps rather than
  truncating, so the copyright is never cut off on a narrow screen.

## Timer engine

The engine is deadline-based end to end:

- `src/domain/timer.ts` holds the pure transitions. Every function takes an
  explicit `now` so the whole engine is testable with fixed timestamps and
  has no hidden dependency on the wall clock.
- `endsAt` is the single source of truth. `remaining` is always derived as
  `endsAt - Date.now()`; no counter is ever decremented.
- `src/domain/catch-up.ts` replays the phases that elapsed while the app was
  closed, using the *scheduled* end times so the reconstructed timeline
  matches what would have happened had the tab stayed open.
- A skipped focus session is void: it counts neither towards the session
  total nor towards the current cycle, and it never earns a long break.
- `TimerState.elapsedMs` banks the time a phase has already served. A phase
  that is paused and resumed still occupies its full configured duration, so
  `phaseCompletion` sums the banked time with the final segment. A naive
  `endsAt - startedAt` would under-report every paused session.

## Workspace: tasks, history, statistics

Phase 4 added the "what am I working on" half of the app.

- `src/domain/tasks.ts` — the queue. A task has a title, an estimate in
  focus sessions, and a count of sessions completed against it. One task is
  *active* at a time; a completed focus session is credited to it.
- `src/domain/history.ts` — the append-only log of completed phases, plus
  the statistics derived from it (daily goal, streak, per-day totals, and
  the breakdown by task). Entries are never mutated, so the numbers can
  always be recomputed from the log.
- `src/domain/preferences.ts` — behaviour that is *not* part of the timer
  configuration. Keeping the two apart means changing the daily goal never
  rewrites the user's session lengths.
- `src/storage/repository.ts` — a small versioned repository over
  `localStorage`. Every payload carries a schema version so a future shape
  change can migrate or discard it. Nothing in the storage layer throws:
  a full quota or a disabled storage must not break the app.

### Persistence rules

- **Stores are subscribed to, not watched through render state.** A
  render-driven effect writes the value captured during the render that
  preceded the restore, which overwrites the stored data with the empty
  initial state. Subscribe instead.
- **Subscribe before restoring.** The subscription is what persists the
  caught-up timer state. If it is registered after the restore, the stored
  snapshot keeps pointing at the expired phase and the catch-up runs again
  on the next load, recording the same session twice.
- **`useWorkspacePersistence` must run before `useTimerPersistence`.** The
  history has to be restored before the timer's catch-up records the phases
  that elapsed while the app was closed.


## Commands

```bash
npm run dev              # web dev server -> http://localhost:3000 (HMR)
npm run build            # typecheck + production build to dist/
npm run tauri dev        # native desktop app (starts the dev server itself)
npm run tauri build      # installers (NSIS + MSI)
npm run typecheck        # tsc -b --noEmit
npm run lint             # eslint
npm test                 # vitest
cargo check --manifest-path src-tauri/Cargo.toml
```

**Do not run `npm run dev` and `npm run tauri dev` at the same time** — the dev
server uses `strictPort: true` on 3000, so a second instance fails loudly rather
than drifting to 3001 and desyncing the native window.

**Run Vitest directly, not through `cmd /c`.** In this environment, wrapping
the run in `cmd /c` produces a spurious `Vitest failed to find the current
suite` failure across every test file. The suite itself is stable.

```powershell
# Works reliably
npx vitest run

# Misleading failures
cmd /c "npx vitest run"
```

When a tool fails in a way that looks environmental, test the *invocation*
before testing the *code*.

## Conventions

- Components are function components with typed props. No `React.FC`.
- Prefer `cn()` from `@/lib/utils` for class composition.
- Icons come from `lucide-react`.
- All user-facing strings are plain text; the UI is English-only.
- Comments explain *why*, not *what*.

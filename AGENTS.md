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

## Layout

```
src/
  domain/    pure logic, zero platform imports   (unit-tested)
  platform/  the web/desktop seam (PlatformBridge)          [Phase 5]
  storage/   versioned, validated localStorage repositories [Phase 4]
  store/     zustand stores
  hooks/     custom hooks
  lib/       time formatting, Web Audio chime, persistence
  components/ui/      shadcn/ui primitives
  components/timer/   timer UI
  components/tasks/   task queue UI                        [Phase 4]
  components/stats/   statistics UI                        [Phase 4]
  components/settings/ preferences UI                      [Phase 4]
src-tauri/  Rust backend: commands, tray, window events    [Phase 5]
```

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

## Conventions

- Components are function components with typed props. No `React.FC`.
- Prefer `cn()` from `@/lib/utils` for class composition.
- Icons come from `lucide-react`.
- All user-facing strings are plain text; the UI is English-only.
- Comments explain *why*, not *what*.

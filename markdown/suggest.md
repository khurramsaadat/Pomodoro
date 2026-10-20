# Suggestions — next steps

> Forward-looking notes. Recommendations for what to do next, in priority order.
> Written after mini mode shipped in `3c0f7e6`.
> Companions: [`input.md`](./input.md), [`prd.md`](./prd.md), [`plan.md`](./plan.md).

---

## 1. Recommended next: Phase 5, the Tauri tier

**Priority: high.** This is the phase the whole project has been structured
toward, and the web build is now feature-complete enough to be worth wrapping.

`AGENTS.md` already reserves the seams:

- `src/platform/` — the web/desktop boundary (`PlatformBridge`),
- `src-tauri/` — Rust backend: commands, tray, window events.

The mini timer makes the native tier genuinely valuable rather than cosmetic.
A web page cannot float above other applications; a native window can. A
mini timer that is genuinely useful on a desktop is one that sits above
everything else, and that is only possible in the native tier.

**Concrete first steps**

1. Scaffold `src-tauri/` with the v2 CLI and wire `npm run tauri dev`.
2. Define the `PlatformBridge` interface — the seam the app code talks to
   instead of talking to Tauri directly.
3. Add the commands the app needs: window always-on-top, window position, and
   a way to keep the mini window in sync with the main one.
4. Keep the import rule: `@tauri-apps/api` may only be imported **dynamically**
   inside `src/platform/tauri.ts`, so the web build stays Tauri-free.

**Watch out for:** the mini timer's position model is *corner + offset*,
which is exactly right for a browser viewport and roughly right for a native
window too — but a native window that is dragged by the OS does not snap to
corners. The snapping logic may need to become a platform-specific concern
rather than a shared one.

---

## 2. Close the `autoAdvanceTask` gap

**Priority: medium-high.** The behaviour is implemented and wired, but there is
**no UI control for it**. A user can only change it by editing `localStorage`
by hand. That is a real gap: the preference is invisible.

Phase 4 built `src/components/settings/preferences-panel.tsx`, so the control
belongs there alongside the existing switches.

**Note the related risk:** `autoAdvanceTask` defaults to `true`. Until the
toggle exists, a user who does not want it has no way to turn it off — and
the queue moving on by itself is a visible, potentially confusing behaviour.
This makes the missing toggle more than a cosmetic gap.

**Also worth adding at the same time:** focused tests for `soundEnabled` and
`autoAdvanceTask`. Both behaviours are implemented, and the manual browser
testing covered them, but neither has a dedicated automated test. The
`autoAdvanceTask` test in particular needs to pin the *ordering* — that the
check happens against the updated session count, not the pre-increment one.

---

## 3. Show the active task in the mini widget

**Priority: medium.** The widget shows the phase and the time, but not *what*
the user is working on. For a widget whose entire purpose is a cheap glance,
the task title is often the most valuable thing on it.

**Watch out for:** the widget is 240 × 150. A task title needs truncation with
an ellipsis and a `title` attribute for the full text. The phase colour
already carries the phase; the title should not compete with it.

**Design question:** the widget is a *timer*. Adding task context starts
turning it into a dashboard. Worth deciding deliberately rather than by
accumulation.

---

## 4. A genuinely useful improvement to the drag model

**Priority: low-medium.** Currently a single `offsetX`/`offsetY` pair is
stored, and the corner is derived from where the widget was dropped.

Two refinements worth considering:

- **Per-corner remembered offsets.** If the user parks the widget precisely at
  the bottom right, then later drags it to the top left, the bottom-right
  placement is lost. Remembering an offset per corner would make the widget
  feel much more like it "knows" where the user likes it.
- **Keyboard positioning.** The widget is currently mouse-only to move. Arrow
  keys on the focused handle would make it accessible and is a small addition.

The current model is deliberate and works. These are refinements, not fixes.

---

## 5. Reduce the tick cost

**Priority: low.** The countdown updates five times a second, and the widget
subscribes to `RemainingContext` directly, so only the countdown re-renders.
This is already the right shape.

But the tick is a `setInterval` driving a React state update. If profiling
ever shows this mattering, the next step is to drive the digit rendering
directly from a `requestAnimationFrame` loop that writes to the DOM, bypassing
React entirely for the number that changes.

**Do not do this pre-emptively.** The current implementation is simple and
correct, and the 5 Hz cost is negligible for a single small widget.

---

## 6. Process suggestions

### 6.1 Add the markdown folder to the repo conventions

These four documents — `input.md`, `plan.md`, `prd.md`, `suggest.md` — now
live in `markdown/`. If they are to be maintained rather than merely written
once, `AGENTS.md` should say so, and specify which document is updated when.

The natural rule: a feature updates `input.md` (the brief) and `plan.md` (what
was actually done) as it happens, and `suggest.md` is rewritten at the end to
carry the open questions forward.

### 6.2 Run the test suite directly, not through `cmd /c`

Worth recording, because it cost real time to diagnose. Invoking Vitest
through a `cmd /c` wrapper in this environment produces a spurious
`Vitest failed to find the current suite` failure across every test file.

```powershell
# Works reliably
npx vitest run

# Misleading failures
cmd /c "npx vitest run"
```

The suite itself is stable — 215/215 across repeated runs.

### 6.3 A "no `cmd /c`" rule for the test command

A stricter version of the above: when a tool fails in a way that looks
environmental, test the *invocation* before testing the *code*. Half the
diagnosis time went into clearing caches and rebuilding before the shell
wrapper was ever considered.

---

## 7. Summary table

| # | Suggestion | Priority | Effort | Blocking? |
|---|-----------|----------|--------|-----------|
| 1 | Phase 5 — the Tauri tier | High | Large | No |
| 2 | `autoAdvanceTask` settings toggle + focused tests | Medium-high | Small | No — but the feature is currently unreachable |
| 3 | Show the active task in the mini widget | Medium | Small | No |
| 4 | Per-corner offsets + keyboard positioning | Low-medium | Small | No |
| 5 | rAF-driven digit rendering | Low | Medium | No |
| 6 | Document the markdown workflow in `AGENTS.md` | Low | Trivial | No |

**Nothing in this list blocks the current release.** The mini timer is
complete, tested, and verified in the browser.



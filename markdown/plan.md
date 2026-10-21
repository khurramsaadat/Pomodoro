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
  setup hook, so a lookup by managed state found nothing â€” and
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
  serving it after an upgrade â€” old code against a new backend. The
  worker is now registered only on the web tier.

**The verification was the interesting part.** Driving the real app
through UI Automation â€” finding the "Hide to the system tray" button by
its accessible name, invoking it, and checking that the window was hidden
and the process was still alive â€” is what proved the flow. The unit
tests could not have caught any of it.

---

## Stage 10 - The dashboard's balance, and a mini timer that replaces it

**Commit:** the current commit.

The dashboard was measured rather than eyeballed. The clock column stood
1081 pixels tall and the workspace beside it 420, which left roughly 660
pixels of dead space under "Session settings" â€” and opening the mini timer
made it worse, because the widget was drawn *over* a dashboard that was
still there. Two timers, one of them enormous and irrelevant.

**Why here:** the mini timer was built as a floating widget drawn inside the
page, which was the only thing a browser could do. The native tier can do
better, and a feature that behaves differently on the two tiers is a feature
with two sets of bugs.

**The decision: the mini timer replaces the dashboard.** On the web tier the
page hides itself and draws the widget; on the native tier the app's own
window becomes a small frameless widget, and the dashboard is gone because
the window that held it is gone. Either way the user sees one timer.

**The decision: the empty space is filled with something worth reading.** The
session plan â€” the phases ahead, derived from the configuration â€” sits below
the tabs rather than inside one, because it is true whichever tab is open. The
clock column's three summary cards were also compacted from stacked blocks
into single rows, and the countdown ring was reduced, which took the column
from 1081 pixels to 827.

**The decision: the host owns the screen.** The native tier's window is moved
by the operating system, so the placement is the host's business. The
frontend remembers *which corner* the widget was left in and *how far from
it*, and the host turns that into a real position â€” the same corner-and-
offset model the web tier already used, so one implementation serves both.

**Two bugs that only a real native run found.** Both were invisible in the
tests, and neither could have been found there:

- **The window was scaled twice.** The size was set in physical pixels *and*
  multiplied by the display's scale factor, so a 240-pixel timer arrived on
  screen as 156. The size is now in physical pixels, with no multiplication.
- **The backend did not know the display's scale factor.** It reported one,
  while the webview inside it was drawn at one and a half â€” on Windows the
  desktop process is not per-monitor DPI-aware, so the two disagree. The
  measurements now cross the seam in physical pixels, and the conversion is
  done on the side that knows the true ratio: the webview, whose
  `devicePixelRatio` is exact.

**The verification was the interesting part again.** The native app was
driven through the WebView2 remote-debugging port, so Playwright attached to
the *real* desktop window rather than to a browser. That is what showed the
156-pixel window, and it is what proved the fix: the window is now 241 by
150, in the bottom right corner, with the dashboard gone.

---

## Stage 11 - "Working on" above the session settings

**Commit:** the current commit.

The active task and the daily goal moved out of the clock column and into the
workspace column, above the tabs, with the daily goal directly under the task.

**Why here:** the request was a layout change, but it exposed a structural
question the previous stage had left open â€” which column does the *work* live
in? The clock column is the *session*: what is running, and for how long. The
workspace column is the *work*: the task, the day's progress, the settings.
The two cards that answer *what am I working on* and *how far have I got
today* were answers about the work, sitting in the session's column.

**The decision: the pair reads as one.** The daily goal sits under the task
rather than beside it, because they are the same question asked twice â€” the
*what* and the *how far* â€” and a user reads them together.

**The bug the move exposed.** The `Card` primitive carries its own `py-6`, and
the cards' content added `py-3` on top of it, so every card was rendering
with far more vertical padding than it asked for. A two-line card measured 131
pixels instead of 83. The moved cards now cancel the primitive's padding with
`py-0`, and the two dropped by a third of their height.

**The measurement that settled it.** Moving the plan of the session into the
clock column balanced the columns too â€” 840 against 593 â€” but the clock column
is *sticky*, and 840 pixels is taller than the viewport of most laptops. A
sticky column that cannot fit on the screen is not a sticky column. "Up next"
stayed below the tabs, where it fills the space it was added to fill.

---

## Stage 12 - Always on top, and the end of hide-to-tray

**Commit:** the current commit.

The tray stays; the way the window was hidden to it does not. Closing the
window now ends the app, and the `KeepAlive` plumbing that made "hide to
tray" work is gone with it â€” the flags, the `hide_window` command, the
`ExitRequested` handler that prevented the process from ending, and the
`set_keep_alive` command that turned the whole thing on.

**Why here:** the request was a change of behaviour, and the behaviour was
spread across both sides of the seam. The web tier had a button that called
a method the bridge did not have; the native tier had three commands, a
managed state, and a runtime exit handler. Removing the behaviour meant
removing all of it, not just the button.

**What replaced it:** `set_always_on_top`. It is the same shape as the
command it replaced â€” one boolean across the seam â€” and it is the thing
that actually helps. A timer the user has to go looking for is a timer
whose deadline they will miss.

**The decision: the preference is the source of truth, and the host is
told.** The header button and the preferences switch both write the
`alwaysOnTop` preference; `usePlatform` watches it and tells the host. Two
places writing the host's state would be two places that could disagree
about it.

**The mini window needed a correction.** The widget is always on top â€” it
is a floating thing â€” but the dashboard is not necessarily. So the
mini-mode request now carries the preference, and leaving mini mode
restores the window to the state the *user* asked for rather than forcing
it down. The request is sent in one piece, as it always was, so the host
never sees the window half-applied.

**The verification was the interesting part again.** The native app was
driven through the WebView2 remote-debugging port, so Playwright attached
to the *real* desktop window. The close button was then pressed through
the operating system: the process went from one to zero, which is the
only way to prove that the app really ends rather than hiding.

---

## Stage 13 - Sounds the user can choose

**Commit:** the current commit.

`src/domain/sounds.ts` holds the catalogue â€” five sounds, each with a name
and a description â€” and `src/lib/audio.ts` holds the synthesis. The
domain knows *which* sounds exist; the library knows *how* they sound.

**Why here:** the cue was two sine notes, and a two-note sine chime is a
beep. A beep is easy to ignore, which defeats the purpose of the sound
entirely.

**The decision: a cue is a stack, not a wave.** Every sound layers a body
tone, a partial above it, and â€” for the struck ones â€” a short burst of
noise that is the *transient*. The noise is what stops them sounding like
electronic beeps; it is the click of a mallet on wood. The five cues are
deliberately different in shape and not only in pitch, because a
higher-pitched version of the same cue is hard to tell apart.

**The break that ends gets the next voice along.** The two phases are told
apart by their shape rather than by a second setting, so the user is not
asked to configure two things where one will do.

**The picker plays the sound.** A sound the user has never heard is a sound
they cannot choose between, so every option can be previewed.

---

## Stage 14 - Showing what has been done

**Commit:** the current commit.

The completed tasks are a *section* of the queue rather than a tail of it,
and the recent sessions come before the statistics in their tab.

**Why here:** both were *there* and both were invisible. The finished tasks
were sorted to the end of one list, so they were below the fold; the
session log was the second card in the statistics tab, so it was below the
fold too. A record nobody can reach stops being a record.

**The decision: the log comes first.** The statistics are derived from the
log â€” every number in the panel is recomputed from it â€” so the thing they
are derived from should be the thing that is read first. This is the same
argument that put the active task above the tabs in stage 11.

**The split is in the domain.** `splitTasks` in `src/domain/tasks.ts`
separates the open tasks from the finished ones, because the *view* should
not be deciding what the two groups are.

---

## Stage 15 - Backups, and what they are worth

**Commit:** the current commit.

`src/domain/backup.ts` is the whole feature as pure data: the shape of the
file, what counts as a valid one, and how to read one. The storage layer
and the settings panel are adapters around it.

**Why here:** a backup is only worth having if it can be *restored*, and
one that can be restored is only trustworthy if it is validated on the way
back in. Both halves of that are domain questions, not interface ones.

**The decision: a file that cannot be read is refused; a file that can be
read but is damaged is restored as far as it goes.** The distinction
matters. A corrupt file is refused outright, because half-reading it would
leave the workspace in a state the user did not ask for. A file with one
broken task in it is restored without that task, and *says so* â€” a silent
partial restore is worse than a refusal, because the user would not know
what did not survive.

**The validation was moved, not copied.** The task and history validators
used to live in `src/storage`. They now live in `src/domain`, and the
storage layer imports them, because an imported backup has to be checked
by exactly the same rules as a stored payload. Two copies of a validator
is two validators that will drift.

**The format has a version.** A file written by a later build is
recognised and refused rather than half-read.

---

## Stage 16 - A movable mini window, and a navigation bar

**Commit:** the current commit.

The footer, the mini window's drag, and the workspace bar.

**Why here:** the drag was reported as a missing feature and turned out to
be two defects â€” a permission that was never granted and an attribute used
in a way that could never have worked. Both were invisible from either
side of the seam.

**The decision: the bar is a `deep` drag region, and the controls opt out
explicitly.** Tauri's drag script walks the click's composed path and stops
at the first clickable element that is not itself a drag region. A bare
attribute matches only the element carrying it, so in a bar made of
buttons the drag could never have started. `deep` makes the whole subtree
draggable, and `data-tauri-drag-region="false"` on the two control buttons
keeps a click on them running the control rather than moving the window.

**The decision: the capability file grants `core:window:allow-start-dragging`.**
The drag script ends in a call to the `start_dragging` plugin command, and
that command is not in `core:window:default` â€” so the ACL refused it and
the attribute was a promise the app was not allowed to keep.

**The decision: the placement is computed in the virtual desktop, not the
monitor.** The anchor is measured from the monitor's top left, but
`set_position` takes a position in the arrangement of screens. The two are
the same number on one screen, which is why the bug was invisible until
there were two. The arithmetic is now a pure function â€” `screen_position`
â€” so it can be tested without a desktop.

**The decision: the tab root moves above the shell.** The navigation bar is
a tab list, so it has to be inside the tab root to know which tab is
selected; the tab content has to stay in the workspace column. Radix
connects them through context, not through the DOM, so the root now sits
above the shell with `display: contents` and takes no part in the layout.

**The shell became a fixed-height flex column** with a scrolling `main`,
which is what lets the bar be *outside* the scroll area and therefore
pinned to the bottom of the window.

**What only a real native run found.** The unit tests could not see the
ACL: `start_dragging` is refused or allowed by the host, and jsdom has no
host. Attaching to the running app over the WebView2 debugging port and
asking the host directly showed the command was denied before the fix and
allowed after it, and a real Win32 mouse drag moved the window exactly as
far as the mouse travelled.

---
## Stage 17 - The cog, the strip under the clock, and the sound

**Commit:** the current commit.

Five requests: a cog, a strip under the clock, auto-advance on, the queue
first, and the sound.

### The cog

`Settings2` in Lucide is the sliders icon; `Settings` is the cog. Both
usages were the sliders, and both are now the cog.

### The strip under the clock

The "working on" card moved out of the workspace column and became a
*strip* in the clock column, directly under the countdown.

**Why a strip and not a card.** The card answered the same question as
before, in a different column. The strip answers it *together* with the
countdown â€” the two are read as one thing, because the countdown says
how long is left and the strip says on what. A card in the workspace
column asks the eye to travel; a strip under the clock does not.

**Why it is a button.** The answer is a doorway: clicking it opens the
queue, which is where the answer is changed. That needed the tab
selection to be *controlled* â€” Radix's root forwards its ref to the DOM
element, so a ref is no use for changing the selection.

**Why it says what is next.** The queue moves on by itself, and until
now it did so silently. The strip names the task the queue will move to,
and only when the move is really going to happen: `selectNextTask` asks
whether the task will be over budget *after the next session* and whether
the user has asked for the queue to advance at all. A line that named a
task the app was not going to switch to would be worse than no line.

### The auto-advance

**The decision: the policy lives in one pure function.** `creditFocusSession`
in `src/domain/tasks.ts` credits the session and applies the policy, and
both the live timer and the catch-up on startup call it.

Splitting them is how the two paths came to disagree. The live timer
credited a session and then advanced; the catch-up credited every session
that had elapsed while the app was closed but never advanced, and
credited them all to the same task even when the first one had used up
its estimate. A user who closed the app mid-session came back to a queue
that had not moved, and the preference that says it should have was
quietly not honoured.

The catch-up also re-reads the active task for *every* completion, so a
second session that elapsed while the app was closed belongs to the task
the queue moved on to rather than to the one that was active when the app
was closed.

### The sound

Two defects, and the first is the one that made the cue unreliable.

**The suspended context.** `resume()` is asynchronous. The old code
called it and carried straight on, so the oscillators were scheduled
against a frozen `currentTime` and the whole gain envelope was laid out
in a window that had already passed. The cue was heard as a click, or
not at all, when the context finally woke up. The context is now
resumed *first*, and the cue is scheduled against the new clock â€” a
little in the future, so the attack and the decay both happen while the
context is rendering.

This was verified in a real browser, by instrumenting `AudioContext`:
the old code started the oscillators *before* the resume landed, with
`state: 'suspended'`; the new code starts them after, at `when = 0.05`.

**The alarm nobody listened to.** The desktop tier's alarm was emitting
`pomodoro://alarm` and nothing consumed it. The cue was played only by
the page's own tick, so a webview throttled hard enough to miss the
deadline stayed silent. The alarm now plays the cue as well.

**Why the deadline is the key.** Two independent clocks watch the same
deadline: the page's tick and the host's alarm. The deadline is the one
thing they agree on â€” it is the same `endsAt` the countdown is drawn
from â€” so it is what de-duplicates them. The phase cannot be the key,
because the phase recurs: the fourth focus session ends a phase called
`work`, and so does the fifth.

The alarm now carries the deadline as well as the phase, so the app can
tell an alarm about the phase it is showing from one about a phase that
ended long ago.

**The system notification has a sound.** The notification is the desktop
tier's only cue when the window is hidden, so a silent notification is a
timer that says nothing.

---

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
| 10 | 296 / 24 files + 11 Rust | green | green | green | the dashboard is balanced on every tab; the mini timer replaces it on both tiers; the native window is 241x150 in the corner |
| 11 | 298 / 24 files + 11 Rust | green | green | green | the order on screen is asserted, the phone layout stacks without a scrollbar, the mini timer still replaces the dashboard |
| 12 | 349 / 28 files + 11 Rust | green | green | green | the web tier hides the always-on-top control; the native app pins the window, and the close button ends the process |
| 13 | 349 / 28 files + 11 Rust | green | green | green | the picker lists five sounds, the preview plays, and the cue shapes are asserted to be distinct |
| 14 | 349 / 28 files + 11 Rust | green | green | green | the completed section is a section; the log card measures fully inside a 900-pixel viewport |
| 15 | 349 / 28 files + 11 Rust | green | green | green | a backup is exported and imported through the real file input; a corrupt file is refused and the workspace is left alone |
| 16 | 355 / 28 files + 15 Rust | green | green | green | the bar is pinned to the bottom of the window on both widths, with no horizontal scrollbar; the native mini window is dragged with a real mouse and moves with it |
| 17 | 385 / 28 files + 15 Rust | green | green | green | the cue is scheduled after the context resumes, the alarm plays it too, the queue advances on the catch-up as well as live, and the strip names the next task |

**Current state:** 385 tests across 28 files and 15 Rust tests, typecheck,
lint, the production build and the native release build all clean.

---


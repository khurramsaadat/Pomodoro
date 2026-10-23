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
---

## Stage 18 - One brand, one settings tab, and a window that fills the screen

**Commit:** the current commit.

Six requests: the brand, the navigation, the session settings, the
shortcuts, the sound, the maximized window, and the dashboard order.

### The brand

`public/app-icon.svg` was already the mark — a tomato in the app's teal,
with gold leaves — but the header showed Lucide's generic clock glyph,
the favicon was a second drawing (`public/favicon.svg`), and the Tauri
icons were whatever the last build had produced.

**One source, four consumers.** The favicon, the header, the web
manifest and the service worker's cache list now all point at
`public/app-icon.svg`, and the Tauri icons are regenerated from it. The
old `public/favicon.svg` is deleted rather than left as a second,
competing mark.

**Why the header matters.** The header's glyph is the app's face in the
one place the user looks at all times. A generic clock says "a timer";
the tomato says "this timer".

### The navigation

The Session tab is gone. It held a single card, which made it a
destination the user had to *learn* in order to find a setting — the
worst kind of tab, because a tab that always exists is a promise that
there is something in it.

The session settings are now the first card in **Settings**, above the
sound picker, and the bar offers Tasks, Stats and Settings. The session
card and the settings card are separate components, so the move was a
matter of where they are rendered, not of what they are.

### The shortcuts in two places

The shortcut list was only in a small icon in the corner of the header.
It is now in the settings panel as well.

**One component, two homes.** `ShortcutList` draws the list, and both
the header dialog and the settings panel render it. The global shortcut
(`Ctrl+Shift+Space`) is only listed where the host supports it, so the web
tier does not advertise a key that does nothing.

### The sound

The *Preview* button asked the user to make a choice and then to make a
second one. Choosing an option now plays it, so the sound the user hears
is the sound they picked, and the button is gone. **Marimba** is removed
from the catalogue, leaving Chime, Bell, Pulse and Digital.

### The maximized window

The desktop window opens maximized (`"maximized": true` in
`tauri.conf.json`).

**Why this needed the Rust side.** A maximized window cannot be resized,
so `set_size` for the mini mode would have been refused by the host.
`src-tauri/src/mini.rs` now unmaximizes *before* resizing into the
widget, remembers whether the window was maximized, and restores that
state when the dashboard comes back. The transition is unchanged; only
the precondition is.

**Two defects surfaced while doing it.** Both were in the code the
change touched, and neither would have shown up in the browser.

*The dashboard was restored at the widget's size.* The restore clamped
the requested size with `MAX_MINI_WIDTH` and `MAX_MINI_HEIGHT` — the
*widget's* bounds, 640 by 640 — so a dashboard asking for 1180 by 820
came back 640 by 640. The two bounds now exist separately
(`MAX_DASHBOARD_WIDTH` and `MAX_DASHBOARD_HEIGHT`), and a test pins the
fact that the dashboard is restored at the size it asked for.

*The remembered state could be overwritten by itself.* The maximized
state was captured on every request to enter mini mode, but a widget
reports itself as *not* maximized, so a second request would have
replaced a remembered `true` with a `false` and the dashboard would have
come back smaller than the user had it. The capture is now a
*transition* — it happens when the window actually changes from the
dashboard into the widget — and the rule lives in a `MiniState` struct
that can be tested without a real window.

### The dashboard order

The daily goal moved below the task queue. The queue is *what* the user
is working on; the goal is *how far* they have got. A progress bar
answers a question about the work, so it belongs after the work.

---

## Stage 19 - A compiler option that was going to break the build

**Commit:** the current commit.

The editor reported that `baseUrl` is deprecated and would stop working
in TypeScript 7.0, and offered `ignoreDeprecations` as the way to
silence it.

**The suggested fix is the wrong fix.** `ignoreDeprecations` is a
suppression flag, and it suppresses the *message*, not the problem. The
option is removed in TypeScript 7.0, where it is a hard error:

```
error TS5102: Option 'baseUrl' has been removed. Please remove it from
your configuration.
```

That was verified rather than assumed: TypeScript 7.0.2 was installed
into a scratch directory and run against the project with `baseUrl` still
present. Suppressing the warning would have produced a build that is
quiet today and broken the day the toolchain is upgraded.

**The option was redundant anyway.** `baseUrl` was set to `.` in both
`tsconfig.app.json` and `tsconfig.node.json`, and its only purpose was
to be the base that `paths` resolves against. Since TypeScript 4.1,
`paths` is resolved relative to the *tsconfig file* when `baseUrl` is
absent, so the two lines were doing nothing that the `paths` block does
not already do.

**What was checked before removing it.** Every bare specifier in `src`
is a real package — `clsx`, `react`, `react-dom/client`, `sonner`,
`tailwind-merge`, `vitest`, `zustand` — and the 176 `@/…` imports all
go through `paths`. Nothing anywhere in the tree resolves a file through
`baseUrl`.

**The result.** `baseUrl` is removed from both tsconfigs and nothing
else changes. The project compiles under the installed TypeScript 5.9.3
and under TypeScript 7.0.2, with the 388 tests, the lint and the
production build all green.

---



## Stage 20 - Ambience, two notification switches, and a ring that breathes

**Commit:** the current commit.

Seven requests in one: background sound, on/off notifications, a taskbar
flash, a breathing ring, the removal of the session plan, one row of data
controls, and an About button.

**The decision: the ambience is synthesised, and it follows the timer.**
There are no audio files. The noise is generated into a looping buffer, the
rain is filtered white noise, the waves are brown noise under a slow
oscillator, and the fire and the forest add an irregular event on top of a
bed. The sound is started and stopped by the *engine* rather than by the
settings panel, because the panel is unmounted whenever the user is on
another tab — an ambience that stopped when the user looked at their queue
would be an ambience that never played for a whole session.

**The decision: the notification preference travels with the alarm.** The
desktop alarm fires on its own thread, long after the page could have been
asked anything, so `notify` and `attention` are captured into the request
rather than read when it fires. The native tier's toast and its
`request_user_attention` call are both gated on those flags.

**The decision: the switch follows the permission.** On the web the browser
has to grant notifications first, and it only asks from a user gesture —
the switch is that gesture. If permission is refused the switch goes back
off and says why, because a toggle that stays on after a refusal is a
promise the app cannot keep.

**The decision: the breath is derived from the phase.** `src/domain/breathing.ts`
is the rhythm — an inhale, an exhale, and a swell that rises and falls —
and the timer panel feeds it the phase's elapsed time (the banked time plus
the segment being served), so the breath starts with the session. The ring
scales by a transform rather than by geometry, and the hook reads the
reduced-motion preference, so a user who has asked for less motion gets a
still ring.

**The decision: the five data controls are one row.** Export, import, the
two clear actions and About all act on what the user has saved, so they are
a single wrapping row; About sits beside Clear history because it is where
the saved data lives on disk.

**The decision: the location crosses the seam.** The About dialog asks
`platform.storageLocation()` rather than guessing, so the desktop answers
with its resolved app-data directory and the browser answers with the
site's storage. Neither the dialog nor anything above the seam knows which
one it is on.

**What only the build and the compiler found.**

- `storage_location` was written, its capability was granted in the ACL and
  in `build.rs`, and it was **missing from the `invoke_handler` list** — so
  the dialog would have shown "Unknown" on the desktop for ever. Rust's
  `dead_code` warning was the only thing that noticed a command the host
  could not call.
- `AmbienceSession.release` was required by the interface and never built,
  and the generation counter that stops a late audio resume from starting
  the wrong sound was declared and unused. Both are now real: the fire
  tracks its pending crack timeouts and clears them on stop, and every
  start is checked against the newest request before it plays.
- `request_user_attention(None)` was written as "the gentlest request".
  The parameter is the request to *make*, so `None` is a cancellation: the
  flash would never have happened, and nothing would have failed. The kind
  has to be named — `Informational` is the gentle one — and that is the
  sort of mistake that reads as intent in review.
- Two files from an abandoned first pass — a Manage card and the session
  plan — were wired to nothing. They are gone rather than left as dead
  components: an import that no one makes is not the same thing as a
  feature.

**The verification.** 417 tests across 32 files and 21 Rust tests, with the
typecheck, the lint and the production build green. The new settings were
driven in the built web app: the ambience picker lists all six sounds plus
None and remembers the choice, the notification switch is present, and the
five data controls — including About — sit in one row.

**The desktop verification went further.** Both installers were built, and
the release app was driven through the WebView2 debugging port — the same
window the user sees, not a browser standing in for it:

- **About resolved the real path**, `C:\Users\Khurram\AppData\Local\com.khurram.pomodoro`,
  which is the folder the host names and the dialog asks for. Before the
  handler was registered it would have said "Unknown", and no browser test
  could have caught that.
- **The two switches are independent.** Notifications off left the taskbar
  flash on; each toggled, persisted, and survived a read-back from the
  stored payload.
- **The alarm fired with the window minimised.** The log records
  `the notification for longBreak was shown` and `the window asked for
  attention` at the deadline, with no failure line — the exact background
  case the feature exists for.
- **Turning notifications off silenced the next deadline** — zero show
  lines — while the attention request was still made. The two preferences
  travel separately and take effect separately.

The verification also exposed two things the tests could not. The attention
request left no trace when it succeeded, so "it flashed" could only be
taken on trust; it now logs, like the notification. And every line was
written to the log file twice: the logger's defaults already include all
the targets, and two were added on top of them. Both were fixed and the
installers rebuilt before the run above.

---

## Stage 21 - The footer the desktop window never showed

**Commit:** the current commit.

The report was one sentence: the desktop app opens without the footer. The
cause was the layout's own cleverness. The copyright was placed at the *end*
of the scrolling column so that it would not compete with the navigation bar
for the bottom of the window — the right place for a page footer and the
wrong place for this one, because a maximised desktop window shows a
dashboard taller than the viewport and the end of the scroll container is a
place the user has to travel to.

**The decision: the footer is chrome, not content.** It is a `shrink-0`
strip between the scrolling column and the navigation bar, outside the scroll
container. The content column is the only thing that gives way, so the
footer is on screen at any window size and any scroll position, and the bar
stays the last thing in the window.

**The regression test.** It asserts the footer is not a descendant of
`main` and that it precedes the navigation bar in document order. Both are
layout facts jsdom can check without a screenshot, and they are the two
things that would have to be true for this bug to come back.

**Verified in the built app.** At the dashboard's 1180 by 821 window, the
footer's box is 37 pixels tall at y 720–757, the navigation bar starts at
exactly 757, and the scroll container is 718 pixels of content in 664
pixels of space. `footerInScrollArea: false`, `scrollTop: 0`, and the
footer inside the viewport — the content scrolls under a footer that does
not move.

---

## Stage 22 - The task line under the timer controls

**Commit:** the working tree (shown on the dev server at the user's request).

Two requests, one outcome. First the working-on strip moved out of the clock
and into the workspace, above the daily goal; then the user asked for it to
be *removed* from the right pane and "just mentioned in the clock itself,
below the play button". The second request is the one that shipped.

**The decision: a mention, not a card.** The clock answers *how long is
left*; the one thing it was missing is *on what*. A single line under the
controls — the target glyph, the words *Working on*, and the task's title —
answers it without taking a strip of the workspace to say it. The title
truncates with the full value in `title`, so a long task cannot push the
controls around.

**What went with the card.** The progress bar, the *n/m* count and the
"Next: …" line were part of the old strip, and they leave with it. The
queue is one click away and already shows all three; repeating them in the
clock was what made the strip large enough to be moved twice.

**The consequence, stated plainly.** The line is inside the clock column,
so it is permanent again — visible on every tab, like the countdown above
it — which is the property the workspace placement had lost.

**The tests pin the geometry.** The line is inside the clock, it comes after
the controls in document order, it is absent from the workspace, and it
says "No active task" when there is none.

---

## Stage 23 - A bigger clock, a glyph per phase, and a play button in the queue

**Commit:** the working tree (shown on the dev server at the user's request).

Three requests, and each one is about the same thing: the phases should be
recognisable before they are read, and starting one should not require a
trip back to the clock.

**The clock.** The ring went from 240 to 320 pixels and the digits from
4xl/5xl to 5xl/6xl. The countdown is the thing the app is named after, and
it was sharing the column with a card that has since left it; the extra
height is now free to spend on the clock.

**The dial.** The ring now carries sixty hour and minute marks — twelve
long ones at the hours, four short ones between each pair — drawn inside
the track so the arc passes over them. The marks are what make the circle
read as a clock rather than as a progress bar that happens to be round. The
stroke thinned from 8 to 6 viewBox units, and the breath grew from 3.5 to 5
per cent so the swell is perceptible rather than theoretical.

**The glyphs.** A `PhaseIcon` component draws a focus mark, a cup with steam
and an armchair from one place, and both the session-length labels and the
countdown badge render it. The first attempt kept an icon record in
`lib/phase.ts` and chose a component during render; the lint rule for
components created during render is right to reject that — a component that
is a different function on every pass remounts on every pass. The switch
inside `PhaseIcon` is the version that survives a re-render.

**The play button.** A task row now starts a session: `startFocusOn` makes
the task active, calls the engine's `start` — the same call the clock's own
button makes, so the two cannot disagree about whether the timer is running
— and plays the user's cue at a lower volume than a completion. The cue
respects `soundEnabled`, because a user who switched the sound off switched
it off for this too.

**What was checked.** Typecheck, lint and all 414 tests are green. In the
browser the digits measure 60 pixels, the three labels carry
their glyphs, and pressing play on the inactive task made it active and took
the timer from paused to running without a reload.

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
| 18 | 388 / 28 files + 21 Rust | green | green | green | the brand is the app's own mark in the header, the manifest and the favicon; the bar offers three workspaces; the settings panel carries the session settings and the shortcuts; choosing a sound plays it |
| 19 | 388 / 28 files + 21 Rust | green | green | green | the project compiles under TypeScript 5.9.3 and under 7.0.2, with no deprecated compiler option left behind |
| 20 | 417 / 32 files + 21 Rust | green | green | green | the picker lists six sounds plus None, the five data controls share one row, the session plan is gone; in the built desktop app both switches persist, About resolves the data folder, and a minimised window's deadline flashes with no notification when notifications are off |
| 21 | 418 / 32 files + 21 Rust | green | green | green | in the built desktop app the footer measures y 720–757 in an 821-pixel window, the nav begins at 757, and the scroll container is taller than its viewport — the content scrolls under a footer that never moves |
| 22 | 414 / 32 files + 21 Rust | green | green | green | the task line sits under the timer controls inside the clock, the right pane carries only the queue and the goal, and the line says "No active task" when the queue has none |
| 23 | 414 / 32 files + 21 Rust | green | green | green | the dial renders 60 marks (12 of them major) at 320 pixels with a 6-unit stroke and a breath that moves the scale between 1.02 and 1.05; the three session labels carry their glyphs, and a task's play button makes it active and starts the clock |


**Current state:** 414 tests across 32 files and 21 Rust tests, typecheck,
lint and the production build all clean. The native release build is
unchanged by this stage — the layout is the same code on both tiers.

---


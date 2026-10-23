# Suggest - recommended improvements

> Overall improvements to this app, refreshed after every completed task.
> Companions: [`input.md`](./input.md) (prompts), [`prd.md`](./prd.md) (requirements),
> [`plan.md`](./plan.md) (stages).

---

## Shipped

The four correctness defects and the enhancements below have been built. They
are listed here so the record stays complete, and so the next review does not
re-propose them.

| # | Item | Status |
|---|------|--------|
| 1 | The streak broke across a daylight-saving boundary | **Fixed** - calendar arithmetic, with a fixed-time-zone regression test |
| 2 | "Interruptions" could never be non-zero | **Fixed** - an abandoned focus session is a voided history entry |
| 3 | "Reset session" reset nothing the user could see | **Fixed** - the counters are cleared |
| 4 | The summary's "Focus time" was an estimate | **Fixed** - the measured duration is banked |
| 5 | The active task in the clock column | **Built** - title, progress, and estimate |
| 6 | The `autoAdvanceTask` settings toggle | **Built** |
| 7 | Rename `SessionSummary` | **Built** - it is now the session-status card |
| 8 | Let tasks be edited | **Built** - inline edit of the title and the estimate |
| 10 | Keyboard shortcuts | **Built** - space/K, arrows/J/L, documented in a dialog |
| 11 | A week view in the statistics | **Built** - the seven-day chart with calendar-day buckets |
| 14 | The daily goal as a progress bar | **Built** - above the tabs, under the task |
| 15 | Installable and offline-capable | **Built** - a service worker and a richer manifest |
| 16 | Prune the unused dependencies | **Done** - four Radix packages dropped, two put to use |
| 17 | Expose the history in the UI | **Built** - the "Recent sessions" list |
| 18 | Show which task a session is spent on | **Built** - the active-task strip |
| 19 | The native tier - the Tauri desktop app | **Built** - the tray, the global shortcut, always-on-top |
| 20 | Notifications when the window is in the background | **Built** - the native alarm, scheduled against the deadline |
| 21 | An installable desktop app | **Built** - an NSIS installer and an MSI |
| 22 | A mini timer that replaces the dashboard | **Built** - the native window becomes the widget; the web tier hides the dashboard |
| 23 | The dead space under "Session settings" | **Built** - the session plan, and a compacted clock column |
| 24 | "Working on" above the session settings | **Built** - the task and the daily goal moved above the tabs |
| 25 | The window can be kept above the others | **Built** - a persisted preference, in the header and in the settings |
| 26 | No more hiding the app from its own close button | **Built** - closing the window ends the app; the tray stays as a control panel |
| 27 | Completion sounds the user can choose | **Built** - four layered cues, played as they are chosen |
| 28 | The completed tasks are visible | **Built** - a section of their own, not a tail of the queue |
| 29 | The recent sessions are easy to find | **Built** - the log comes before the statistics derived from it |
| 30 | Import and export | **Built** - a versioned file, validated on the way back in |
| 31 | A mini window the user can actually move | **Fixed** - the drag permission was missing and the drag region could never have matched |
| 32 | The mini window on a second monitor | **Fixed** - the placement is computed in the virtual desktop |
| 33 | The workspaces in a bar at the bottom of the window | **Built** - a pinned navigation bar, outside the scrolling area |
| 34 | The settings icon looked like sliders, not a cog | **Fixed** - `Settings`, not `Settings2` |
| 35 | What you are working on, under the clock | **Built** - a strip with the title, the progress, and what comes next |
| 36 | The queue comes first, and the app opens on it | **Built** - the queue leads the bar and the app opens on it |
| 37 | The auto-advance was not honoured on the catch-up | **Fixed** - one policy, used by both paths |
| 38 | The cue was a click when the context had been suspended | **Fixed** - the context is resumed before the cue is scheduled |
| 39 | The native alarm fired into the void | **Fixed** - the alarm plays the cue, and the notification has a sound |
| 40 | The app had no mark of its own | **Built** - one icon for the header, the favicon, the manifest and the desktop icons |
| 41 | The Session tab held a single card | **Built** - the session settings moved into the Settings tab |
| 42 | The keyboard shortcuts were hidden in a corner icon | **Built** - the same list is in the settings panel |
| 43 | The sound had to be chosen and then previewed | **Built** - choosing a sound plays it |
| 44 | The desktop window opened at a fixed size | **Built** - it opens maximized, and the state survives mini mode |
| 45 | The daily goal sat above the task queue | **Built** - the queue comes first |
| 46 | The dashboard came back at the widget's size | **Fixed** - the widget and the dashboard have their own bounds |
| 47 | The remembered maximized state could overwrite itself | **Fixed** - the capture is a transition, and it is tested without a window |
| 48 | `baseUrl` was a compiler option waiting to be removed | **Fixed** - removed; the project compiles under TypeScript 5.9.3 and 7.0.2 |
| 49 | A background sound the user can choose | **Built** - six ambiences plus silence, each synthesised, with a volume of its own |
| 50 | Notifications that can be turned off | **Built** - and the switch follows the permission it asks for |
| 51 | The taskbar flash | **Built** - native-only, and it asks to be noticed without stealing focus |
| 52 | A ring that breathes | **Built** - an eight-second rhythm drawn from the phase, still under reduced motion |
| 53 | The session plan below the tabs | **Removed** - at the user's request; the clock and the workspace carry the app |
| 54 | The data controls in one row | **Built** - export, import, both clears, and About |
| 55 | Where the app keeps its data | **Built** - the About dialog, answered by the host rather than guessed |
| 56 | The footer the desktop window never showed | **Fixed** - it is chrome now, a strip above the navigation bar, outside the scroll container |
| 57 | "Working on" above the daily goal | **Superseded** - the card was replaced by a one-line mention under the timer controls |
| 58 | The destructive buttons asked with the browser's own dialog | **Built** - they arm in place and clear on the second click |
| 59 | The shortcut list was a wall of rows in the settings | **Built** - a section that opens by default and folds with a chevron |
| 60 | The clock was small for the thing the app is named after | **Built** - a 320-pixel dial with hour marks, a thinner stroke and larger digits |
| 61 | The three phases were words and nothing else | **Built** - a glyph each, in the settings and in the phase badge |
| 62 | A session could only be started from the clock | **Built** - a play button on every open task starts it |
| 63 | The start cue was the completion cue | **Built** - a two-note start motif per sound |
| 64 | The widget had no phase glyph | **Built** - it wears the same `PhaseIcon` as the dashboard |
| 65 | The goal could only count sessions | **Built** - sessions or measured focus minutes |
| 66 | The ambience played through breaks too | **Built** - scoped to focus, breaks, or both |
| 67 | The pin was all-or-nothing | **Built** - it can follow the phase |
| 68 | The bar carried no information | **Built** - a count of open tasks |
| 69 | A swallowed shortcut failed silently | **Built** - a short note says why |
| 70 | `Card` doubled every card's padding | **Fixed** - the primitive is unpadded; each card declares its own |
| 71 | Em dashes in the app's copy | **Fixed** - the strings read as sentences, and the built bundle contains none |
| 72 | The ambience icons were all black | **Built** - each sound carries its own hue, idle and selected, in both themes |
| 73 | The app gave no sign that a button had been pressed | **Built** - press feedback everywhere, entering queue rows, a popping check, and two quiet toasts |
| 74 | The summary's icons were small, grey and unexplained | **Built** - 18 pixels, coloured by meaning, with a keyboard glyph on the shortcuts section |

---

## Correctness first

These are defects, not enhancements. Each one is visible to a user today.

### 1. The streak breaks across a daylight-saving boundary

`currentStreak` walked back with `now - offset * 86_400_000`. A day is not
always 86 400 000 ms, so on the day the clocks go back the same day was
visited twice and the day before it was skipped.

**Now fixed.** The walk steps back by *calendar* day, through the
`shiftLocalDay` helper in `src/lib/time.ts`. The same bug was latent in
`focusMsByDay`, which built the chart's window the same way, and it was
fixed there too.

The regression test lives in `src/domain/streak.test.ts` and pins the time
zone to `America/New_York`. It fails against the old implementation in four
places, and the zone must stay fixed: the bug is invisible in UTC.

### 2. "Interruptions" is a metric that can never be non-zero

The action existed - `recordInterruption` in the domain, `interrupt` on the
store, `interrupt` on the engine context - but no control ever called it.

**Now fixed.** Skipping a focus session that had begun now voids it: the
session is written into the history as a *voided* entry, and the interruption
count includes it. A voided entry is excluded from every count of completed
sessions, so the skip still counts towards nothing - the session total, the
daily goal, and the streak are all unaffected.

A phase that never started is not voided. Abandoning a session the user never
began is not an interruption.

### 3. "Reset session" resets nothing the user can see

`resetSession` preserved `totalWorkSessions` and `totalInterruptions`, which
are precisely the two numbers the session summary displays.

**Now fixed.** The counters are cleared along with the cycle. The *history*
is not touched: the log is append-only, and the sessions that really happened
stay in it whatever the timer is reset to.

### 4. The session summary's "Focus time" is an estimate, not a measurement

`focusMinutes` was `totalWorkSessions * config.workMs` - a session count
multiplied by the *current* focus length.

**Now fixed.** `TimerState.completedFocusMs` banks the *measured* duration of
each focus phase as it completes, and the summary shows that. A snapshot
written by an older build is repaired on read rather than discarded, so the
number does not jump when the app is upgraded.

---

## Recommended next

> Shipped since this list was written: **22, 32, 38, 40, 49, 51, 54, 56** —
> see the Shipped table. The rest below are still open.

### 71. Keep the copy free of em dashes without a manual sweep

The rule is now written down, and the only thing enforcing it is a scan run
by hand. A test that walks the source strings and the built bundle and
fails on U+2014 would make the rule a property of the build rather than a
habit of the author. It is the same scan already used to verify this
change, so the cost is the test, not the logic.

### 54. The start cue should be a sound of its own

Starting a session now plays the user's completion cue quietly, which is
good enough and slightly wrong: the same sound means *started* and
*finished*. A one-note motif from the same instrument would say which of the
two happened without a second setting to explain.

### 55. Starting from a task should say what it will do to a break

Play on a task starts the clock wherever the cycle is — so pressing it
during a break starts the *break*, not a focus session on that task. That
is coherent and surprising. The button could name the phase it will start,
or a press during a break could skip to the focus first.

### 56. The mini timer should wear the phase's glyph

The widget shows the phase's colour and its label. The glyph now exists and
is the fastest of the three to read at widget size — one line in the mini
timer would make it as legible as the dashboard.

### 19. Export the history as CSV

The JSON export exists, but CSV is the format a spreadsheet reads without
help, and the data is already in the right shape for it. The conversion is
small; the value is that the history finally leaves the app.

### 20. Let a session be attributed to a task chosen *after* it ran

A focus session is credited to whatever task was active when it completed.
If the user realises afterwards that the session belonged to a different task,
there is no way to say so - the entry is immutable, which is right for the
statistics but wrong for a mis-filed session.

The honest fix is a *correction* entry rather than an edit: the log stays
append-only, and the statistics learn to apply the correction.

### 21. A week view that spans weeks, not just days

The seven-day chart is now correct across a daylight-saving boundary, but it
still shows a rolling window. A user who wants to see *this week* - Monday
to Sunday - cannot. A calendar-aligned view answers "how was last week?"
where a rolling window answers "how were the last seven days?".

### 22. A focus goal measured in time, not in sessions

The daily goal counts sessions, so a day of eight 15-minute sprints and a day
of eight 25-minute sessions look identical. A user who changes the focus
length mid-week would see their day change shape without their effort
changing at all. The measured focus time is now banked, so the goal could
count minutes instead - or offer both.

### 23. Remember the phase across a restart

The catch-up replays the phases that elapsed while the app was closed, and
the timer lands somewhere sensible. But a user who closes the app mid-focus
and reopens it hours later finds the phase *advanced* rather than *resumed*.
Resuming the interrupted phase, with the elapsed time banked, would match
what the user expects from a timer they put down and came back to.

### 24. Notifications when the window is hidden

**Now built, in the native tier.** The chime still only plays if the tab is
alive and unmuted on the web, and that is a browser limitation the app
should not fight: the Web Notifications API would need a permission the app
has no business asking for by default.

The native tier does not have the limitation. The alarm is scheduled against
the timer's own deadline and runs on its own thread, so a phase that ends
while the window is hidden still notifies *on time* rather than whenever the
user brings the window forward.

**Now built on both tiers, as a preference.** The notification can be
switched off, and the desktop alarm carries the flag into its own thread so
a window that is not being painted still obeys it. On the web the switch asks
for permission and only stays on if the browser grants it — the app no longer
pretends to promise something the browser can refuse.

### 25. Begin Phase 5 - the Tauri native tier

**Now built.** The `PlatformBridge` seam exists in `src/platform`, the Rust
backend is in `src-tauri`, and the desktop tier has the system tray, the
global shortcut, the window that hides to the tray, and the native
notification.

The seam is the part worth keeping. The web build loads no Tauri code at
all - the runtime is imported dynamically and only when it is actually
present - so the two tiers share a source tree without sharing a runtime.

### 26. Let the timer be paused by the operating system

When the laptop sleeps, the deadline passes in real time and the session is
recorded as complete. A user who closed the lid for two minutes loses a focus
session to a sleep that was never a choice.

**The native tier is now in a position to solve this.** It can observe the
suspend and resume events and tell the engine to bank the time as paused -
the engine already has the machinery for it, because `elapsedMs` banks the
time a phase has already served.

What is missing is the *meaning* of a suspend. Two readings are possible and
they are not the same decision: the user closed the lid on purpose and the
session should stop, or the machine slept under them and the session should
have continued to run. The second reading is the honest one for a timer
whose whole claim is that it keeps time, but it means a session can complete
while the user never saw it happen. The banked time and the completed
session are both facts, and the history would need to say which it was.

### 27. A notification the user can act on

The native toast says that the phase is over, and nothing else. It has no
button, so the user has to find the window to start the next session - which
defeats the point of a notification that fires while the window is hidden.

The plugin supports action types, and the tray's *Start / pause* item
already drives the timer from outside the window. A toast with a "Start
break" button would close that loop: the notification would not merely
report the phase ending, it would be the way through it.

The work is on both sides. The Rust side has to register an action type
and listen for it; the frontend has to answer the action with the same
toggle the tray uses. It is the same seam the tray already proved.

### 28. A tray tooltip that reads better

The tooltip is the countdown and the running state, which is right and
terse. It is also the only place the user can see the timer without
opening the window, so it is worth a little more: the phase's name, and
perhaps the task the session is being spent on.

### 29. The mini window should remember the display it was on

The widget remembers the *corner* it was left in and how far from it, which
survives a resize and a reload. It does not remember the *display*. On a
machine with two monitors, a widget left in the bottom right of the
secondary screen comes back in the bottom right of whichever screen the
window happens to open on.

The fix is small and sits in the same place as the rest of the placement
logic: store the monitor's identity alongside the corner, and prefer that
monitor when placing the window. The native tier already asks the operating
system which monitor the window is on; it is the information the placement
needs and does not yet use.

### 30. The web tier's mini timer should be able to leave the page

The web tier draws the mini timer inside the page, which is the best a
browser can do. It is still a widget *on a page*, though: the tab has to be
open and the tab has to be in front.

The browser has an answer for this that the app does not use — the
`Picture-in-Picture` API, or a `Document Picture-in-Picture` window. That
would let the web tier's timer float above other applications, which is the
one thing it genuinely cannot do today. It is a real API, it is
Chromium-only at the moment, and it would need a fallback for the browsers
that do not have it. Worth doing only if the web tier is meant to be a
first-class citizen rather than a demonstration.

### 31. Measure the layout, do not eyeball it

The dead space in the dashboard was obvious once it was measured and
invisible while it was being built. The two numbers that mattered — the
height of the clock column and the height of the workspace — are now
different by 107 pixels rather than by 661, and the second column has real
content on every tab.

The measurement itself is cheap: a script that opens the app, reads the
bounding boxes of the two columns, and prints them. Making it part of the
routine check, rather than something done once when someone notices, is
what would keep the columns balanced as the app grows.

### 32. The `Card` primitive's padding is doubled by every card

`Card` carries `py-6` and every card's content added its own `py-3` or
`py-4` on top, so each card rendered with roughly twice the vertical
padding it asked for. The two cards that moved above the tabs were
measuring 131 pixels tall for two lines of text; cancelling the
primitive's padding with `py-0` brought them to 83.

The general fix is in the primitive rather than in the callers: `Card`
should not carry vertical padding at all, and each card should declare
its own. Nothing else in the app is affected today, because the other
cards happen to be tall enough for the doubled padding to look
deliberate — but it is a trap for the next card someone writes, and it is
a trap that reads as *design* rather than as a mistake.

### 33. A sticky column has to fit on the screen

Moving the session plan into the clock column balanced the two columns
better than leaving it below the tabs — 840 pixels against 593, rather
than 592 against 893. It was the wrong move anyway, because the clock
column is `lg:sticky`: at 840 pixels it is taller than the viewport of
most laptops, so the plan at the bottom of it would never be visible
without scrolling, and the column would not stick.

The rule this suggests: **a sticky column's height is a budget, not a
result.** The sum of what goes in it has to fit in a viewport, and the
natural way to discover that is to measure, not to balance. Balancing the
columns is a proxy for the real goal, which is that nothing important is
below the fold.

### 34. Say which column a thing belongs in

The move that was asked for — the task and the daily goal above the tabs
— turned out to answer a question the layout had never been explicit
about: the clock column is the *session* (what is running, for how long),
and the workspace column is the *work* (the task, the day's progress, the
settings). The two cards that answer "what am I working on" and "how far
have I got today" are answers about the work, and they were in the
session's column.

Writing that down in the two columns' own doc comments would make the
next placement question answerable without a screenshot. It is the same
reason the platform seam has an interface: a stated boundary is one that
does not erode.

---

## Longer-term

### 35. A shift-shaped view of the day

The statistics answer "how much did I do" but not "when". A user who wants to
know whether their focus time lands in the morning or the evening has no way
to find out, even though the log has the timestamps. A day split into hours
would answer it.

### 36. A "what changed" note in the history

The log is append-only and correct, but a user reading it sees a flat list.
Marking the sessions that were interrupted, that ran long, or that happened
outside the usual hours would make the log tell a story rather than a
schedule.

### 37. Backups should be scheduled, not only on demand

The backup is a file the user has to remember to make. A desktop app could
write one automatically — a dated copy in a known folder, keeping the last
few — so the file exists *before* the day it would be needed is the day it
is needed.

The web tier has no filesystem, so the honest version is a periodic download
the browser asks the user to allow, which is a worse experience. That
difference is worth stating rather than papering over.

### 38. The always-on-top preference should follow the phase

The window is pinned while a focus session is running and unpinned during a
break, because that is when the user is looking at something else. It is a
small thing, and it is a guess — but the app already knows which phase it
is in, and the guess is a better one than "always" or "never".

### 39. The sound catalogue could grow

Four cues is enough to choose between and few enough to remember. A user
who wants a sound of their own would need an upload path, which is a
different feature with a different risk: a file the app plays is a file the
app has to trust.

### 40. The navigation bar could carry a badge

The bar now holds the three workspaces permanently, which makes it the one
piece of chrome that is always on screen. That is a good place for a
count: how many tasks are open, or how far the daily goal is. The daily
goal bar is already in the workspace column and is the sort of number a
badge would duplicate — so this is a suggestion, not a defect, and it is
only worth doing if the workspace column ever stops showing the goal.

### 41. The mini window could remember which screen it is on

The position is now stored as a corner plus an offset, which is anchored to
a *screen* but does not name it. A user with two monitors who drags the
widget to the second one will find it back on the first after a restart,
because the anchor is resolved against whichever screen the window is on
when mini mode starts. Storing the screen's identity alongside the corner
would make the placement mean what the user meant by it.

### 42. The window could remember its size

The dashboard is restored to a fixed 1180 by 820 when mini mode ends, and
the window is centred. A user who has resized the window to fit a second
monitor loses that when they open the mini timer and close it again. The
backend already knows the size — it is one command to save and one to
restore.

### 43. The cue could follow the phase the way the notification does

**Now built.** The notification speaks in the phase's own words: *Focus
session complete* with an invitation to take a break, or *Break over* with
an invitation back to work. The wording lives in `src/lib/notify.ts` beside
the de-duplication, so the toast, the system notification and the cue
cannot drift apart.

### 44. The strip could offer the next task, not just name it

The strip under the clock names the task the queue will move to, but it
does not let the user *choose* it. When the queue moves on by itself, the
user might rather stay on the current task for one more session. A
control that defers the move — "one more" — would make the auto-advance
a suggestion rather than a decision, without turning the preference off.

### 45. The auto-advance could work on a *schedule* rather than an estimate

A task estimated at three sessions moves on when the third is banked,
which assumes the estimate was right. A user who keeps under-running
their estimate sees the queue stall on a task they have finished, and one
who over-runs sees it move on too early. The daily goal is a better
signal of "the day is done" than any single task's estimate.

### 48. The maximized state should survive a restart, not just a mini-mode trip

The window now opens maximized, and the maximized state is remembered
across the mini-mode transition — but it is not remembered across a
*restart*. A user who maximized the window once has to maximize it again
every morning, and the app does not know the difference between "I want
this maximized" and "it happened to be maximized".

The same shape as the always-on-top preference, and the same solution: a
persisted preference the user can see and change, rather than a host
state the app infers.

### 49. The shortcuts could be discoverable by pressing a key

The shortcut list is now in two places, which answers "what keys exist".
It does not answer "what does this key do", which is the question a user
has when they press it and nothing happens — most often because the
focus was in a text field, where the shortcuts are deliberately ignored.

Showing a brief hint of the pending action when a shortcut is pressed
but ignored would turn a dead key press into a signpost. It is a small
affordance and it needs a place to live that does not fight the countdown
for attention.

### 51. The ambience could be scoped to focus, breaks, or both

The ambience now follows the timer, which means it also plays through a
break. For a user who chose rain to work under, that is the wrong half of
the session: a break is when the room should come back. One setting —
*ambience: focus / breaks / both* — would say which phases it plays in,
and the engine already knows the phase at every moment.

### 52. The About dialog could open the folder it names

It now *says* where the data lives. The next step is to let the user
*reach* it: a button that asks the host to open that directory in the
operating system's file manager. It is one more method on the seam, and it
is the difference between a path the user reads and a path they can use.

### 53. The taskbar flash should stop when the window is looked at

The flash is a `request_user_attention` for the deadline, and on Windows it
keeps flashing until the window comes to the foreground. A user who
notices it and clicks the window has answered the request; the flash should
end there rather than asking until it is dismissed. It is a small piece of
state: flash on the alarm, cancel on focus.

### 50. The window could remember its size, and the maximized state with it

The dashboard is restored to a fixed 1180 by 820 when mini mode ends, and
the window is centred. A user who has resized the window to fit a second
monitor loses that when they open the mini timer and close it again. This
is suggestion 42, unchanged — but it is now cheaper to implement, because
the Rust side already has to remember the maximized state for the
mini-mode transition and is already in that code.

---

## Keep doing

- **Keep the domain layer pure.** Every hard bug so far has been a lifecycle
  or timing bug, and every one of them was cheap to find because the logic
  was testable without a DOM.
- **Keep the engine above the UI.** The tab-unmount bug and the permanent
  clock are the same lesson twice.
- **Run the real app.** The three native-tier bugs were all in the seam
  between a Rust object and a browser page, and none of them was visible
  from either side. Driving the installed app - finding a button by its
  accessible name, invoking it, and checking the window's state - is what
  found them. A test that only ever exercises one side of a seam has not
  tested the seam.
- **Attach to the real window, not to a browser.** The WebView2
  remote-debugging port lets Playwright drive the *actual* desktop window:
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`
  before `tauri dev`, and then `chromium.connectOverCDP`. The two scale
  bugs in the mini window were only visible that way - the window was
  156 pixels wide on a 1.5x display, and no unit test on either side of
  the seam could have said so.
- **A behaviour change on one side of a seam is a behaviour change on
  both.** Removing hide-to-tray was one request, and it touched a button,
  a bridge method, a Rust command, a managed state and a runtime exit
  handler. The parts that were left behind would have been a button that
  did nothing and a process that could not be closed.
- **A preference is the source of truth, and the host is told.** Two places
  writing the host's state is two places that can disagree about it. The
  always-on-top preference is written in two places — the header button
  and the settings switch — and read in one.
- **A panic in a command handler takes the app down.** `state()` panics
  when it is called before `manage()`, and a panic on the main thread is
  not recoverable. Anything that reaches for managed state has to use
  `try_state` when the ordering is not guaranteed.
- **Keep verifying in the browser.** The pointer-capture bug and the
  setPointerCapture throw were both invisible to jsdom and to the test suite.
  The `NaN min` in the session summary was invisible to every test too, and
  only the screenshot showed it.
- **Say where a thing belongs.** The clock column is the session and the
  workspace column is the work. Stating that in the two columns' own
  comments turns the next placement question into a one-line answer
  instead of a screenshot.
- **Keep the regression tests honest.** A test that passes against the bug
  it is meant to catch is worse than no test. The daylight-saving test was
  checked by reverting the fix and confirming that it failed.
- **Do not trust the desktop process to know the display's scale factor.**
  On Windows it is not per-monitor DPI-aware, so it reports one while the
  webview inside it is drawn at one and a half. The side that knows the
  true ratio is the webview, and `devicePixelRatio` is exact.
- **An event that nobody listens to is a feature that does not exist.**
  The native alarm was emitting `pomodoro://alarm` for the whole life of
  the app, and the hook that was written to receive it was never mounted.
  A seam that is written but not wired fails silently and forever; the
  only way to notice is to ask what the host sends and who is listening.
- **One policy, one place.** The auto-advance was implemented twice — once
  in the live timer and once, differently, in the catch-up — and the two
  paths drifted. The second implementation was not a bug in itself; it
  was a bug in having two.
- **Wait for the promise, and then schedule against the new clock.** The
  cue was scheduled on a context that had been *asked* to resume but had
  not, so the whole envelope was laid out in a window that had already
  passed. The lesson is general: an asynchronous state change means the
  clock you are reading is not the clock you will be scheduling on.
- **Prove the old code was wrong, not just that the new code is right.**
  The suspended-context fix was checked by running the old sequence in
  the same browser and watching the oscillators start with
  `state: 'suspended'`. A test that only asserts the new behaviour can
  pass for the wrong reason.
- **A switch must follow the permission, not the click.** The notification
  toggle stayed on after the browser had refused, which is a setting that
  promises a thing the app cannot do. The switch now follows the answer,
  and says so when the answer is no.
- **A command the host cannot call is a command that does not exist.**
  `storage_location` had a capability, a permission entry and a command
  body, and no line in the `invoke_handler` — so the About dialog would
  have answered "Unknown" for ever. Only Rust's dead-code warning noticed.
- **A file nobody imports is not a feature.** Two components from a first
  pass were written, tested by nothing, and wired to nothing. Delete them:
  dead code reads as finished work to the next person.
- **A sound has to be stoppable, not just startable.** The interface asked
  a session for a `release` and the builder never supplied one, so a fire's
  pending crack outlived the fire. Anything that schedules work for later
  has to hand back the means to cancel it.
- **An `Option` argument is not a volume knob.** `request_user_attention(None)`
  reads as "ask gently" and means "cancel". Name the request, and check the
  signature's meaning rather than the type it accepts.
- **A success that leaves no trace cannot be verified.** The notification
  logged when it was shown; the attention request logged only its failure,
  so "it flashed" was a claim about code rather than about the app. Log the
  success too, then check the log at a real deadline.
- **A footer at the end of a scroll container is a footer nobody sees.**
  "The end of the page" is a place the user has to travel to, and a
  dashboard is taller than a window. Chrome belongs outside the scroll
  area; only content belongs inside it.
- **Moving a thing into a tab makes it the tab's thing.** The working-on
  strip used to be permanent because it was outside the tab boundary; in
  the workspace it was visible only on the Tasks tab. That is the
  placement that was asked for, and it is worth saying out loud rather
  than letting the user discover it on the statistics tab.
- **If a status needs moving twice, it was probably a line.** The working-on
  card carried a title, a count, a progress bar and a next-task line, and
  every placement looked wrong because the thing was too big for its job.
  One line under the controls says the only part that was missed.
- **A bound named for one thing must not guard another.** The widget's
  maximum size was also clamping the dashboard's, so the dashboard came
  back at 640 by 640 instead of the 1180 by 820 it asked for — and the
  bug was invisible because the number in the code looked like a
  sensible limit. A constant's *name* is a claim about what it guards,
  and a second use of it is a second claim.
- **Global state needs an isolated test, not a shared one.** The
  maximized state is a `static Mutex`, and the first version of the test
  read and wrote it directly. Rust runs the tests in parallel, so two
  tests fought over the same flag and both failed. The rule now lives in
  a struct that each test owns, and the static holds only the one
  instance the application uses.
- **A transition is not an event.** The maximized state was captured on
  every request to enter mini mode, and a request is not a transition:
  the second one saw a widget, which reports itself as not maximized.
  Capturing on the *change* rather than on the *request* is the
  difference between remembering the state and overwriting it.
- **A deprecation warning is a claim about the future; read it.** The
  compiler offered `ignoreDeprecations` as the way to silence the
  `baseUrl` warning, and that flag suppresses the *message* rather than
  the problem — the option is *removed* in TypeScript 7.0, where it is
  a hard error. Installing the next version and reading what it actually
  says takes ten minutes and is the difference between a build that is
  quiet and a build that works.
- **A suppression flag is not a fix.** It buys silence. The question to
  ask is what the option was *for*, and whether the thing that needed it
  still needs it — here, `baseUrl` was only ever the base for `paths`,
  and `paths` has resolved relative to the tsconfig file since
  TypeScript 4.1.

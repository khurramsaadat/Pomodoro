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
| 27 | Completion sounds the user can choose | **Built** - five layered cues, with a preview |
| 28 | The completed tasks are visible | **Built** - a section of their own, not a tail of the queue |
| 29 | The recent sessions are easy to find | **Built** - the log comes before the statistics derived from it |
| 30 | Import and export | **Built** - a versioned file, validated on the way back in |

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

What is still missing on the web tier is a first-class answer rather than a
workaround: the browser cannot promise a notification, and the app should
not pretend otherwise.

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

Five cues is enough to choose between and few enough to remember. A user
who wants a sound of their own would need an upload path, which is a
different feature with a different risk: a file the app plays is a file the
app has to trust.

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

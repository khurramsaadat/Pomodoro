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
| 14 | The daily goal as a progress bar | **Built** - in the clock column |
| 15 | Installable and offline-capable | **Built** - a service worker and a richer manifest |
| 16 | Prune the unused dependencies | **Done** - four Radix packages dropped, two put to use |
| 17 | Expose the history in the UI | **Built** - the "Recent sessions" list |
| 18 | Show which task a session is spent on | **Built** - the active-task strip |
| 19 | The native tier - the Tauri desktop app | **Built** - the tray, the global shortcut, hide-to-tray |
| 20 | Notifications when the window is hidden | **Built** - the native alarm, scheduled against the deadline |
| 21 | An installable desktop app | **Built** - an NSIS installer and an MSI |

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

---

## Longer-term

### 29. A shift-shaped view of the day

The statistics answer "how much did I do" but not "when". A user who wants to
know whether their focus time lands in the morning or the evening has no way
to find out, even though the log has the timestamps. A day split into hours
would answer it.

### 30. A "what changed" note in the history

The log is append-only and correct, but a user reading it sees a flat list.
Marking the sessions that were interrupted, that ran long, or that happened
outside the usual hours would make the log tell a story rather than a
schedule.

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
  accessible name, invoking it, and checking that the window was hidden
  and the process was still alive - is what found them. A test that only
  ever exercises one side of a seam has not tested the seam.
- **A panic in a command handler takes the app down.** `state()` panics
  when it is called before `manage()`, and a panic on the main thread is
  not recoverable. Anything that reaches for managed state has to use
  `try_state` when the ordering is not guaranteed.
- **Keep verifying in the browser.** The pointer-capture bug and the
  setPointerCapture throw were both invisible to jsdom and to the test suite.
  The `NaN min` in the session summary was invisible to every test too, and
  only the screenshot showed it.
- **Keep the regression tests honest.** A test that passes against the bug
  it is meant to catch is worse than no test. The daylight-saving test was
  checked by reverting the fix and confirming that it failed.

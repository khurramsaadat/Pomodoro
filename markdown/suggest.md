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

The chime only plays if the tab is alive and unmuted. On the web tier that
is a browser limitation, and the Web Notifications API would need a
permission the app has no business asking for by default. On the native
tier it is a tray notification, and the app would then be usable for someone
who keeps it in the background - which is the whole point of a Pomodoro
timer.

### 25. Begin Phase 5 - the Tauri native tier

The `PlatformBridge` seam is designed for and not yet built. It is what makes
the desktop tier real: a system tray, a global shortcut, a window that hides
to the tray, and a native notification at phase completion.

### 26. Let the timer be paused by the operating system

When the laptop sleeps, the deadline passes in real time and the session is
recorded as complete. A user who closed the lid for two minutes loses a focus
session to a sleep that was never a choice. The native tier can observe the
suspend and resume events and tell the engine to bank the time as paused.

---

## Longer-term

### 27. A shift-shaped view of the day

The statistics answer "how much did I do" but not "when". A user who wants to
know whether their focus time lands in the morning or the evening has no way
to find out, even though the log has the timestamps. A day split into hours
would answer it.

### 28. A "what changed" note in the history

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
- **Keep verifying in the browser.** The pointer-capture bug and the
  setPointerCapture throw were both invisible to jsdom and to the test suite.
  The `NaN min` in the session summary was invisible to every test too, and
  only the screenshot showed it.
- **Keep the regression tests honest.** A test that passes against the bug
  it is meant to catch is worse than no test. The daylight-saving test was
  checked by reverting the fix and confirming that it failed.

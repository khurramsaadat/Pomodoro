# Input — prompts as received

> The requests that started each piece of work, in the order they were made.
> Companions: [`prd.md`](./prd.md), [`plan.md`](./plan.md), [`suggest.md`](./suggest.md).

---

## 1. Core Pomodoro timer

> "Build a production-grade Pomodoro timer that runs natively as a Tauri v2
> desktop app and as a standalone static web app from the same source tree."

Delivered in `5a9727d`.

---

## 2. Task queue, history, and statistics

> "Add the second half of the app: a task queue, an append-only session
> history, and the statistics derived from it. Keep behaviour that is not part
> of the timer configuration — the daily goal, whether completed tasks stay
> visible — separate from the session lengths."

Delivered in `3670f69`.

---

## 3. Mini timer

> "Build a persistent, draggable mini Pomodoro timer that stays in a viewport
> corner and shares the always-running main timer."

Delivered in `3c0f7e6`.

---

## 4. Dashboard layout and footer

> "the UI for desktop should be like a dashborad where clock should be on the
> left permanently and rest of the elements ion the right.
> one liner footer should add copyright 2006 made by Khurram"

Delivered in the current commit.

---

## 5. Project records

> "always update `input.md`, `plan.md`, `prd.md`, `suggest.md`"

And, in the same request:

> "`input.md` should only show my input/prompts nothing else.
> Plan.md should show the stagewise implementations.
> PRD.md should show the overall view and requirements for this app.
> Suggest.md should show your suggestions to improve this website after you
> complete a task. It should always suggest overall improvements in this site."

---

## 6. Committing

> "please commit the changes after you complete a task."

Every completed task is committed.

---

## 7. Reviewing the suggestions

> "choose your suggestions from suggest.md that are worth implementing in this
> app. provide fresh suggestions for improvements as well"

The suggestions were checked against the source before being kept or dropped.
Four defects were found that the record did not mention, and two suggestions
that had already been implemented were replaced with fresh ones.

---

## 8. Fixing the defects, then improving the app

> "implement the four correctness fixes. then improve the overall app"

The four defects were fixed first, in their own commit, and the improvements
were built on top in a second.

**The decision:** the fixes and the improvements were kept apart, because a
correctness fix and a new feature are different kinds of change and the
review of the first should not have to carry the second. The fixes are
`1a1cbe0`; the improvements are `f3ce6f9`.

**What the fixes turned out to need.** The streak was not the only place a
fixed 86 400 000 ms step was used - the chart's window was built the same
way, and had the same bug. And the measured focus time needed a migration: a
snapshot written by the earlier build has no `completedFocusMs` field, and
without a repair the summary rendered `NaN min` for every existing user. The
screenshot is what showed that one; no test would have.

---

## 9. Building the native tier

> "proceed to Phase 5 - the Tauri native tier"

The Tauri v2 desktop app was built from the same source tree, with the web
build left working exactly as it was.

**The decision:** the two tiers meet at one seam, `src/platform`, and the
`@tauri-apps/api` runtime is imported *dynamically* and only there. The
build proves the web tier is untouched: the Tauri code lands in its own
chunk and the web page never asks for it.

**What the native tier added.** A system tray that shows the live timer, a
window that hides to the tray rather than quitting, a global shortcut that
starts and pauses the timer from any application, and a notification that
fires *on time* when a phase ends while the window is hidden.

**The alarm is the interesting part.** It is scheduled against the timer's
own deadline - the same `endsAt` the countdown is drawn from - and it runs
on its own thread, so the notification does not depend on the webview being
painted. That is the thing the web tier simply cannot do: a browser gives a
backgrounded tab no timer it can trust.

**Three bugs that only a real run found.** The tray update panicked the app
because the icon is created in the setup hook and a lookup by managed state
finds nothing. The alarm was never sent, because the native bridge loads
asynchronously and the request was dropped. The service worker cached the
native app's shell, which would have kept serving old code after an
upgrade. None of them were visible in the tests, and the tests could not
have found them: the bug was in the relationship between a Rust object and
a browser page, not in any one of them.

---

## 10. The dashboard's empty space, and a mini timer that replaces it

> "check with playright as the dashboard has too much empty space under sessions
> settings
> when mini is open the large desktop should hide - do it properly. rearrange the
> ui for better ux. keep clock on left"

The dashboard was measured rather than eyeballed: the clock column stood 1081
pixels tall while the workspace beside it was 420, leaving roughly 660 pixels
of dead space under "Session settings". Opening the mini timer made it worse
rather than better, because the widget was drawn *over* a dashboard that was
still there — two timers, one of them enormous and irrelevant.

**The decision:** the mini timer now *replaces* the dashboard instead of
covering it, and the empty space is filled with something worth reading — the
plan of the session ahead, which is true on every tab rather than only on one.

**The native tier needed real work.** The desktop app's own window becomes the
mini timer — frameless, always on top, and the size of the widget — so the
dashboard is genuinely gone rather than hidden behind it. That is a window the
operating system moves, which is why the placement is the host's business and
not the page's.

**Two bugs that only a real native run found.** The window was sized in
physical pixels *and* multiplied by the display's scale factor, so a
240-pixel timer arrived on screen as 156. And the backend's idea of the
display's scale factor was one, while the webview inside it was drawn at one
and a half: on Windows the desktop process is not per-monitor DPI-aware. The
measurements are now in physical pixels throughout, and the conversion is done
on the side that knows the real ratio.

---

## 11. Moving "working on" and the daily goal

> "working on to be above the sessions settings
> Daily goal to be under working on"

The two cards that answer *what am I working on* and *how far have I got
today* now sit above the tabs, with the daily goal directly under the task.
The clock column keeps the timer and the session summary, and "Up next" stays
below the tabs where the empty space was.

---

## 12. Always on top, no hiding, better sounds, and backups

> "add always on top option and remove hide to tray. improve the sound
> options so the user can select different completion sounds. show completed
> tasks clearly and make the recent sessions easy to find. add a validated
> import and export"

Five changes, and they turned out to share one theme: the app was good at
*recording* what the user did and bad at *showing* it.

**The always-on-top preference and the end of hide-to-tray.** The tray stays
— it is the app's status and its quick controls — but closing the window now
ends the app, as it does in any other program. A program that survives its
own close button is a program the user cannot get rid of. The window can be
pinned above the others instead, which is the thing that actually helps: a
timer the user has to go looking for is a timer whose deadline they will
miss.

**The sounds.** The cue used to be two sine notes. It is now a *stack* —
a body tone, a fifth above it, and a soft noise transient — in five
distinct shapes, and the user can choose between them and hear each one
before choosing it. A sound the user has never heard is a sound they cannot
choose between.

**The completed tasks and the recent sessions.** Both were *there* and both
were invisible: the finished tasks were the tail of a sorted list, and the
session log was below the statistics card. The finished work is now a
section of its own, and the log comes first in its tab — the log is what
the statistics are derived from, so the thing the statistics come from
should be the thing that is read first.

**The backups.** The whole workspace in one file, validated on the way back
in. A backup that cannot be restored is not a backup, and a backup that is
restored *partly* without saying so is worse than one that is refused.

---

## 13. The footer, a movable mini window, and a bottom navigation bar

> "replace footer "© 2006 Khurram · Focus deliberately. Break fully. · Tauri v2"
> with © 2006 Pomodoro by Khurram"

> "mini app: user can not move it on the screen. let user move it's location
> on the screen."

> "move this bar at the bottom of the window - fixed like navbar - session
> tasks stats settings"

Three changes, and the middle one turned out to be a defect rather than a
feature.

**The footer.** One line, one sentence, and no link: `© 2006 Pomodoro by
Khurram`.

**The mini window could not be moved.** It had a `data-tauri-drag-region`
attribute and looked draggable, but it was not — and there were *two*
reasons, either of which alone would have been enough.

The first was the capability file. Tauri's drag script ends in a call to
the `start_dragging` plugin command, and that command is not part of
`core:window:default`, so the ACL refused it. The attribute was a promise
the app was not allowed to keep.

The second was the attribute itself. Tauri's script walks the click's
composed path and stops at the first *clickable* element that is not itself
a drag region — and every control in the bar is a button. A bare attribute
only ever matches a click on the element that carries it, so the only
thing that could have dragged the window was the bare space between the
buttons.

The bar is now a `deep` region, so the whole of it drags, and the two
control buttons opt out with `data-tauri-drag-region="false"` so that a
click on them still runs them.

**A second monitor.** The window was placed using an anchor measured from
the *monitor's* top left, but the operating system's `set_position` wants
a position in the *virtual desktop*. On one screen the two are the same
number, which is why the bug was invisible until there were two.

**The navigation bar.** The four workspaces move to a bar pinned to the
bottom of the window, the way a phone's navigation bar is. The bar is
*outside* the scrolling area, so the content scrolls under it rather than
pushing it away.

That needed the tab root to move: the bar is a tab list, so it has to be
inside the tab root to know which tab is selected, and the tab content has
to stay in the workspace column. Radix does not require the two to be
siblings in the DOM — the context is what connects them — so the root now
sits above the shell and takes no part in the layout.

---

## 14. The cog, the working-on strip, the queue first, and the sound

> "settings icon should be a COG not to line bars as you show."

> "show current that i am working on below the clock so i know what I am
> working on. improvise this feature please."

> "keep auto-advance the task ON by default."

> "move tab for Tasks before Sessions"

> "make sure sound is working"

Five requests. Three of them were small; two of them were defects.

**The settings icon.** `Settings2` in Lucide is the *sliders* icon — a
row of lines with knobs on them. The cog is `Settings`. The icon in the
navigation bar and the one in the preferences header were both the
sliders, and both are now the cog.

**The working-on strip.** "Show me what I am working on below the clock"
was clear about the *place* and left open the *form*. The answer is a
strip: a line under the countdown with the task's title, how far through
it is, and what is coming next. It is a button, because the answer is
also a doorway — clicking it opens the queue, which is where the answer
is changed.

The strip is *improvised* in one specific way: it says what happens next.
The queue moves on by itself once a task has used up its estimate, and
until now that happened silently — the title under the clock changed
without explanation. Naming the next task turns a surprising change into
a plan.

**The auto-advance.** The preference already defaulted to on. The real
problem was that two paths disagreed about what it meant: the live timer
credited a session and then advanced the queue, while the catch-up on
startup credited every session that had elapsed while the app was closed
and never advanced — and credited them all to the *same* task even when
the first one had used up its estimate. Both now go through one pure
function, so a session that is banked is always a session that is given
the chance to move the queue on.

**The queue first.** The navigation bar offers Tasks, Session, Stats and
Settings, and the app opens on Tasks. The queue is the question the user
asks most often, and the answer it gives decides what the session is for.

**The sound.** Two real defects, and one of them is why the cue was
unreliable exactly when it was most needed.

The first: a cue scheduled on a *suspended* context had its whole gain
envelope laid out in the past. `resume()` is asynchronous, and the old
code called it and carried straight on — so the oscillators were
scheduled against a frozen clock, and the cue was heard as a click, or
not at all, when the context finally woke up. The context is now resumed
*first*, and the cue is scheduled against the new clock, a little in the
future so the envelope has room to live in.

The second: the desktop tier's alarm was emitting an event that nothing
listened to. The native alarm is the reason the desktop tier can notify
a user whose window is in the background, but the cue was played only by
the page's own tick — so a webview that had been throttled hard enough
to miss the deadline stayed silent. The alarm now plays the cue too, and
the two are de-duplicated by the *deadline*, which is the one thing they
agree on.





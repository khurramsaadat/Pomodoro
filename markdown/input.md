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


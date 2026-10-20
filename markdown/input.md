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

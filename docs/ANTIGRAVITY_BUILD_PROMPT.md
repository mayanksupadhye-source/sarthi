# MASTER BUILD PROMPT FOR ANTIGRAVITY — SHLOKI

You are working as the senior product engineer, system architect, UI designer, backend engineer, database designer, QA engineer, and deployment engineer for **Shloki**.

This is not a generic to-do app. It is a private personal execution system whose defining feature is an adaptive planner that prevents one disrupted day from collapsing an entire multi-month plan.

## 0. Start here — repository and context

Repository: **https://github.com/mayanksupadhye-source/shlokiii**  
Display name: **Shloki** (spelled S-H-L-O-K-I). The GitHub repository slug is `shlokiii`.

1. Open the repository already available in VS Code. Inspect all files, Git status, current branch, remotes, and the existing README before editing.
2. Read `README.md` and every file under `docs/`, especially:
   - `docs/COURSE_CURRICULA.md`
   - `docs/DEFAULT_TIMETABLE.md`
   - `docs/source/WEB_DEVELOPMENT_COURSE_SOURCE.md`
   - `docs/source/DSA_COURSE_SOURCE.md`
   - `docs/source/ORATORY_PROGRAM_SOURCE.md`
   - This master prompt
3. Treat these repository documents as the source of truth for product context. Do not assume that files attached in another ChatGPT conversation are visible to you. If the original course documents are present in the workspace, inspect them too and preserve their exact lesson titles/durations.
4. The repository currently appears to be an almost-empty public repository with a placeholder README. Build on its existing Git history; do not force-push or destroy unknown work.
5. Before coding, return a concise implementation plan and identify any conflicts in the current repository. Then proceed with implementation without asking routine questions. Use editable defaults wherever a decision can safely be deferred to Settings.

## 1. Product context — why this app is being built

The owner is a 19-year-old IT engineering student, currently working toward a strong academic recovery, technical skill development, better fitness, and a more consistent daily routine. The owner has a long-term career goal of competing for approximately ₹12 LPA or higher fresher roles by graduation in 2029, but **Shloki itself is a personal execution tool, not a job-placement guarantee**.

The owner's demonstrated strengths include communication, pitching, team leadership, persistence after setbacks, empathy, and entrepreneurial curiosity. The main execution weakness is a specific all-or-nothing planning loop:

- A large 10-day/30-day/90-day plan is displayed.
- The overall workload becomes mentally congested and intimidating.
- The owner may fail to start even a small task because the full plan feels too large.
- An unavoidable disruption causes one or more missed days.
- The owner calculates all the backlog and believes the plan is now broken.
- They postpone restarting until Monday or next month.
- A few missed days become weeks of inactivity.

The owner can focus for two or three hours when the immediate task is clear. The app must therefore show a small, clear daily commitment and keep the long-range roadmap in the background.

**The product's central design rule: A missed day must never automatically invalidate the next day.**

Do not use shame, guilt, threatening language, family pressure, or the owner's difficult childhood as gamification. Use short, grounded, context-aware guidance. The app should support ambitious execution without treating a single missed day as a personal failure.

## 2. Challenge dates and defaults

Initial challenge window:

- Start: **16 November 2026** (owner's selected kickoff date)
- Last planned day: **25 April 2027**
- Milestone: **26 April 2027** (owner's 20th birthday)
- Timezone: `Asia/Kolkata`

The user may configure and use Shloki before the challenge starts. Store all dates in a configurable settings record. Do not hard-code dates into business logic.

Initial fitness and reward values:

- Starting weight: 88 kg
- User-stated target: 73 kg
- Weight check-ins: every 14 days by default
- No-sugar challenge: enabled, with editable rules
- Calorie counter: do not build one
- Final trekking/mountain-trip savings goal: ₹4,000, editable
- Reward interests: Marvel movies, feel-good series, occasional planned treat, time with friends, mountain/trekking trip

Weight target is a user-entered goal, not a medical recommendation. Do not prescribe crash dieting or daily weigh-ins. Do not add calorie tracking.

## 3. Non-negotiable technology choices

- **No TypeScript anywhere.** Do not add `.ts`, `.tsx`, TypeScript config, or a TypeScript build step.
- Front end: vanilla HTML, CSS, and modern JavaScript (ES modules).
- Use multiple separate `.html` pages for the major modules. Shared styles and reusable JavaScript are fine. Do not build one giant HTML page.
- Back end: Node.js + Express using plain JavaScript.
- Database: MongoDB Atlas using Mongoose.
- PWA: manifest + service worker.
- Do not use React, Next.js, Vue, Angular, or a front-end framework for this product.
- No photo gallery, image upload, or general file upload module in the initial application. Text notes and external links are enough.
- Do not store passwords, OAuth tokens, API keys, or journal content in localStorage. Use authenticated APIs and secure server-side storage.

If the current repo has no structure, create a clear client/server/docs structure. Keep routes, controllers, business logic, database models, scheduled jobs, and integrations separate.

## 4. Product experience and visual direction

Create a highly distinctive, premium, motivating personal command centre. It should feel custom-designed for one person, not like a purchased admin template or an AI-generated dashboard.

Desired design characteristics:

- Editorial typography, strong hierarchy, bold numeric data, confident spacing, purposeful asymmetry, refined charts, thoughtful transitions, and excellent responsive layouts.
- Deep ink/navy, warm off-white, charcoal/graphite, and one strong signal accent such as amber/orange or electric lime. A restrained secondary accent is acceptable.
- A unique identity for each module while retaining a shared design system.
- Desktop is the primary planning environment; mobile must be excellent for quick task check-ins, journal entries, and focus timers.
- Create real empty, loading, error, success, and offline states.
- Make the Today page visually calm even when the overall system contains many modules.

Avoid:

- Generic AI-looking admin dashboard layouts.
- **No linear gradients.** Avoid gradient backgrounds and gradient text.
- Excessive glassmorphism, blur, neon, tiny text, and rounded-card repetition.
- Fake charts, fake stats, fake calendar sync, or fake notification success.
- Excessive quotes. At most one context-aware line should be visible at a time.
- Red shame screens or copy like “You failed again.”

Example microcopy tone:

- “Today's work is the only work you need to solve right now.”
- “Protect the next focus block.”
- “A disrupted schedule needs a re-plan, not a complete restart.”
- “Finish the important task before adding another one.”

Do not use the owner's personal trauma or relationship details as random quotes or pressure mechanics.

## 5. Navigation and pages

Build a real multi-page application with a persistent navigation system. Suggested pages:

- `index.html` — branded welcome / sign-in entry
- `login.html` — email/password authentication
- `dashboard.html` — overview
- `today.html` — today's task queue and next action
- `planner.html` — long-range plan, weekly overview, re-planning
- `calendar.html` — month/week/day views and date-linked activity
- `timetable.html` — weekday/weekend/holiday/exam templates and editor
- `courses.html` — course overview and progress
- `web-development.html` — complete web/full-stack course tracker
- `dsa.html` — C++ DSA playlist tracker
- `oratory.html` — 13-week practice lab
- `fitness.html` — gym, weight entries, no-sugar challenge
- `journal.html` — daily long-text journal
- `reset-room.html` — difficult-day reflection and next-step guide
- `history.html` — history notes
- `reading.html` — SPIN Selling and Influence tracker
- `share-market.html` — share-market learning and research notes
- `exploration.html` — Section X / Excel / PowerPoint / future skills
- `hackathons.html` — hackathon command centre
- `academics.html` — college overview
- `attendance.html` — subject-wise and practical attendance
- `assignments.html` — college assignments
- `exams.html` — class tests, end-semester plans, exam mode
- `rewards.html` — reward catalogue, unlocked rewards, savings
- `analytics.html` — useful progress and consistency analytics
- `settings.html` — profile, date range, goals, timetable, integrations, notification preferences

You may combine very small pages into a tabbed view only if the experience stays clear. Do not collapse all features into a single long dashboard.

## 6. Dashboard: make today the centre

The initial post-login landing page should be Today or Dashboard with a prominent **Next Action** component.

Show:

- Current date/time in IST
- One short context-aware message
- Next task, task duration, module, priority, and Start button
- Today's timetable and tasks in chronological order
- Separate progress for P1 essentials and optional work
- Focus timer status
- Slack days/buffer remaining this month
- Academic/attendance warning if relevant
- Next hackathon milestone if one is active
- Calendar and notification connection health
- Daily show-up check-in

Keep the five-month roadmap hidden behind the Planner page. Do not make the home page a wall of 100 tasks.

## 7. Timetable editor and seeded schedule

Create editable templates for:

- Monday–Friday
- Saturday
- Sunday
- College holidays
- Exam mode
- One-off/custom day

Seed the templates from `docs/DEFAULT_TIMETABLE.md` exactly. The handwritten schedule should be editable block by block. Include copy-day, recurring rules, exceptions, conflict detection, drag/drop where practical, and a simple form-based editor as a reliable fallback.

Key weekday blocks:

- 05:00–05:30 getting ready
- 05:30–07:30 Study Session I
- 07:30–16:30 college/commute/college work
- 16:30–17:00 remaining assignments and night-study preparation
- 17:00–18:30 gym
- 18:30–20:00 Study Session II
- 20:00–20:30 dinner
- 20:30–22:30 Study Session III
- 22:30–23:40 night routine

Saturday:

- 05:00–05:30 getting ready
- 05:30–07:30 Study Session I
- 07:30–16:30 unclear daytime commitment — use an editable placeholder, do not invent what it means
- 17:00–19:30 web development
- 19:30–20:30 dinner
- 20:30–22:30 history lecture/study
- 22:30–23:40 night routine

Sunday:

- 07:00–08:30 getting ready
- 08:30–11:30 web development
- 11:30–12:30 brunch
- 12:30–14:30 Excel/PowerPoint/exploration
- 14:30–17:00 oratory improvement
- Evening: hostel organisation, personal reset, chill, and a movie when earned/feasible

Night routine options: no phone, five English words, brush teeth/skincare, 15-minute meditation, ~35-minute business reading, 10-minute journaling. Each item must be independently configurable.

**Important sleep warning:** this weekday timetable implies only 5h20 between the end of the night routine at 23:40 and the 05:00 wake-up. Flag it before enabling the recurring template. Let the user set a protected sleep window and adjust schedule. Do not schedule learning tasks into sleep time or treat this as a validated healthy routine.

**Sunday conflict:** `docs/COURSE_CURRICULA.md` says the oratory lab itself is a two-hour Sunday session at 12:30–14:30. The handwritten timetable uses that same period for Excel/PowerPoint and assigns oratory to 14:30–17:00. During onboarding, show the conflict and ask the user to choose the slot. Never double-book the two activities. Preserve the oratory lab's internal two-hour format whichever slot the user selects.

## 8. The adaptive planner / Slack Days engine — highest priority

This is the most important feature. Do not implement it as a simple “move task to tomorrow” button.

### Task representation

Each task must include:

- title, description, module, source
- date, optional time block, estimate (minutes)
- priority P1/P2/P3
- deadline, dependencies, recurrence
- status: planned / in progress / partial / complete / deferred / intentionally skipped / cancelled
- completion percentage and completed minutes
- optional notes and completion evidence as text

### Capacity rules

- Calculate usable task capacity from the selected schedule after college, meals, exercise, sleep, and fixed commitments.
- Daily maximum study/work time must be configurable.
- Keep a configurable amount of free capacity; initial suggestion is up to **three flexible buffer/slack days per calendar month**.
- Slack days are not automatically consumed. A user marks a day disrupted or accepts the system's suggestion.
- Keep optional activities such as business reading eligible for reduction or removal on a heavily loaded day.

### Exact re-planning behaviour

When a day is disrupted:

1. Ask what was done, what was partly done, and what could not happen.
2. Preserve completed minutes. If a 60-minute task is 50% complete, only the remaining ~30 minutes are carried into the candidate plan.
3. Do not move every task and every date forward by one day.
4. Rank outstanding work using priority, deadline, dependency, exam schedule, available hours, and the module's target date.
5. Keep P1 tasks protected where possible.
6. Shorten, defer, or remove P3 tasks first. A task intentionally removed from today's schedule must be labelled “not scheduled” or “deferred,” not shown as a failed task.
7. Apply gradual catch-up only within a user-configured limit. A small example is +10 minutes per day, not the entire missed hour added to tomorrow. Make this value editable.
8. If capacity is insufficient, offer explicit choices: reduce scope, move a target date, lower priority, or accept a longer course timeline.
9. Never silently delete an essential task, change a hard deadline, or increase tomorrow beyond its cap.
10. Keep an unscheduled backlog with a cap and show the user when the plan needs re-scoping.
11. Re-plan a short horizon (today and the next few days) rather than recalculating the entire five-month plan every time.
12. Require user confirmation for material changes. Show added, moved, reduced, deferred, and removed tasks with reasons.

Create a **Replan My Day** workflow with a before/after comparison and Confirm / Edit / Reject actions.

### Slack allowance

- Track available, used, and remaining slack days for each calendar month.
- Make the reset rule configurable (calendar month initially).
- Keep an audit history of when slack was used and why.
- When allowance is exhausted, still support adaptive recovery by reducing optional tasks and smoothing small amounts of work within capacity. Do not pretend that the system cannot recover without a slack day.

### Streak design

Track separately:

- Show-up check-ins
- P1 completion rate
- Overall planned-effort completion
- Recovery wins after a disruption

A show-up is a genuine daily check-in plus a meaningful action or approved rest/recovery record. Do not let optional task omissions count as failed days. Preserve historical streak records and explain them without shame.

## 9. Course and learning tracker

Load the initial catalog structure from `docs/COURSE_CURRICULA.md`, then use the complete extracted lesson records in `docs/source/WEB_DEVELOPMENT_COURSE_SOURCE.md` and `docs/source/DSA_COURSE_SOURCE.md`. Use `docs/source/ORATORY_PROGRAM_SOURCE.md` for the full 13-week program instructions. Preserve exact source lesson titles, durations, and ordering when creating seed data.

### Web Development

Track the Chai aur Code / Hitesh Choudhary full-stack curriculum through its 36 sections and lecture numbering up to 331. The curriculum includes HTML, CSS, Tailwind, JavaScript, JS OOP, DOM/BOM, advanced JS, JS projects, Git/GitHub, Node, databases, MongoDB/Express, backend authentication, aggregation, React, Next.js, Appwrite, deployment, SQL/PostgreSQL, event-driven architecture, Fastify, secure LMS/payment integration, Docker, and the AI-enabled code editor project.

### DSA

Track the Apna College/Shradha Khapra C++ DSA playlist with 136 source entries. Preserve source lecture titles/durations. Topics cover arrays, complexity, binary search, sorting, strings, math, 2D arrays, hashing, recursion/backtracking, OOP, linked lists, stacks/queues, trees/BST, graphs and graph algorithms.

### Lesson effort estimate

Store video duration independently from real work estimate. For coding-heavy lessons, default to 1.6× video length, configurable in the 1.5×–1.75× range. Break out watching, coding, problem solving, and revision. Ask for user confirmation before creating an entire month of tasks if the calculated capacity is insufficient.

### Course behaviour

- Mark watched, coded independently, practiced, revised, and mastered separately.
- Provide a weekly challenge for web development and DSA.
- Track problem attempts and independent solutions.
- Store lesson-specific notes and links.
- Provide progress by section, subject, and skill.
- Do not mark a lesson complete merely because its video was watched.
- Do not invent missing lesson titles or silently assume that a source video is required.

## 10. Oratory module

Use the 13 topics and skills exactly from `docs/COURSE_CURRICULA.md`. The workflow for each week:

- Learn one skill
- Write speech in Hook → Introduction → 3 Main Points → Story/Example → Conclusion structure
- Record raw attempt
- Score Structure, Confidence, Gestures, Voice, Persuasion out of 10
- Identify exactly one biggest weakness
- Drill only that weakness
- Record corrected attempt
- Compare both attempts and write the learning

Track recording links only as optional external URLs; no video upload feature is needed. Preserve the original 13-week rule: if a week is missed, resume at the next week rather than restarting the whole program.

## 11. Hackathon command centre

A hackathon should never remain as a vague thought in the owner's head. Capture and schedule all deliverables.

For each event, support:

- Name, organiser, dates, venue/mode, registration deadline, event link, problem statement
- Team name, member names, roles, contact text
- Stages: PPT round, demo/video round, final offline round; allow custom stages
- Each stage's exact deadline, time, requirements, checklist and reminder
- Tasks assigned to team members by name, owner, estimate, priority, dependencies, status
- Repo/demo/deck/video links
- Pitch practice and submission checklist
- Result: selected, eliminated, won, runner-up, etc.
- Post-event retrospective and a LinkedIn post draft prompt

No teammate login system is required in the first version. A named assignment is enough. Add an editable weekly hackathon time budget and show when hackathon work displaces academic or core learning blocks. A hackathon cannot silently hijack a DSA/web-development block.

When the event is complete or the team is eliminated, prompt the owner to capture lessons and optionally draft a LinkedIn post.

## 12. Academics, attendance, assignments and exams

Academic protection is non-negotiable.

### Attendance tracker

- User enters academic term, subjects, practical subjects, weekly timetable, and actual college attendance rules.
- Every class and practical can be marked attended, absent, cancelled, not held, or needs correction.
- Calculate overall, subject-wise, and practical-wise attendance separately.
- Store date-wise history and allow corrections with a simple audit trail.
- Let the owner set the institution's required percentage and a personal buffer target. Do not assume a universal minimum.
- Show an early warning if the user is nearing a risk threshold.
- Provide attendance projections: how many future classes must be attended to reach a chosen target.

### Assignments and exams

- Assignments: subject, description, effort estimate, due date, priority, and status.
- Class tests: date, syllabus, preparation checklist, optional marks/result.
- End-semester exams: subject, exam date, syllabus/topics, revision tasks, and practice papers.
- Exam Mode must reduce or pause lower-priority non-academic tracks while protecting attendance and preparation. It must not erase progress or create a massive backlog when it ends.
- On exiting Exam Mode, re-enter non-academic tracks gradually.

## 13. Fitness, no-sugar, and weight

- Editable gym/workout plan.
- Workout log with date, exercise, sets, reps, load, duration, and notes.
- Weight entry every 14 days by default; line chart and progress summary.
- Default user values: 88 kg baseline and 73 kg target. Both editable and visibly labelled as self-entered goals.
- No calorie counter, no calorie database, no automated restrictive diet advice.
- No-sugar challenge with configurable daily check-in, exceptions, weekly/monthly summaries, and neutral language.
- Include the night routine as configurable habits: no phone, five English words, brushing/skincare, meditation, business reading, journaling.

## 14. Journal, History, Reading, Share Market, Section X

- Daily long-text journal entries by date.
- History notebook by topic/date/tags.
- Web and DSA notes, oratory speech drafts, hackathon retrospective, and general notes.
- Reading tracker for **SPIN Selling** and **Influence**, including page/chapter progress and practical takeaways.
- Share-market learning tracker for concepts, terminology, educational research notes, and simulated/paper exercises. This is an educational journal only: do not provide personalised buy/sell calls, brokerage connectivity, or trade execution.
- Section X / Exploration Lab, initially used for Excel, PowerPoint, and future topics; fully renameable and editable.
- Each note must save independently to MongoDB with title, body, tags, owner, createdAt, updatedAt.
- Autosave with debounce and visible saved/error state.
- Search notes by date, title, content, and tags.
- Use a calendar view to open all relevant data for a date.
- Do not put every journal note inside the User document. Do not add photo/file uploads.

## 15. Reset Room / mental well-being

Create a private reflection flow for stressful days. It should ask:

1. What happened?
2. What was the immediate trigger?
3. What are the confirmed facts versus the predictions/fears?
4. What is within my control?
5. What is the smallest useful next step?
6. Would rest or speaking to a trusted person help?

Provide non-clinical grounding and planning suggestions. Do not diagnose, promise treatment, or replace professional help. Do not use childhood trauma, family loss, or relationships as manipulative motivation. If user-entered text suggests immediate self-harm danger, show compassionate guidance to contact a trusted person and local emergency/crisis support; the app is not an emergency service.

## 16. Rewards and savings

Build an editable reward catalogue and transparent unlock criteria.

Initial reward ideas:

- Movie night on Sunday night after a successful 2–3 week cycle.
- Marvel movie / feel-good series session.
- Planned small treat after a monthly habit milestone.
- Larger reward after a meaningful milestone.
- Final mountain/trekking trip, solo or with friends, after the challenge.

The owner must configure what counts as a successful week/cycle. Do not make one missed day automatically cancel a reward. Show exactly which agreed criteria were met or not met.

Savings tracker:

- Initial goal ₹4,000.
- Monthly contribution plan editable.
- Manual deposits, dates, running balance, remaining amount, and simple progress chart.
- No bank account linking or payments.

## 17. Notifications and Google Calendar — critical integrations

### Local authentication

Implement basic email/password authentication for the private owner account. Hash passwords securely. Use a secure server-side session or HTTP-only secure cookies. No public open registration after the first owner account unless the owner explicitly enables it.

### Google Calendar

Google Calendar is a separate OAuth authorization; do not infer Calendar access from the app's email login.

- OAuth flow with least-privilege Calendar scopes.
- Store secrets and refresh tokens only on the backend; encrypt sensitive tokens at rest.
- Allow the owner to choose a calendar.
- Sync timetable blocks, selected tasks, exams, hackathon milestones, and focus sessions.
- Store Google event IDs and make sync idempotent (repeated sync must update, not duplicate).
- Allow update, delete, disconnect, and manual sync.
- Configure reminders on Calendar events.
- Show last sync, sync errors, reconnection status, and exact events that failed.

### Browser/PWA push

- Request notification permission only after explaining why.
- Create PWA manifest and service worker.
- Register push subscriptions and store them in MongoDB.
- Use Web Push/VAPID for server-sent notifications.
- Add a backend scheduler/worker that checks due reminders using IST-aware time logic.
- Persist reminders in the database, not just in browser memory.
- Include notification diagnostics and a test-notification button.
- Do not claim closed-tab push works until the subscription, server job, and production host have been tested.

**Important hosting reality:** a sleeping/free web service may not execute scheduled jobs on time. Google Calendar notifications should be offered as a separate reminder path. Document that production-grade server push may require an always-on instance or a dependable external scheduler. Report this openly rather than faking reliability.

### Focus timer

- Timer linked to a task or manual session.
- Start, pause, resume, stop, complete.
- Store `startedAt`, `endsAt`, `pausedSeconds`, status, and actual duration.
- Derive remaining time from timestamps; timer must survive refresh and browser close/reopen.
- When timer begins, optionally create a matching Google Calendar event if Calendar is connected and user enables it.
- On completion, update task minutes, save the FocusSession, and send in-app/browser/push notification where configured.

## 18. MongoDB design and long-text storage

Use MongoDB Atlas and Mongoose. Design independent collections for high-volume records and long text. Suggested collections include:

- User
- ScheduleTemplate, ScheduleBlock
- Course, CourseSection, CourseLesson
- Task, DailyPlan, SlackAllowance, ReplanProposal, CheckIn
- FocusSession
- JournalEntry, Note
- OratorySession
- WorkoutLog, WeightEntry, HabitCheckIn
- Book, ReadingSession, MarketLearningEntry
- Hackathon, HackathonStage, HackathonTask, HackathonMember
- AcademicTerm, Subject, ClassSession, AttendanceRecord, Assignment, Test, Exam
- Reward, RewardUnlock, SavingsEntry
- CalendarConnection, CalendarEventLink
- PushSubscription, Notification

Add references, validation, timestamps, and indexes. Long notes must be stored as separate documents. A reasonable text length should be supported without embedding notes in a growing array. Never save personal journal or private records in Git.

## 19. Recommendation engine

For the initial version, implement transparent deterministic rules, not an unconfigured AI API. Suggestions should be based on actual records, for example:

- Repeated overloaded days → lower next week's capacity.
- Optional reading frequently displaced → reduce its recurrence.
- Hackathon work repeatedly replacing DSA → ask owner to set a hackathon budget and protect learning blocks.
- Lessons consistently taking longer → adjust multiplier.
- Missing attendance → calculate the actual subject/practical risk.
- A missed day followed by a return → recognise recovery.
- Deadline with insufficient available time → warn early and propose choices.

Each suggestion must include the pattern detected, evidence window, reason, recommended action, and Accept/Dismiss controls. Never label an inference as a psychological diagnosis.

## 20. Suggested architecture

Suggested folder layout (adjust if a clearer structure is justified):

```text
client/
  pages/*.html
  assets/css/
  assets/js/
  manifest.webmanifest
  service-worker.js
server/
  config/
  middleware/
  models/
  routes/
  controllers/
  services/planner/
  services/calendar/
  services/notifications/
  services/recommendations/
  jobs/
  utils/
  app.js
  server.js
docs/
tests/
.env.example
.gitignore
README.md
package.json
```

Keep the product single-origin on the first deployment if possible: Express serves the static client and API, MongoDB Atlas stores data, and Render hosts the Node service. This avoids unnecessary cross-origin cookie/service-worker complications. A Vercel frontend can be added later with a deliberate proxy/CORS/cookie setup and full notification testing.

## 21. Security and engineering quality

- Use Helmet, rate limiting, server-side validation, safe error handling, password hashing, secure HTTP-only cookies, and HTTPS in production.
- Use `.env` and update `.env.example`; never commit real secrets.
- Keep Google OAuth secrets, Calendar tokens, MongoDB credentials, and VAPID private key server-side.
- Limit CORS to known origins if separate origins are used.
- Escape/render user notes safely to prevent stored XSS.
- Add indexes for owner/date, owner/status, course/lesson, hackathon/deadline, and attendance subject/date lookups.
- Write backups/export guidance.
- Handle `Asia/Kolkata` explicitly; don't rely on server machine timezone.
- Provide database connection, Calendar, push, and scheduler health diagnostics.
- Do not put sensitive personal context or real journal content in seed data.

## 22. Required test coverage / acceptance criteria

Do not mark a feature complete because its page renders. Test the whole workflow.

1. Owner can create account/login and private routes are protected.
2. Timetable templates are editable and recurring correctly.
3. Conflicting schedule blocks are detected; Sunday oratory conflict is surfaced.
4. Sleep-window warning appears for the initial weekday schedule.
5. User can create tasks from a course lesson, including video duration and practice multiplier.
6. Timer survives refresh and calculates accurate remaining time from persisted timestamps.
7. Partial completion carries only remaining effort.
8. A missed day does not shift the entire plan forward by one day.
9. Replanner respects priority, dependencies, deadlines, and capacity limits.
10. Optional tasks can be deferred without being marked failed.
11. Slack allowance usage and monthly reset are correct and auditable.
12. Replan proposal visibly explains additions, movements, reductions, and deferrals.
13. Google Calendar create/update/delete is idempotent and does not create duplicate events.
14. OAuth tokens are never returned to the browser.
15. Browser permission/subscription and scheduler health are represented accurately.
16. Attendance works per subject, per practical, and overall with date history.
17. Exam Mode lowers optional workload and re-entry does not create a backlog wall.
18. Hackathon rounds produce deadlines/reminders and tasks can be assigned by member name.
19. Journal/history/course notes persist and can be searched.
20. Fitness, weight, no-sugar, book, rewards, and savings records persist.
21. All modules are responsive; no TypeScript, no gradients, no photo upload feature.
22. User can export/backup personal records.

For every feature, report what was tested and any external setup that remains. Never report a Google Calendar or push integration as working unless it has been tested with actual credentials and a live delivery.

## 23. Git workflow — commit and push after each working feature

- Inspect `git status` and current branch first.
- Keep existing history and remotes.
- Create a feature branch such as `feature/shloki-foundation` or continue an already active feature branch.
- Implement one coherent feature at a time.
- Run relevant automated tests and a manual smoke test.
- Review the diff; remove debug code and secrets.
- Commit with clear messages, e.g. `feat(planner): add capacity-aware daily task scheduling`.
- Push after each feature is tested and working, provided GitHub credentials are configured.
- Never force-push or rewrite `main` history.
- If push is blocked, state that honestly and provide the exact command/error. Do not claim a push succeeded when it did not.
- Update README/docs when functionality, API routes, setup, or environment variables change.

## 24. Implementation sequence

Do not spend the first session building only an attractive landing page. Build a functioning core in this order:

### Phase A — Foundation

- Repo audit and architecture
- Node/Express setup, MongoDB Atlas connection, environment validation
- Basic owner email/password auth
- Shared visual system and navigation
- Private route protection

### Phase B — Core daily execution

- Dashboard and Today page
- Task CRUD and daily timeline
- Editable weekday/Saturday/Sunday/holiday/exam schedules
- Calendar/date navigation
- Persistent focus timer

### Phase C — Slack Days engine

- Daily capacity calculator
- P1/P2/P3 priorities
- Partial completion
- Slack allowance
- Replan proposal and confirm/edit/reject
- Bounded backlog and show-up/recovery streaks
- Tests for missed-day scenarios

**Do not move to decorative modules until Phase C works.**

### Phase D — Learning systems

- Import course catalog
- Web-development and DSA lesson trackers
- 1.6× default coding effort estimate with override
- Weekly challenges
- Oratory 13-week lab

### Phase E — Reminders and calendar

- Google Calendar OAuth and event sync
- PWA/service worker
- Browser push subscription and server scheduler
- Timer notifications and health diagnostics

### Phase F — Academics and hackathons

- College schedule and attendance (subject/practical/overall)
- Assignments, class tests, semester exams, Exam Mode
- Hackathon stages, delegation, deadlines, LinkedIn retrospective

### Phase G — Personal life modules

- Fitness, weight, no-sugar check-ins
- Journal, Reset Room, History notes
- Business reading and Section X
- Rewards, movie unlocks, ₹4,000 trip savings

### Phase H — Production readiness

- Test suite, responsive/a11y pass, error states, data export/backup
- Deployment docs and production smoke test
- README and screenshots later if owner requests them (do not fabricate screenshots)

## 25. Final instruction

Build a real, maintainable product. Prefer fewer functioning workflows over many fake pages. Make the planner intelligent, transparent, and bounded. Make reminders honest and testable. Make the design distinctive and beautiful without gradients or generic AI decoration. Preserve the owner's ability to edit every schedule, course, goal, task, reward, date, and priority.

At the end of each feature, give the owner a short report: feature completed, how to test it, files changed, tests passed, commit hash, push status, and anything still requiring credentials.

**Start by auditing the repo and reading the project docs. Then build Phase A.**

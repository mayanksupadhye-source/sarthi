SARTHI — Personal Execution & Student Operating System
<p align="center">
  <strong>Plan realistically. Focus on what matters today. Recover when life changes.</strong>
</p><p align="center">
  <em>An adaptive workspace for students to coordinate academics, learning, projects, routines, and personal goals — without turning every missed task into a growing backlog.</em>
</p><p align="center">
  <a href="#-overview">Overview</a> ·
  <a href="#-the-problem">The Problem</a> ·
  <a href="#-key-capabilities">Capabilities</a> ·
  <a href="#-adaptive-planning-engine">Adaptive Planning</a> ·
  <a href="#-roadmap">Roadmap</a> ·
  <a href="#-technology">Technology</a> ·
  <a href="#-contributing">Contributing</a>
</p>📌 Overview
SARTHI is a personal execution and student operating system designed to bring a student's responsibilities into one structured, adaptable workspace.

Students often manage their academic schedules, attendance, assignments, examinations, online courses, skill development, extracurricular projects, fitness routines, notes, and personal commitments across separate apps, spreadsheets, calendars, and notebooks. These tools may each solve one small problem, but they rarely work together to help someone make realistic decisions about time, priorities, and changing circumstances.

SARTHI aims to connect those responsibilities through a shared planning layer. It helps users translate larger goals into manageable actions, understand their actual capacity, track progress, and adjust plans when deadlines, workload, or unexpected events change.

Its defining principle is:
A missed day must never automatically invalidate the next day.

SARTHI is not intended to maximise the number of tasks on a calendar. It is designed to help people make sustainable commitments, execute the next meaningful action, and recover intelligently when reality does not match the plan.

Repository: mayanksupadhye-source/sarthi
Product name: SARTHI
Category: Student productivity · Personal planning · Adaptive execution
Initial audience: Students managing academics alongside independent learning and extracurricular commitments
Primary timezone support: Configurable; Asia/Kolkata is the initial default
🎯 The Problem
Student life is not made up of one isolated schedule. Academic responsibilities compete with skill development, projects, internships, competitions, health, and personal commitments. Most productivity tools focus on storing tasks or displaying calendars; the harder problem is coordinating these commitments under limited and changing capacity.

Common problems include:
- Fragmented systems: Tasks, attendance, course progress, deadlines, notes, and routines live in different places.
- Unrealistic planning: Plans are often created without accounting for fixed commitments, rest, task effort, or available time.
- Deadline collisions: Academic work, project milestones, and personal goals can compete for the same hours.
- Backlog accumulation: When a day is disrupted, conventional planners can push unfinished tasks forward and overload the next day.
- Poor visibility into progress: A completed video, independent practice, revision, and demonstrated understanding are not the same achievement.
- Weak recovery workflows: Many systems measure consistency through streaks but provide little help with deciding what to do after a disruption.
The result is not simply an untidy task list. It is a coordination problem: users need to decide what matters, what can realistically fit, what should move, and what should be deliberately deprioritised.
💡 The SARTHI Approach
SARTHI connects planning, execution, and review in one workflow:
1. Capture commitments — organise academic, learning, project, and personal responsibilities.
2. Understand capacity — account for fixed timetable blocks, protected time, deadlines, and estimated effort.
3. Create a realistic daily plan — turn larger goals into a focused set of actionable tasks.
4. Execute and record progress — track sessions, partial completion, and actual time spent.
5. Adapt when plans change — propose a transparent replan instead of blindly shifting every unfinished task.
6. Learn from patterns — use progress history and explainable recommendations to improve future plans.
The user remains in control. SARTHI should explain its recommendations and ask for approval before making material changes to goals, deadlines, or plans.
✨ Key Capabilities
The capabilities below describe the intended product scope. Items are planned unless explicitly marked as implemented in the repository's release notes.
1. Today — Daily Execution Workspace
A focused home view that makes the next useful action easy to identify.
- A prioritised list of today's tasks and timetable blocks.
- A clear next action with a direct way to begin.
- Separate visibility for essential and optional work.
- Daily progress based on meaningful effort, not just task counts.
- Quick check-ins and a view of remaining capacity.
- Contextual reminders and links to relevant modules.
The Today view should remain concise. Long-term roadmaps and large backlogs belong in dedicated planning views.
2. Adaptive Planner & Recovery Engine
The core of SARTHI. It evaluates unfinished work against priority, deadlines, dependencies, estimated effort, and available capacity.
- Task priorities: P1 — Essential, P2 — Important, and P3 — Optional.
- Estimated effort, deadlines, dependencies, recurrence, and completion status.
- Partial completion tracking, including actual minutes completed.
- Capacity-aware planning based on configurable schedules and protected time.
- A configurable monthly buffer, referred to as Slack Days, for genuine disruptions.
- Bounded catch-up rather than moving all missed work to the next day.
- An unscheduled backlog for work that cannot reasonably fit.
- A proposed replan with an explanation of each change.
- Confirm, edit, and reject controls before applying a material replan.
3. Timetable & Calendar
- Editable weekday, weekend, holiday, examination, and custom-day templates.
- Recurring schedule blocks and one-off overrides.
- Conflict detection for overlapping commitments.
- Protected blocks for sleep, classes, rest, and other fixed commitments.
- Calendar views for tasks, classes, deadlines, examinations, and project milestones.
- Optional Google Calendar integration with explicit user authorisation.
4. Learning & Skill Development
Structured learning tracks that distinguish passive consumption from active practice.

Web development
- Course, section, and lesson catalogue.
- Lesson completion and time estimates.
- Coding/practice sessions, projects, and revision.
- Notes and progress history.
Data Structures & Algorithms
- Topic and lecture tracking.
- Independent coding and problem-solving records.
- Practice attempts, solved problems, revision, and confidence.
- Configurable effort estimates that account for practice beyond video duration.
Oratory & communication
- Weekly practice plans and speech topics.
- Speech structure: hook, introduction, key points, example or story, and conclusion.
- Recording-session records and self-review.
- Feedback dimensions such as structure, clarity, confidence, voice, gestures, and persuasion.
- A focused improvement target for the next attempt.
Exploration and independent learning
- Configurable learning tracks for tools, software, business, and other interests.
- Flexible schedules and independent progress records.
5. Academic Command Centre
- Academic terms, subjects, practicals, and class schedules.
- Date-wise attendance records.
- Subject-wise, practical-wise, and aggregate attendance calculations.
- Configurable institutional attendance thresholds and personal targets.
- Attendance risk forecasts based on future scheduled classes.
- Assignment and submission tracking.
- Class tests, examinations, syllabus coverage, and revision plans.
- Exam Mode to temporarily prioritise academic work without deleting progress in other areas.
Attendance calculations should be transparent and based on the institution's configured rules. SARTHI must not assume one universal attendance policy.
6. Project & Hackathon Workspace
A structured space for competitions, team projects, and time-bound initiatives.
- Event details, registration dates, milestones, and submission deadlines.
- Team member names, roles, and task assignments.
- Configurable stages such as proposal, presentation, prototype, demo, and final round.
- Task owners, dependencies, estimates, and status.
- Links to repositories, deployed demos, pitch decks, and other project resources.
- Weekly effort budgets and visibility into conflicts with academic priorities.
- Post-project reviews and lessons learned.
The initial scope is personal project coordination, not a full external team-collaboration platform.
7. Focus Sessions & Time Tracking
- Start, pause, resume, and complete focus sessions.
- Link sessions to a task, course, project, or independent activity.
- Store start/end timestamps and actual focused duration.
- Restore timer state after refresh or reopening the application.
- Record interruptions and optional session notes.
- Use actual recorded effort to improve future task estimates.
Timer calculations should be timestamp-based rather than dependent on a browser tab remaining open.
8. Notes, Journal & Reflection
- Searchable, date-linked notes and journal entries.
- Separate spaces for learning notes, project reviews, reading notes, and general reference material.
- Tags, titles, timestamps, and text search.
- Autosave with a visible save/error state.
- A private reflection workflow for reviewing difficult days and identifying a manageable next step.
Reflection features are for personal organisation and self-review. SARTHI is not a medical, diagnostic, or mental-health treatment service.
9. Personal Routines & Well-being
- Configurable habits and daily routines.
- Workout and activity logs.
- Optional measurement tracking and progress history.
- Reading sessions and learning reflections.
- Neutral check-ins that avoid shame-based streak mechanics.
- Rest and recovery can be recorded as intentional choices.
SARTHI should not prescribe medical treatment, crash diets, or unsafe health targets.
10. Goals, Rewards & Savings
- User-defined goals, milestones, and review dates.
- Configurable reward catalogue and transparent unlock conditions.
- Savings goals with dated contribution records.
- Progress summaries showing saved, remaining, and target amounts.
- No bank-account connection or payment processing in the initial scope.
11. Notifications & Integrations
- In-app reminders.
- Browser notifications where permission is granted.
- PWA push notifications where supported and correctly configured.
- Optional Google Calendar synchronisation.
- Integration-health indicators, last-sync timestamps, and reconnect guidance.
Notifications must report their actual delivery and scheduling status. The interface must never claim a reminder was scheduled or delivered when the required subscription, credentials, or background scheduler is unavailable.
12. Insights & Recommendations
SARTHI is intended to begin with transparent, deterministic recommendations, not unsupported claims of artificial intelligence.

Examples include:
- Identifying repeated over-capacity days.
- Highlighting deadlines with no available work slot.
- Suggesting a lower optional workload during examination periods.
- Adjusting effort estimates when tasks consistently take longer than expected.
- Identifying recurring schedule conflicts.
- Recognising a successful return to execution after a disruption.
Every recommendation should state what pattern was observed, why it matters, and what action is proposed. Users should be able to accept or dismiss it.
🧠 Adaptive Planning Engine
A task manager records what needs to be done. An adaptive planner must also help determine what should happen when the original plan is no longer feasible.

SARTHI's planning engine is designed around the following inputs:
Input	Purpose
Priority	Distinguishes essential work from optional work
Deadline	Identifies time-sensitive commitments
Dependencies	Prevents dependent work from being scheduled prematurely
Estimated effort	Represents the expected time required
Actual effort	Improves estimates and preserves completed work
Timetable	Identifies available and protected time
Capacity limit	Prevents unrealistic daily schedules
Disruption/buffer allowance	Supports recovery without unlimited catch-up
Academic/project context	Helps protect high-impact commitments


Replanning workflow
When a user reports a missed or partially completed task, SARTHI should:
1. Ask what was completed, partly completed, or missed.
2. Preserve completed work and carry forward only the remaining effort.
3. Recalculate available capacity across a short planning horizon.
4. Rank remaining work using priority, deadline, dependencies, and context.
5. Protect essential commitments where feasible.
6. Reduce, defer, or leave optional work unscheduled when capacity is constrained.
7. Limit additional catch-up effort to a configurable amount.
8. Identify conflicts that cannot be resolved automatically.
9. Present a before-and-after proposal with reasons.
10. Apply the proposal only after user confirmation.
Slack Days
Slack Days are a configurable recovery allowance, not a punishment system or a replacement for realistic planning.
- Allow a configurable number of buffer days within a defined period.
- Show remaining allowance and its usage history.
- Make reset rules explicit and configurable.
- Do not consume allowance without a recorded disruption or user-approved action.
- Continue to support replanning when the allowance is exhausted; the system must not leave the user without a recovery path.
Progress without shame
SARTHI should distinguish:
- Show-up check-in: a meaningful start or an intentionally recorded rest/recovery day.
- Priority completion: progress on essential tasks.
- Overall effort: completed effort compared with planned effort, accounting for intentionally deferred work.
- Recovery: returning to a feasible next action after a disruption.
Historical progress must not be erased because a streak ends. Optional tasks should not be represented as failed obligations.
🧭 Product Principles
1. Reality over ideal schedules. Plans must account for capacity, rest, and fixed commitments.
2. Execution over dashboard decoration. Every major screen should support a real workflow.
3. Recovery over streak perfection. A disrupted day should not create an impossible tomorrow.
4. User control. Material changes require clear explanations and approval.
5. Progress is multidimensional. Watching, practising, revising, attending, and delivering are different forms of progress.
6. Explainable recommendations. The system should show why it suggests an action.
7. Privacy by default. Personal records and notes must remain authenticated and protected.
8. Honest integrations. Never simulate successful reminders, calendar events, or data sync.
9. Configurable by design. Schedules, goals, thresholds, and learning tracks should not be hard-coded.
10. Accessible and responsive. Core workflows must work on desktop and mobile.
🗺️ Roadmap
SARTHI is intended to be developed in testable stages. The roadmap describes planned scope, not a claim that every feature is already available.
Phase	Focus	Expected outcome
1	Foundation	Repository structure, design system, authentication, database connection, configuration
2	Daily execution	Today view, task management, timetable, calendar basics, persistent focus timer
3	Adaptive planning	Capacity model, partial completion, Slack Days, replan proposals, recovery tests
4	Learning workspace	Course catalogues, lesson progress, DSA practice, oratory sessions, notes
5	Academic workspace	Attendance, assignments, tests, exams, Exam Mode
6	Project workspace	Hackathon/project milestones, team task assignment, effort budgets
7	Personal workspace	Habits, fitness logs, journal, reading, goals, rewards, savings
8	Integrations	Google Calendar, PWA notifications, scheduler and integration diagnostics
9	Insights & release readiness	Explainable recommendations, analytics, accessibility, security review, deployment


Near-term priorities
The first usable release should focus on a small number of complete workflows:
- Secure sign-in and private data access.
- Create and manage tasks.
- Configure a realistic timetable.
- View and execute today's plan.
- Track focus sessions and actual effort.
- Record partial completion.
- Replan after a disrupted day without shifting the entire schedule.
Additional modules should be introduced as working vertical slices rather than as empty placeholder pages.
🏗️ Technology
The initial architecture is designed to remain lightweight, understandable, and maintainable.
Layer	Planned technology
Frontend	HTML, CSS, modern JavaScript (ES modules)
Backend	Node.js, Express.js
Database	MongoDB Atlas, Mongoose
Application model	Multi-page web application with shared UI components
PWA	Web app manifest and service worker
Calendar integration	Google Calendar API with OAuth 2.0
Notifications	Web Notifications API, Push API, service worker, server-side scheduler
Testing	Automated unit/integration tests plus documented end-to-end manual checks
Initial deployment direction	Render for the Node.js application; MongoDB Atlas for persistence


Implementation constraints for the initial version
- Use plain JavaScript; do not introduce TypeScript.
- Use vanilla HTML, CSS, and JavaScript; do not introduce React, Next.js, Vue, or Angular.
- Keep frontend pages, backend routes, business logic, database models, and background jobs separated.
- Keep secrets in environment variables and out of version control.
- Treat Google Calendar authorisation as a separate, optional connection from application sign-in.
The architecture may evolve as implementation and testing reveal better options, but changes should preserve the product's lightweight and maintainable direction.
🧱 High-Level Architecture
The application is expected to use a modular structure:
sarthi/
├── client/
│   ├── pages/
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   └── icons/
│   ├── manifest.webmanifest
│   └── service-worker.js
├── server/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   │   ├── planner/
│   │   ├── calendar/
│   │   ├── notifications/
│   │   └── recommendations/
│   ├── jobs/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── docs/
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
This is a reference structure, not a requirement to create empty folders. Implement modules when they have a working use case.
Core domain areas
The data model is expected to separate high-volume and long-form records rather than storing everything inside one user document. Likely domain entities include:
- User and authentication session
- Schedule templates and schedule blocks
- Courses, sections, and lessons
- Tasks, daily plans, replan proposals, and Slack Day usage
- Focus sessions and check-ins
- Academic terms, subjects, class sessions, attendance, assignments, tests, and exams
- Projects, hackathons, stages, members, and tasks
- Notes, journal entries, and reflections
- Habits, workout logs, and measurements
- Goals, rewards, and savings entries
- Calendar connections, external event links, push subscriptions, and notifications
The exact schema should be documented and validated as the application is implemented.
🔐 Privacy, Security & Reliability
SARTHI may contain sensitive personal notes, schedules, academic records, and activity history. Privacy and reliability are core requirements.
- Require authentication for private application data.
- Enforce user-level data ownership on the server for every protected operation.
- Hash passwords with a suitable password-hashing algorithm.
- Use secure, HTTP-only cookies or another appropriately secured session mechanism.
- Validate and sanitise incoming data on the server.
- Use HTTPS in production, secure headers, rate limiting, and carefully configured CORS.
- Keep database credentials, session secrets, OAuth secrets, and VAPID private keys out of frontend code and source control.
- Store OAuth tokens securely on the server and request only the scopes needed.
- Use explicit timezone handling and consistent timestamp storage.
- Provide data export and backup guidance.
- Keep an audit trail for important user corrections and material replanning actions.
- Display integration and scheduler health honestly.
- Avoid collecting data that is not required for the product's stated purpose.
🎨 Design Direction
SARTHI should feel like a carefully designed, dependable workspace — not a generic task dashboard or an AI-generated admin template.

Visual direction
- Strong typography and a clear information hierarchy.
- A restrained, recognisable colour palette.
- Solid surfaces, purposeful contrast, subtle borders, and consistent spacing.
- Data visualisations only when they communicate meaningful user data.
- Distinct visual treatment for planning, execution, learning, and reflection.
- Responsive layouts with mobile-first attention to quick actions and focus sessions.
- Accessible controls, readable text, keyboard support, and clear interaction states.
Avoid
- Linear gradients and gradient-filled backgrounds.
- Excessive glassmorphism, blur, neon effects, and decorative noise.
- Repetitive rounded cards used as the default layout for everything.
- Fake charts, fake statistics, placeholder buttons, and simulated integrations.
- Guilt-heavy failure states or manipulative streak mechanics.
The interface should prioritise clarity and usability. Visual polish must support working functionality, not conceal missing functionality.
🧪 Quality & Definition of Done
A feature is not complete because its page renders. It is complete when its core workflow works, its data persists, and important edge cases have been tested.
Critical acceptance criteria
- [ ] Users can authenticate and access only their own records.
- [ ] Users can create, edit, complete, and defer tasks.
- [ ] Timetable templates support recurring blocks and one-off overrides.
- [ ] Schedule conflicts and insufficient capacity are surfaced clearly.
- [ ] The Today view shows a useful, prioritised daily plan.
- [ ] Focus-session state survives refresh and reopening.
- [ ] Partial completion preserves completed effort and carries forward only remaining work.
- [ ] A missed day does not automatically shift the entire schedule.
- [ ] Replanning respects priorities, dependencies, deadlines, and daily capacity.
- [ ] Replan proposals explain changes and require confirmation.
- [ ] Slack Day usage is transparent and follows configured reset rules.
- [ ] Optional work can be deferred without being counted as failure.
- [ ] Calendar synchronisation avoids duplicate external events.
- [ ] Notification health reflects actual subscription and scheduler status.
- [ ] Attendance calculations use configurable institutional rules.
- [ ] Exam Mode protects academic work without deleting other progress.
- [ ] Notes and journal entries persist and can be searched.
- [ ] Core workflows are usable on mobile and desktop.
- [ ] Empty, loading, error, and success states are implemented.
- [ ] No secrets or private user records are committed to the repository.
Testing expectations
The adaptive planner needs dedicated tests for:
- A fully missed day.
- A partially completed task.
- Multiple missed tasks with different priorities.
- A deadline that conflicts with available capacity.
- Tasks with dependencies.
- A week with repeated overload.
- Exhausted Slack Day allowance.
- Optional work being deferred.
- A user rejecting or editing a proposed replan.
Tests should verify not only the proposed schedule but also that the system does not silently delete tasks, alter hard deadlines, or exceed configured capacity.
🚀 Getting Started
The repository's setup instructions should be kept in sync with the actual implementation. The following is the intended local setup once the application foundation is in place.
Prerequisites
- Node.js (use the version specified by the project when available)
- npm
- A MongoDB Atlas cluster or local MongoDB instance
- Git
Setup
git clone https://github.com/mayanksupadhye-source/sarthi.git
cd sarthi
npm install
Create a local environment file using the project's example:
cp .env.example .env
Configure the required values in .env. Never commit this file.
PORT=5000
NODE_ENV=development
MONGODB_URI=
SESSION_SECRET=
Start the application using the script defined in package.json:
npm run dev
Setup status: These commands describe the intended setup flow. Confirm the actual scripts and required environment variables against the current package.json and .env.example before running; setup instructions will be updated as implementation stabilises.

Optional integrations
Google Calendar and web push require additional provider credentials, explicit user authorisation, and server-side configuration. They should remain optional and must expose their connection status in the application.
🛣️ Scope & Non-Goals
To keep the initial product coherent and deliverable, the following are outside the initial scope:
- A public social network or student community feed.
- A full multi-tenant SaaS collaboration suite.
- External accounts for every teammate.
- Banking, payment processing, or brokerage connections.
- Automated trading or personalised buy/sell recommendations.
- Medical diagnosis, therapy, or treatment advice.
- Calorie counting or prescriptive diet planning.
- A photo gallery or general-purpose file-upload platform.
- Claims of AI-powered prediction where the implementation is actually rule-based.
These boundaries can be revisited through deliberate product decisions rather than being added implicitly.
🔭 Future Possibilities
Potential extensions after the core planning and recovery workflows are reliable:
- Workload forecasting: estimate upcoming weekly load from known classes, deadlines, and recurring commitments.
- Adaptive effort estimates: learn from a user's historical planned-versus-actual task durations.
- Smart schedule suggestions: propose alternative time blocks while respecting user-defined constraints.
- Academic analytics: identify attendance risk, syllabus coverage gaps, and examination workload.
- Project workload balancing: compare personal capacity against project and team milestones.
- Offline-first workflows: allow selected tasks, notes, and check-ins to work offline and sync safely later.
- Data portability: export personal records in documented, usable formats.
- Calendar interoperability: evaluate additional calendar providers after Google Calendar support is stable.
- Optional AI assistance: support natural-language task capture or summarisation with explicit user consent, transparent data handling, and human approval for consequential changes.
These are exploratory directions, not committed release promises. The priority remains a dependable execution and recovery system.
🤝 Contributing
SARTHI is being developed with an emphasis on maintainable code, clear product boundaries, and tested workflows.

Before contributing:
1. Read this README and the relevant documentation in docs/.
2. Check existing issues and implementation status.
3. Keep changes focused and avoid unrelated refactors.
4. Add or update tests for behaviour changes.
5. Update documentation when setup, architecture, or product behaviour changes.
6. Never commit secrets, database dumps, private journals, or personal records.
For substantial changes, open an issue or discussion describing the problem, proposed solution, scope, and trade-offs before implementation.
📄 Documentation
Project documentation will be maintained in [`docs/`](docs/) as implementation progresses. Useful planned documents include:
- docs/PRODUCT_SPECIFICATION.md — detailed product requirements and workflows.
- docs/ADAPTIVE_PLANNER.md — planning rules, capacity model, and recovery behaviour.
- docs/DATA_MODEL.md — collections, relationships, indexes, and ownership rules.
- docs/ARCHITECTURE.md — frontend, backend, services, and integration boundaries.
- docs/DEPLOYMENT.md — environment configuration and deployment procedure.
- docs/TESTING.md — test strategy and acceptance scenarios.
Only link to documents that exist in the repository; add links here as each document is created.
📜 License
No license has been specified yet. Until a license is added to the repository, all rights are reserved by the copyright holder. If the project is intended to be open source, add an explicit license file and update this section.
<p align="center">
  <strong>SARTHI</strong><br />
  <em>Make a realistic plan. Take the next step. Adapt when things change.</em>
</p>

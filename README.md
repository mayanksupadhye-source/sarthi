<div align="center">
  <img src="client/assets/sarthi-logo.jpeg" alt="SARTHI logo" width="104" />

  <h1>SARTHI</h1>
  <p><strong>Personal Execution &amp; Student Operating System</strong></p>
  <p>Plan with intent. Execute the next step. Adapt when life changes.</p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-ES%20modules-43853D?logo=node.js&logoColor=white" alt="Node.js ES modules" />
    <img src="https://img.shields.io/badge/API-Express%205-111111?logo=express&logoColor=white" alt="Express 5 API" />
    <img src="https://img.shields.io/badge/Data-MongoDB%20%2B%20Mongoose-47A248?logo=mongodb&logoColor=white" alt="MongoDB and Mongoose" />
    <img src="https://img.shields.io/badge/Client-Responsive%20PWA-2563EB" alt="Responsive progressive web app" />
  </p>
</div>

---

## The idea

SARTHI brings a student's plans, learning, academic responsibilities, projects, routines, and progress into one connected workspace.

Most productivity tools are good at storing tasks. SARTHI is built around the harder part: choosing what can realistically happen today, recording what actually happened, and making a workable next plan when the day changes.

> A disrupted day should lead to a better next step, not an impossible backlog.

The product connects three parts of execution:

1. **Plan** around priorities, deadlines, effort, available time, and fixed commitments.
2. **Execute** through focused sessions, task check-ins, learning activities, and real progress records.
3. **Adapt** with bounded recovery and a visible replan that the user can review and confirm.

## What is in the application

| Workspace | What it supports |
| --- | --- |
| **Today** | A daily execution view that brings planned tasks, schedule context, progress, and the next useful action together. |
| **Tasks & backlog** | Create and prioritise work, record partial effort, complete or defer tasks, and keep unfinished work from silently becoming an unlimited catch-up queue. |
| **Adaptive Planner** | Review available capacity, replan remaining work, use recovery options, and confirm the proposed changes. |
| **Timetable & Calendar** | Manage schedule templates, versions, exceptions, conflicts, and date-based views of work. |
| **Courses Hub** | Create courses, import structured curriculum, preview import changes, and track progress across a nested curriculum. |
| **Exploration Lab** | Maintain independent learning tracks and activities alongside formal courses. |
| **Course Tracker** | Work through activities, record effort, and keep completion in sync with the course roadmap. |
| **DSA & Web Development** | Dedicated learning workspaces for problem-solving and web development curricula. |
| **Focus Timer** | Start, pause, resume, complete, and review focus sessions. |
| **Academics** | Track subjects, attendance, assignments, exams, preparation dates, and exam mode. |
| **Hackathons & Projects** | Organise events, stages, milestones, submissions, status changes, and notifications. |
| **Reading** | Organise reading phases and books, log sessions, and review progress. |
| **Oratory** | Manage public-speaking practice and weekly progress. |
| **Habits & Fitness** | Record routines, fitness activity, and dated measurements. |
| **Journal, Notes & Reset Room** | Keep personal reflections and notes, and use a short recovery workflow to choose a manageable next action. |
| **Evidence Locker** | Record evidence and milestones that support personal progress reviews. |
| **Rewards & Savings** | Track user-defined rewards, savings targets, and contributions. |
| **Share Market Education** | Explore market concepts and record paper-trading activity without connecting a brokerage account. |
| **Analytics & Settings** | Review execution summaries, manage preferences, inspect integration configuration, and export account data. |

The navigation is data-aware: active courses and explorations can appear as direct links, and completed tracks are removed from the active navigation list.

## How the system fits together

The browser client is made from HTML pages, shared CSS, and native JavaScript modules. It calls the Express API, which authenticates requests and reads or writes user-scoped MongoDB records.

~~~mermaid
flowchart LR
  U[User] --> C[Responsive web client / PWA]
  C -->|Session or bearer token| A[Express API]
  A --> M[Authentication, validation, sanitization]
  M --> R[Feature routes and controllers]
  R --> S[Planning and domain services]
  S --> D[(MongoDB via Mongoose)]
  A -->|Static client files| C
  V[Vercel static hosting] -->| /api rewrite | A
  H[Render web service] --> A
~~~

### Design principles

- **Capacity before wish lists.** A plan should fit the time available.
- **Progress is more than a checkbox.** The system distinguishes planned effort, partial work, actual minutes, and completion.
- **Recovery is a workflow.** Unfinished work can be reassessed instead of copied forward without limits.
- **The user stays in control.** Replanning has a review and confirmation step.
- **Learning has structure.** Courses can be represented as a hierarchy of sections, subsections, and activities.
- **Account data is scoped.** Feature routes authenticate the user and query records in that account's context.
- **Integrations report their actual state.** Configuration status is surfaced instead of implying an integration is connected when it is not.

## Repository map

~~~text
.
├── client/
│   ├── assets/
│   │   ├── css/                 Shared design tokens, components, and layout
│   │   └── js/                  API, authentication, navigation, and helpers
│   ├── pages/                   The application screens listed below
│   ├── index.html               Session-aware entry and redirect
│   ├── manifest.webmanifest     Installable app metadata
│   └── service-worker.js        Static app-shell cache
├── server/
│   ├── config/                  Environment and MongoDB connection
│   ├── controllers/             Request handling by feature
│   ├── middleware/              Authentication and input protection
│   ├── models/                  Mongoose data models
│   ├── routes/                  Versionless REST route modules
│   ├── services/                Planning, imports, synchronization, and domain logic
│   └── server.js                Production and development entry point
├── tests/                       Node test-runner suites
├── render.yaml                  Render API service configuration
├── vercel.json                  Static hosting and API rewrite configuration
├── package.json                 Scripts and runtime dependencies
└── .env.example                 Local environment variable template
~~~

### Application pages

All screens are in **client/pages/**:

**academics.html**, **analytics.html**, **calendar.html**, **courses.html**, **dashboard.html**, **dsa.html**, **evidence.html**, **explore.html**, **fitness.html**, **focus.html**, **habits.html**, **hackathons.html**, **intro.html**, **journal.html**, **login.html**, **oratory.html**, **planner.html**, **reading.html**, **reset-room.html**, **rewards.html**, **settings.html**, **sharemarket.html**, **styleguide.html**, **tasks.html**, **timetable.html**, **tracker.html**, and **webdev.html**.

## Technology

| Layer | Implementation |
| --- | --- |
| Client | Responsive HTML, CSS, JavaScript ES modules |
| API | Node.js, Express 5 |
| Persistence | MongoDB with Mongoose |
| Authentication | Password hashing, JWT access/refresh flows, secure cookies, and bearer-token support |
| Input protection | Request sanitization, MongoDB identifier validation, authentication rate limits, CORS allowlist, and Helmet |
| Hosting configuration | Render for the Express service; Vercel configuration for static client hosting and API rewrites |
| Tests | Node.js built-in test runner |

## Local development

### Requirements

- Node.js and npm compatible with the dependencies in **package.json**
- MongoDB, either local or hosted
- PowerShell on Windows, or a POSIX shell on macOS/Linux

### Install

~~~bash
git clone https://github.com/mayanksupadhye-source/sarthi.git
cd sarthi
npm ci
~~~

Create a local environment file from the template:

~~~bash
cp .env.example .env
~~~

On Windows PowerShell:

~~~powershell
Copy-Item .env.example .env
~~~

Set **MONGODB_URI** to a database you control. For local development, the template uses **mongodb://127.0.0.1:27017/sarthi**.

### Configure the server

| Variable | Purpose |
| --- | --- |
| **PORT** | HTTP port. Defaults to **5000** locally. |
| **NODE_ENV** | Runtime mode. Use **development** locally and **production** for deployment. |
| **MONGODB_URI** | MongoDB connection string. |
| **APP_TIMEZONE** | App timezone used by date-aware workflows. Defaults to **Asia/Kolkata**. |
| **JWT_SECRET** | Signs access and session tokens. |
| **JWT_REFRESH_SECRET** | Signs refresh tokens. |
| **SESSION_SECRET** | Session/cookie security secret. |
| **CLIENT_ORIGIN** | Allowed browser origin when the client is hosted separately. |
| **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **GOOGLE_REDIRECT_URI** | Optional integration configuration read by the settings diagnostics. |
| **VAPID_PUBLIC_KEY**, **VAPID_PRIVATE_KEY**, **VAPID_SUBJECT** | Optional browser push configuration. |

The server rejects the development fallback secrets in production. Set unique values for **JWT_SECRET**, **JWT_REFRESH_SECRET**, and **SESSION_SECRET** in the hosting provider's secret settings. Never put production credentials in this file or commit them.

### Run

~~~bash
npm run dev
~~~

Open **http://localhost:5000**. The client entry checks for an existing session and routes to the dashboard or the introduction before login. The Express server also serves the static client from **client/**.

The client API helper supports a separate local frontend server such as VS Code Live Server: when the page is served from localhost on a port other than 5000, API requests are directed to **http://localhost:5000**. Start the API server as well.

For a normal server start:

~~~bash
npm start
~~~

## API surface

The API is mounted under **/api**. Most feature routes require an authenticated account.

| Base path | Domain |
| --- | --- |
| **/api/auth** | Registration, login, logout, current user, and token refresh/logout. |
| **/api/tasks** | Task CRUD, partial completion, completion, and deferral. |
| **/api/planner** | Today plan, replanning proposals and confirmation, availability, recovery, curriculum allocation, reflections, and calendar events. |
| **/api/timetable** | Schedule templates and versions, blocks, exceptions, and conflict checks. |
| **/api/focus** | Active session, start/pause/resume/complete/cancel, and focus history. |
| **/api/courses** | Course management, activity tracking, curriculum CSV preview/diff/commit, and Oratory program data. |
| **/api/academic** | Subjects, attendance, assignments, exams, exam mode, and preparation dates. **/api/academics** is also mounted to the same router. |
| **/api/hackathons** | Hackathon CRUD, stage/status changes, and notification read state. |
| **/api/personal** | Fitness, measurements, habits, notes, journal, reading, market concepts, rewards, and savings. |
| **/api/settings** | User preferences, account data export, and integration configuration status. |
| **/api/insights** | Execution summary data. |
| **/api/emotional** | Daily state, recovery check-ins, evidence, and feedback workflows. |
| **/api/reminders** | Reminder plan information. |

Operational endpoints:

- **GET /healthz** — lightweight liveness response for hosting platforms.
- **GET /api/health** — API and MongoDB connectivity status.
- **GET /api/healthz** — API liveness response.

## Data and workflow notes

- Registration seeds each account with starter settings, a schedule template, and routine/reward records when those records do not already exist.
- Course imports can be previewed before commit; the importer builds nested curriculum structures and protects completed activities during updates.
- Course activity completion synchronizes progress and can archive a finished track. Reopening a track makes it active again.
- Task execution can record partial effort. The planner uses remaining work and available capacity when preparing a replan.
- Timetable exceptions are separate from recurring templates, so one-off changes do not require replacing the base schedule.
- Focus sessions are stored as records and can be reviewed in history.
- The PWA service worker caches static shell assets. API requests and data mutations bypass the cache; offline writes are not queued.
- Account data export is available from Settings.

## Tests

Run the project test suite with:

~~~bash
npm test
~~~

The suites cover areas including planner capacity and recovery, task execution, curriculum imports, attendance, timetable versions, focus history, reading, journaling, hackathon lifecycle, authentication/input safety, and database resilience.

To run one file directly:

~~~bash
node --test tests/plannerEngine.test.js
~~~

## Deployment

### Render

The repository's **render.yaml** describes a Node web service:

- Build: **npm install --omit=dev**
- Start: **node server/server.js**
- Health check: **/healthz**
- Required production secrets and database credentials are configured as Render environment variables.

The manifest currently selects the **deployment** branch. The Express server serves both the API and the client files.

### Vercel

The root **vercel.json** maps client pages and assets and rewrites **/api/** requests to the Render service. Replace the **&lt;RENDER_API_URL&gt;** placeholder with the deployed API origin before using that rewrite. Set **CLIENT_ORIGIN** on the API service to the frontend origin so the CORS allowlist accepts the browser client.

### Capacitor

The Express CORS allowlist includes **capacitor://localhost** and **https://localhost** origins. This repository does not include a Capacitor project scaffold; a native wrapper and its build/release configuration must be maintained separately.

## Security and privacy

- **.env** and local profile seed data are excluded from Git.
- Production refuses the built-in development JWT/session secrets.
- Authentication endpoints are rate-limited.
- Authenticated feature routers scope operations to the current user.
- Request keys are sanitized to reject MongoDB operators and dotted property paths.
- Route identifiers are validated before database operations.
- CORS is allowlist-based; configure **CLIENT_ORIGIN** for a separately hosted client.
- Do not place real personal records, passwords, access tokens, database exports, or private keys in source files or commits.

## Contributing

Keep changes focused on a user-visible workflow or a clear backend capability. For behavior changes, update the relevant tests and keep this README aligned with what the repository actually implements. Avoid committing secrets or real account data.

## License

The package metadata declares **ISC**. A separate license file is not currently present in the repository.

<div align="center">
  <br />
  <strong>Make a realistic plan. Take the next step. Adapt when things change.</strong>
</div>

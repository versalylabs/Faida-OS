# ⚡ Faida OS — Personal Operating System & Second Brain

> **Do less. Waste less energy. Get the outcome anyway.**

Faida OS is a production-grade personal operating system, second brain, and execution engine designed for high-agency builders, developers, and autonomous professionals. It bridges strategic multi-week project planning, daily timeboxed execution, Kenya-native financial tracking, curriculum learning, and AI copilot automation into one cohesive, dark-themed platform.

---

## 🌟 Core Features & Modules

### 1. 🚀 Execution & Planning
- **Personal Mission Control (`/`)**: Real-time dashboard tracking urgent deadlines, due-today commitments, active queues, KES cashflow, and project completion velocities.
- **Universal Capture Engine (`/capture` or `Cmd/Ctrl+K`)**: Instant intake interface with AI heuristic classification into Tasks, Reminders, Calendar Events, Notes, Shopping Items, or KES Expenses.
- **Daily Planner (`/planner`)**: A day you can actually follow. It starts from *now* (in your time zone), works around today's calendar events and university classes, protects lunch, puts overdue and due-today work first, schedules heavy work in your morning, cuts long tasks into focused blocks with breaks, and never plans beyond the focus time you choose. Tasks that do not fit are listed with the reason and a one-tap "move to tomorrow".
- **Task & Execution Queue (`/tasks`)**: Priority-ranked board (`URGENT`, `HIGH`, `MEDIUM`, `LOW`) with subtasks, duration estimates, repeating tasks (daily, weekdays, weekly, monthly, yearly: finishing one lines up the next), and status filtering. **Finished tasks and finished work deliverables clear themselves 48 hours after completion.**

### 2. 🧠 Second Brain & Projects
- **Project Hub & Workspaces (`/projects` & `/projects/[id]`)**: Deep-focus workspaces with milestone roadmaps, automated velocity tracking, and centralized access to linked tasks, notes, credentials, and files.
- **Knowledge Base (`/knowledge`)**: Markdown repository for documentation, cheat sheets, and architectural insights with fast search across tags and categories.
- **Curriculum & Learning Management (`/learning`)**: Structured learning subjects and topics with an integrated Pomodoro study logger that automatically synchronizes notes to the Knowledge Base.

### 3. 💰 Life Operations
- **KES Finance Tracker (`/finance`)**: Kenya-native cashflow manager strictly in **Kenyan Shillings (KES)** with income/expense logging, category breakdown, and monthly budget burn analysis.
- **Smart Shopping List (`/shopping`)**: Store-organized shopping inventory with estimated prices, quantity counters, and one-click purchase completion.
- **Recurring Maintenance Engine (`/maintenance`)**: Preventative upkeep scheduler for computers, home, development environments, and personal admin with automated next-due date rollforward.

### 4. 🛋️ Lazy Mode (`/lazy`): spend as little energy as possible
Built for tired days. You tell it how much energy you have; it protects the rest.
- **Energy check-ins**: one tap (Drained, Tired, Okay, Sharp) or a slider. Faida learns your real rhythm by hour of day and starts from it, falling back to a sensible curve at first.
- **Do this now**: one task only, chosen to fit your energy. Essentials (urgent, due today, overdue) come first; if one is too heavy for your energy you get a **15-minute sprint** instead of the whole thing. "Not this one" gives you the next.
- **Focus timer**: start the task or sprint with a countdown, then finish it, or stop knowing 15 minutes was enough.
- **Can't wait vs can wait**: only what has to happen today is shown first. Everything else sits behind "Can wait", with a one-tap **defer to tomorrow** or **drop** (both with undo).
- **Quick wins**: up to four light tasks as a tick-off checklist that clears them with almost no thinking.
- **Real "energy kept" numbers**: time freed by deferring and dropping, plus quick wins and sprints, counted from what you actually did.
- The slider and every action respond instantly: the logic runs on your device.

### 5. 🤖 Faida AI Assistant (Slide-Out Chat Drawer)
- **Morning Mission Briefing**: Delivers executive briefings of active queues, top priorities, and KES budget balance.
- **Goal Decomposer**: Decomposes abstract goals into 4 sequenced, executable tasks.
- **Natural Language Actions**: Logs expenses, adds shopping items, dispatches low-energy batches, and marks tasks complete via chat.

### 6. 🛠️ Developer Hub & Smart Asset Organizer
- **Developer Credential Hub (`/developer`)**: Secure vault for API keys, database URLs, and webhook secrets across development, staging, production, and local environments, with an automatic **Local Port Conflict Detector** (flags colliding ports like 3000, 5432, 8080).
- **Smart File Organizer (`/files`)**: Upload files from your device (up to 4 MB each; big phone photos are shrunk automatically), then open or download them whenever you need. Files are stored privately in your database and only you can open them.

---

## 🔐 Multi-User Authentication & Privacy

- **Strict Multi-Tenant Isolation**: Every user account has its own isolated data sandbox. No user can view or modify another user's tasks, notes, or finances.
- **Clean Slate for New Users**: Any newly registered user begins with an entirely empty, clean state (0 tasks, 0 projects, 0 transactions).
- **Your data, your copy**: **Settings → Download my data** exports everything in your account as one JSON file.
- **Security**: Passwords are hashed with `bcryptjs`; opaque database-backed sessions are revocable on logout; login and registration attempts are throttled.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm
- A **PostgreSQL** database. [Neon](https://neon.tech) (free tier) is what production uses; any PostgreSQL works.

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/versalylabs/Faida-OS.git
cd Faida-OS

# 2. Install dependencies (also generates the Prisma client)
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and set DATABASE_URL to a PostgreSQL connection string.

# 4. Create the tables in that database
npx prisma db push

# 5. Start the development server
npm run dev
```

Visit `http://localhost:3000` and create your account on the sign-in screen.

> **Use a separate database for development.** `prisma db push` and everything you do in the app writes to
> whatever `DATABASE_URL` points at. With Neon, create a **branch** of your project (Branches → New branch) and use
> that branch's connection string locally, so testing never touches production data.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon pooled string recommended). |
| `APP_TIME_ZONE` | No | IANA time zone used for "today", due dates and the energy curve. Defaults to `Africa/Nairobi`. |
| `GEMINI_API_KEY` | No | Google Gemini key for smarter capture classification and chat. The app runs without it. |

Sessions are random server-side tokens stored (hashed) in the database, so no signing secret is needed.

---

## 📦 Deployment to Vercel

1. Push your code to GitHub and import the repository into **[Vercel](https://vercel.com)**.
2. Add the `DATABASE_URL` environment variable (Production; add to Preview only if it points at a non-production database).
3. Apply schema changes to the production database **before** deploying code that needs them:
   ```bash
   npx prisma db push
   ```
   (Run it locally with `DATABASE_URL` set to the production string. Vercel does not run it for you. Prefer additive changes so the previous deployment keeps working during the rollout.)
4. Deploy. The build command (`prisma generate && next build`) runs automatically.

Notes:
- **File uploads** are stored privately in the database (limit 4 MB per file, matching Vercel's request-size cap) and are served only to the signed-in owner. Nothing is written to the server's filesystem.
- If an account previously used the old published default password, sign in and change it right away in **Settings → Change Password**. Changing the password revokes that account's other sessions.

---

## 🎨 Design

A liquid-glass interface over one cosy backdrop photo (`public/bg/scene.webp`, credit in `public/bg/CREDITS.md`): frosted translucent surfaces with a bright edge, soft springy press animations, a ripple from where you tap, and a light that follows the pointer across cards. Everything respects reduced-motion and reduced-transparency settings. The design system lives in `src/app/globals.css`.

## 🔢 Where the numbers come from

Nothing is invented. Finance totals for the month are computed over every transaction of the current calendar month (in your time zone) and the dashboard reads the same `/api/finance` figures as the Finance page. New accounts start empty: no sample balances, budgets, clients or revenue.

---

## 📄 License
MIT License. Built for high agency by Ted Khalwale.

## University & LMS sync

Connect a Moodle LMS under **University → Connect LMS** with the student's own access key
(*Profile → Preferences → Security keys → "Moodle mobile web service"*). Faida OS then reads, and never
changes, the LMS:

- units (code, name, lecturer, the LMS's completion %), assignments, quizzes/CATs, marks, class links,
  announcements and newly added materials
- **Units** tab: progress per unit from the work actually completed, marks so far, missed work, next deadline
- **Today & Orbit**: work missed (follow up), due today/tomorrow, live class links, and an activity feed
  of what changed (submitted, marked, new, deadline moved, announced, uploaded)

How it stays current: the app checks quietly when it opens and re-syncs if the last sync is over
8 hours old; a daily job (`vercel.json` → `/api/cron/lms`) covers days the app is not opened. The job
only runs when `CRON_SECRET` is set in the hosting environment, and refuses requests without it.
The access key is stored AES-256-GCM encrypted (key derived from `LMS_TOKEN_SECRET`, or the database URL
when that is unset) and is never sent back to the browser.

## Notifications

Faida OS sends real push notifications to phones and laptops (Settings > Notifications): the evening before
(default 8 pm) and shortly before (default 1 hour) a CAT, assignment deadline, calendar event or business
deliverable, your own reminders at their set time, and a "due today" message for all-day items. Each reminder
is logged, so it goes out once. It uses Web Push (VAPID), so there is no third-party service and no cost.

Server settings: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
Generate keys with `node -e "console.log(require('web-push').generateVAPIDKeys())"`.

Who sends: Vercel's free plan runs jobs once a day (`vercel.json`: 07:00 LMS sync + morning reminders, 20:00
evening reminders). For the "1 hour before" message the GitHub workflow `.github/workflows/reminders.yml` calls
`/api/cron/notify` every 15 minutes; add the same `CRON_SECRET` as a repository Actions secret.

# ⚡ Faida OS — Personal Operating System & Second Brain

> **Do less. Waste less energy. Get the outcome anyway.**

Faida OS is a production-grade personal operating system, second brain, and execution engine designed for high-agency builders, developers, and autonomous professionals. It bridges strategic multi-week project planning, daily timeboxed execution, Kenya-native financial tracking, curriculum learning, and AI copilot automation into one cohesive, dark-themed platform.

---

## 🌟 Core Features & Modules

### 1. 🚀 Execution & Planning
- **Personal Mission Control (`/`)**: Real-time dashboard tracking urgent deadlines, due-today commitments, active queues, KES cashflow, and project completion velocities.
- **Universal Capture Engine (`/capture` or `Cmd/Ctrl+K`)**: Instant intake interface with AI heuristic classification into Tasks, Reminders, Calendar Events, Notes, Shopping Items, or KES Expenses.
- **Daily Timeboxing Planner (`/planner`)**: Algorithmic day planner that slots priorities into focus blocks with 15-minute buffers and real-time schedule drift re-planning.
- **Task & Execution Queue (`/tasks`)**: Priority-ranked execution board (`URGENT`, `HIGH`, `MEDIUM`, `LOW`) with subtasks, duration estimates, and status filtering (`TODO`, `IN_PROGRESS`, `DONE`).

### 2. 🧠 Second Brain & Projects
- **Project Hub & Workspaces (`/projects` & `/projects/[id]`)**: Deep-focus workspaces with milestone roadmaps, automated velocity tracking, and centralized access to linked tasks, notes, credentials, and files.
- **Knowledge Base (`/knowledge`)**: Markdown repository for documentation, cheat sheets, and architectural insights with fast search across tags and categories.
- **Curriculum & Learning Management (`/learning`)**: Structured learning subjects and topics with an integrated Pomodoro study logger that automatically synchronizes notes to the Knowledge Base.

### 3. 💰 Life Operations
- **KES Finance Tracker (`/finance`)**: Kenya-native cashflow manager strictly in **Kenyan Shillings (KES)** with income/expense logging, category breakdown, and monthly budget burn analysis.
- **Smart Shopping List (`/shopping`)**: Store-organized shopping inventory with estimated prices, quantity counters, and one-click purchase completion.
- **Recurring Maintenance Engine (`/maintenance`)**: Preventative upkeep scheduler for computers, home, development environments, and personal admin with automated next-due date rollforward.

### 4. 🛋️ Faida Effort Engine (Lazy Mode — `/lazy`)
- Built specifically for fatigue and low-energy windows.
- **Real-Time Energy Slider (0–100%)**: Dynamically recommends actions based on physical/mental bandwidth.
- **The 4-Action Matrix**:
  - 🗑️ **SKIP**: Defer or eliminate low-priority tasks during low-energy states.
  - 🤖 **AUTOMATE**: Identifies repetitive operational tasks suitable for automation.
  - ⚡ **OPTIMIZE**: Low-Energy Batching — knocks out up to 4 quick micro-tasks (≤20 mins) simultaneously with one click.
  - 🫡 **JUST DO IT**: Protects high-cognitive deep work for peak focus windows.

### 5. 🤖 Faida AI Assistant (Slide-Out Chat Drawer)
- **Morning Mission Briefing**: Delivers executive briefings of active queues, top priorities, and KES budget balance.
- **Goal Decomposer**: Decomposes abstract goals into 4 sequenced, executable tasks.
- **Natural Language Actions**: Logs expenses, adds shopping items, dispatches low-energy batches, and marks tasks complete via chat.

### 6. 🛠️ Developer Hub & Smart Asset Organizer
- **Developer Credential Hub (`/developer`)**: Secure vault for API keys, database URLs, and webhook secrets across development, staging, production, and local environments, with an automatic **Local Port Conflict Detector** (flags colliding ports like 3000, 5432, 8080).
- **Smart File Organizer (`/files`)**: Categorized digital filing cabinet for deliverables, invoices, code snippets, and PDFs.

---

## 🔐 Multi-User Authentication & Privacy

- **Strict Multi-Tenant Isolation**: Every user account has its own isolated data sandbox. No user can view or modify another user's tasks, notes, or finances.
- **Default Owner Account**: Pre-configured for `khalwaleted@gmail.com` with password `teddyfaida` and convenient one-click login autofill.
- **Clean Slate for New Users**: Any newly registered user begins with an entirely empty, clean state (0 tasks, 0 projects, 0 transactions).
- **Security**: Salted password hashing via `bcryptjs`, cryptographic session tokens, and route protection via Next.js Middleware.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm or yarn

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/versalylabs/Faida-OS.git
cd Faida-OS

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Set DATABASE_URL="file:./faida.db" (or your PostgreSQL / Supabase connection string)

# 4. Sync Prisma database schema
npx prisma db push

# 5. Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 📦 Deployment to Vercel

1. Push your code to GitHub.
2. Import the repository into **[Vercel](https://vercel.com)**.
3. Configure the `DATABASE_URL` environment variable (e.g. Supabase, Neon, or Turso connection string).
4. Deploy! Build command `prisma generate && next build` runs automatically.

---

## 📄 License
MIT License. Built for high agency by Ted Khalwale.

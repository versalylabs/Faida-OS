import { prisma } from "@/lib/db";
import { formatKES } from "@/lib/utils";
import {
  ToolActionPayload,
  executeCreateTask,
  executeCompleteTask,
  executeLogFinance,
  executeAddShopping,
  executeDecomposeGoal,
  executeMorningBriefing,
  executeEnergyDispatch,
} from "@/lib/ai/tools";

export interface AssistantResponse {
  reply: string;
  actionExecuted?: ToolActionPayload;
}

export async function askFaidaAssistant(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  userId: string
): Promise<AssistantResponse> {
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  // -------------------------------------------------------------
  // 1. Tool Trigger: Morning Briefing
  // -------------------------------------------------------------
  if (
    lower.startsWith("good morning") ||
    lower === "brief me" ||
    lower.includes("daily briefing") ||
    lower.includes("morning briefing") ||
    lower.includes("game plan")
  ) {
    const res = await executeMorningBriefing(userId);
    return { reply: res.message, actionExecuted: res.action };
  }

  // -------------------------------------------------------------
  // 2. Tool Trigger: Goal Decomposer ("Break down [goal]")
  // -------------------------------------------------------------
  if (
    lower.startsWith("break down") ||
    lower.startsWith("decompose") ||
    lower.includes("break this down") ||
    lower.includes("plan steps for")
  ) {
    const rawGoal = trimmed
      .replace(/^(break down|decompose|break this down:?|plan steps for)\s+/i, "")
      .trim();

    // Extract project hint if provided
    let projName = "Project";
    if (lower.includes("melio")) projName = "Melio";
    else if (lower.includes("faida")) projName = "Faida OS";

    const res = await executeDecomposeGoal(userId, rawGoal || "Project Deployment", projName);
    return { reply: res.message, actionExecuted: res.action };
  }

  // -------------------------------------------------------------
  // 3. Tool Trigger: Energy Dispatch / Exhaustion / 20 mins
  // -------------------------------------------------------------
  if (
    lower.includes("low energy") ||
    lower.includes("exhausted") ||
    lower.includes("tired") ||
    lower.includes("20 minutes") ||
    lower.includes("20 mins") ||
    lower.includes("feeling lazy")
  ) {
    const res = await executeEnergyDispatch(userId, 20);
    return { reply: res.message, actionExecuted: res.action };
  }

  // -------------------------------------------------------------
  // 4. Tool Trigger: Log Finance (KES Expense / Income)
  // "I spent KES 1,800 on lunch at Java House", "Paid KES 4,500 for electricity"
  // -------------------------------------------------------------
  const financeRegex = /(?:spent|paid|received|earned)\s*(?:kes|ksh)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:on|for|from)?\s*(.*)/i;
  const financeMatch = trimmed.match(financeRegex);
  if (financeMatch) {
    const amountStr = financeMatch[1].replace(/,/g, "");
    const amount = parseFloat(amountStr);
    const desc = financeMatch[2]?.trim() || "Expense";
    const isIncome = lower.includes("received") || lower.includes("earned");

    let category = "General";
    const lDesc = desc.toLowerCase();
    if (lDesc.includes("lunch") || lDesc.includes("dinner") || lDesc.includes("coffee") || lDesc.includes("food")) {
      category = "Dining";
    } else if (lDesc.includes("grocer") || lDesc.includes("milk") || lDesc.includes("supplies")) {
      category = "Groceries";
    } else if (lDesc.includes("bill") || lDesc.includes("electricity") || lDesc.includes("water") || lDesc.includes("internet")) {
      category = "Utilities";
    } else if (lDesc.includes("client") || lDesc.includes("freelance") || lDesc.includes("project")) {
      category = "Freelance";
    }

    const res = await executeLogFinance({
      userId,
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      amount,
      type: isIncome ? "INCOME" : "EXPENSE",
      category,
    });
    return { reply: res.message, actionExecuted: res.action };
  }

  // -------------------------------------------------------------
  // 5. Tool Trigger: Add Shopping Items
  // "Add eggs and milk to shopping list from Carrefour"
  // -------------------------------------------------------------
  if (
    (lower.startsWith("add ") && lower.includes("shopping")) ||
    (lower.startsWith("buy ") && lower.length < 50)
  ) {
    let clean = trimmed
      .replace(/^add\s+/i, "")
      .replace(/to\s+(?:my\s+)?shopping(?:\s+list)?/i, "")
      .replace(/^buy\s+/i, "")
      .trim();

    let preferredStore = "Supermarket";
    const storeMatch = clean.match(/from\s+([A-Za-z0-9\s]+)/i);
    if (storeMatch) {
      preferredStore = storeMatch[1].trim();
      clean = clean.replace(/from\s+([A-Za-z0-9\s]+)/i, "").trim();
    }

    const items = clean
      .split(/\s+and\s+|,|&/i)
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
      .map((i) => i.charAt(0).toUpperCase() + i.slice(1));

    if (items.length > 0) {
      const res = await executeAddShopping({
        userId,
        items,
        preferredStore,
        category: "Groceries",
      });
      return { reply: res.message, actionExecuted: res.action };
    }
  }

  // -------------------------------------------------------------
  // 6. Tool Trigger: Complete Task
  // "Mark 'Reply to client email' as done", "Completed task X"
  // -------------------------------------------------------------
  if (
    lower.startsWith("mark ") ||
    lower.startsWith("complete ") ||
    lower.startsWith("finished ") ||
    lower.includes("as done") ||
    lower.includes("as completed")
  ) {
    const taskName = trimmed
      .replace(/^(mark\s+|complete\s+|finished\s+)/i, "")
      .replace(/as\s+(?:done|completed)/i, "")
      .replace(/['"]/g, "")
      .replace(/^task\s+/i, "")
      .trim();

    if (taskName) {
      const res = await executeCompleteTask(userId, taskName);
      return { reply: res.message, actionExecuted: res.action };
    }
  }

  // -------------------------------------------------------------
  // 7. Tool Trigger: Create Task
  // "Create a task to debug Melio webhook with high priority"
  // -------------------------------------------------------------
  if (
    lower.startsWith("create task") ||
    lower.startsWith("create a task") ||
    lower.startsWith("add task")
  ) {
    let raw = trimmed.replace(/^(create\s+a?\s*task\s+(?:to|for)?|add\s+task\s+)/i, "").trim();

    let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM";
    if (lower.includes("urgent") || lower.includes("asap")) priority = "URGENT";
    else if (lower.includes("high")) priority = "HIGH";
    else if (lower.includes("low")) priority = "LOW";

    let durationMinutes = 30;
    const durMatch = raw.match(/(\d+)\s*(?:m|min|mins|minutes|h|hours)/i);
    if (durMatch) {
      const num = parseInt(durMatch[1], 10);
      durationMinutes = raw.includes("h") ? num * 60 : num;
    }

    let projectName: string | undefined;
    if (raw.toLowerCase().includes("melio")) projectName = "Melio";
    else if (raw.toLowerCase().includes("faida")) projectName = "Faida OS";

    const res = await executeCreateTask({
      userId,
      title: raw.charAt(0).toUpperCase() + raw.slice(1),
      projectName,
      priority,
      durationMinutes,
    });
    return { reply: res.message, actionExecuted: res.action };
  }

  // -------------------------------------------------------------
  // 8. General System Retrieval & Contextual Copilot (Scoped to User)
  // -------------------------------------------------------------
  const [
    pendingTasks,
    activeProjects,
    recentNotes,
    recentTransactions,
    userSubjects,
    shoppingItems,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { not: "DONE" } },
      include: { project: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.project.findMany({
      where: { userId },
      include: { milestones: true, tasks: { where: { userId } } },
    }),
    prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.financeTransaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.learningSubject.findMany({
      where: { userId },
      include: { topics: true },
    }),
    prisma.shoppingItem.findMany({
      where: { userId, isChecked: false },
    }),
  ]);

  let totalSpent = 0;
  recentTransactions.forEach((t) => {
    if (t.amount < 0) totalSpent += Math.abs(t.amount);
  });
  const remainingBudget = 310000 - totalSpent;

  if (
    lower.includes("what should i work on") ||
    lower.includes("priority") ||
    lower.includes("next task")
  ) {
    if (pendingTasks.length === 0) {
      return {
        reply: "Your task queue is completely clear! You have open focus time, or you can ask me to create a task for you.",
      };
    }
    const top = pendingTasks[0];
    return {
      reply: `Your top priority right now is **${top.title}** (${top.priority} priority, estimated at ${top.estimatedMinutes} minutes${top.project ? ` under project **${top.project.name}**` : ""}). Starting here will yield the highest leverage today.`,
    };
  }

  if (
    lower.includes("spend") ||
    lower.includes("spent") ||
    lower.includes("finance") ||
    lower.includes("budget") ||
    lower.includes("money")
  ) {
    return {
      reply: `You have spent approximately **${formatKES(totalSpent)}** this month. Your remaining monthly budget is **${formatKES(remainingBudget)}** out of your **${formatKES(310000)}** monthly allocation.`,
    };
  }

  if (lower.includes("project") || lower.includes("projects") || lower.includes("melio")) {
    if (activeProjects.length === 0) {
      return {
        reply: "You don't have any projects registered yet. You can create one in the Projects hub or ask me to break down a goal!",
      };
    }
    const list = activeProjects.map((p) => `• **${p.name}**: ${p.progressPercent}% velocity`).join("\n");
    return {
      reply: `Here is the status of your active project workspaces:\n${list}`,
    };
  }

  if (lower.includes("learn") || lower.includes("study") || lower.includes("topic")) {
    if (userSubjects.length === 0) {
      return {
        reply: "You haven't added any learning subjects yet. You can create a curriculum in the Learning hub!",
      };
    }
    const list = userSubjects.map((s) => `• **${s.name}** (${s.topics.length} topics)`).join("\n");
    return {
      reply: `Here are your active learning subjects:\n${list}`,
    };
  }

  if (lower.includes("note") || lower.includes("knowledge")) {
    if (recentNotes.length === 0) {
      return {
        reply: "Your Knowledge Base is empty right now. You can capture notes or study insights at any time!",
      };
    }
    const list = recentNotes.map((n) => `• **${n.title}** (${n.category || "General"})`).join("\n");
    return {
      reply: `Here are recent entries in your Knowledge Base:\n${list}`,
    };
  }

  return {
    reply: `I'm tracking your **${pendingTasks.length} pending tasks**, **${activeProjects.length} active projects**, and **${formatKES(remainingBudget)}** remaining budget. I can create tasks, log KES expenses, add shopping items, or break down goals for you!`,
  };
}

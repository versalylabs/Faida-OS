import { prisma } from "@/lib/db";
import { formatKES } from "@/lib/utils";

export interface ToolActionPayload {
  type:
    | "TASK_CREATED"
    | "TASK_COMPLETED"
    | "FINANCE_LOGGED"
    | "SHOPPING_ADDED"
    | "NOTE_CREATED"
    | "GOAL_DECOMPOSED"
    | "SCHEDULE_REPLANNED"
    | "BRIEFING_DELIVERED"
    | "ENERGY_DISPATCH"
    | "CLASS_BRIEFING"
    | "ASSIGNMENT_DECOMPOSED";
  title: string;
  badge?: string;
  details?: string;
  link?: string;
}

// 1. Create Task Tool
export async function executeCreateTask(params: {
  userId: string;
  title: string;
  projectName?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  durationMinutes?: number;
}): Promise<{ message: string; action: ToolActionPayload }> {
  let projectId: string | undefined;

  if (params.projectName) {
    let proj = await prisma.project.findFirst({
      where: { userId: params.userId, name: { contains: params.projectName } },
    });
    if (!proj) {
      proj = await prisma.project.create({
        data: {
          userId: params.userId,
          name: params.projectName,
          description: `Auto-created workspace for ${params.projectName}`,
        },
      });
    }
    projectId = proj.id;
  }

  const entity = await prisma.entity.create({
    data: {
      userId: params.userId,
      type: "TASK",
      title: params.title.trim(),
      priority: params.priority || "MEDIUM",
      status: "ACTIVE",
    },
  });

  const task = await prisma.task.create({
    data: {
      userId: params.userId,
      entityId: entity.id,
      title: params.title.trim(),
      priority: params.priority || "MEDIUM",
      estimatedMinutes: params.durationMinutes || 30,
      projectId,
      status: "TODO",
    },
    include: { project: true },
  });

  await prisma.activityLog.create({
    data: {
      entityId: entity.id,
      action: "CREATED",
      details: `Faida AI created task: ${task.title}`,
    },
  });

  return {
    message: `I've created the task **"${task.title}"** (${task.priority} priority, ${task.estimatedMinutes}m${task.project ? ` under **${task.project.name}**` : ""}) and added it to your execution queue.`,
    action: {
      type: "TASK_CREATED",
      title: task.title,
      badge: `${task.priority} • ${task.estimatedMinutes}m`,
      details: task.project ? `Project: ${task.project.name}` : undefined,
      link: "/tasks",
    },
  };
}

// 2. Complete Task Tool
export async function executeCompleteTask(userId: string, taskTitleOrId: string): Promise<{ message: string; action: ToolActionPayload }> {
  const task = await prisma.task.findFirst({
    where: {
      userId,
      status: { not: "DONE" },
      OR: [
        { id: taskTitleOrId },
        { title: { contains: taskTitleOrId } },
      ],
    },
    include: { project: true },
  });

  if (!task) {
    return {
      message: `I couldn't find an active task matching "${taskTitleOrId}". Check your task list in /tasks.`,
      action: {
        type: "TASK_COMPLETED",
        title: "Task Not Found",
        badge: "Warning",
        link: "/tasks",
      },
    };
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: "DONE" },
  });

  if (task.entityId) {
    await prisma.entity.update({
      where: { id: task.entityId },
      data: { status: "COMPLETED" },
    }).catch(() => {});
  }

  await prisma.activityLog.create({
    data: {
      action: "COMPLETED",
      details: `Faida AI marked task complete: ${task.title}`,
    },
  });

  return {
    message: `Marked **"${task.title}"** as completed! Great progress. Your velocity and daily journal have been updated.`,
    action: {
      type: "TASK_COMPLETED",
      title: task.title,
      badge: "Completed ✓",
      details: task.project ? `Project: ${task.project.name}` : undefined,
      link: "/tasks",
    },
  };
}

// 3. Log Finance Tool (KES)
export async function executeLogFinance(params: {
  userId: string;
  description: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  category?: string;
}): Promise<{ message: string; action: ToolActionPayload }> {
  const finalAmount = params.type === "EXPENSE" ? -Math.abs(params.amount) : Math.abs(params.amount);

  await prisma.financeTransaction.create({
    data: {
      userId: params.userId,
      description: params.description.trim(),
      amount: finalAmount,
      type: params.type,
      category: params.category || "General",
    },
  });

  const allTxs = await prisma.financeTransaction.findMany({
    where: { userId: params.userId },
  });
  let totalExpenses = 0;
  allTxs.forEach((t) => {
    if (t.amount < 0) totalExpenses += Math.abs(t.amount);
  });
  const remainingBudget = 310000 - totalExpenses;

  await prisma.activityLog.create({
    data: {
      action: "FINANCE_LOGGED",
      details: `Faida AI recorded ${params.type}: ${params.description} (${formatKES(params.amount)})`,
    },
  });

  return {
    message: `Recorded ${params.type === "EXPENSE" ? "expense" : "income"} of **${formatKES(params.amount)}** for **"${params.description}"** (${params.category || "General"}). Your remaining monthly budget is now **${formatKES(remainingBudget)}**.`,
    action: {
      type: "FINANCE_LOGGED",
      title: `${params.description}`,
      badge: `${params.type === "EXPENSE" ? "-" : "+"}${formatKES(params.amount)}`,
      details: `Remaining: ${formatKES(remainingBudget)}`,
      link: "/finance",
    },
  };
}

// 4. Add Shopping Items Tool
export async function executeAddShopping(params: {
  userId: string;
  items: string[];
  preferredStore?: string;
  category?: string;
}): Promise<{ message: string; action: ToolActionPayload }> {
  const createdNames: string[] = [];

  for (const item of params.items) {
    if (item.trim()) {
      await prisma.shoppingItem.create({
        data: {
          userId: params.userId,
          name: item.trim(),
          category: params.category || "Groceries",
          preferredStore: params.preferredStore || "Supermarket",
        },
      });
      createdNames.push(item.trim());
    }
  }

  return {
    message: `Added **${createdNames.join(", ")}** to your shopping list${params.preferredStore ? ` from **${params.preferredStore}**` : ""}.`,
    action: {
      type: "SHOPPING_ADDED",
      title: createdNames.join(", "),
      badge: `${createdNames.length} items added`,
      details: params.preferredStore ? `Store: ${params.preferredStore}` : undefined,
      link: "/shopping",
    },
  };
}

// 5. Decompose Large Goal Tool
export async function executeDecomposeGoal(userId: string, goal: string, projectName?: string): Promise<{ message: string; action: ToolActionPayload }> {
  const projName = projectName || "Project";

  let project = await prisma.project.findFirst({
    where: { userId, name: { contains: projName } },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        userId,
        name: projName,
        description: `Project for: ${goal}`,
      },
    });
  }

  const subtasks = [
    { title: `Audit requirements & architecture for ${goal}`, duration: 25, priority: "HIGH" as const },
    { title: `Implement core logic & validation for ${goal}`, duration: 45, priority: "HIGH" as const },
    { title: `Write automated tests & error handling for ${goal}`, duration: 30, priority: "MEDIUM" as const },
    { title: `Deploy & verify staging environment for ${goal}`, duration: 20, priority: "MEDIUM" as const },
  ];

  for (const s of subtasks) {
    await prisma.task.create({
      data: {
        userId,
        title: s.title,
        estimatedMinutes: s.duration,
        priority: s.priority,
        projectId: project.id,
        status: "TODO",
      },
    });
  }

  return {
    message: `I've broken down **"${goal}"** into 4 executable steps and assigned them to project **${project.name}**:\n\n1. **Audit requirements & architecture** (25m • High)\n2. **Implement core logic & validation** (45m • High)\n3. **Write automated tests** (30m • Med)\n4. **Deploy & verify staging** (20m • Med)\n\nTotal time: 2 hours. All tasks are ready in your execution queue.`,
    action: {
      type: "GOAL_DECOMPOSED",
      title: goal,
      badge: "4 Tasks Generated",
      details: `Project: ${project.name} (120 mins)`,
      link: `/projects/${project.id}`,
    },
  };
}

// 6. Morning Briefing Tool (Enhanced with Academic Context)
export async function executeMorningBriefing(userId: string): Promise<{ message: string; action: ToolActionPayload }> {
  const now = new Date();
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

  const [tasks, allTxs, todayClasses, upcomingAssignments, upcomingAssessments] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { not: "DONE" } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { project: true, course: true },
      take: 4,
    }),
    prisma.financeTransaction.findMany({
      where: { userId },
    }),
    prisma.academicClass.findMany({
      where: { userId, dayOfWeek: currentDayOfWeek },
      include: { course: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: { userId, isAcademic: true, status: { not: "DONE" } },
      include: { course: true },
      orderBy: { dueDate: "asc" },
      take: 2,
    }),
    prisma.academicAssessment.findMany({
      where: { userId, isCompleted: false },
      include: { course: true },
      orderBy: { date: "asc" },
      take: 1,
    }),
  ]);

  let totalSpent = 0;
  allTxs.forEach((t) => {
    if (t.amount < 0) totalSpent += Math.abs(t.amount);
  });
  const remainingBudget = 310000 - totalSpent;

  const topTask = tasks[0];
  const topTaskText = topTask
    ? `• **Top Focus:** "${topTask.title}" (${topTask.priority} • ${topTask.estimatedMinutes}m${topTask.course ? ` in ${topTask.course.code}` : topTask.project ? ` in ${topTask.project.name}` : ""})`
    : "• **Top Focus:** Queue is clear!";

  // Academic Section in Briefing
  let academicSnippet = "";
  if (todayClasses.length > 0 || upcomingAssignments.length > 0 || upcomingAssessments.length > 0) {
    const classList = todayClasses.length > 0
      ? `\n  - Classes today (${todayClasses.length}): ${todayClasses.map((c) => `${c.course.code} at ${c.startTime} (${c.location || "Online"})`).join(", ")}`
      : "";
    const assignList = upcomingAssignments.length > 0
      ? `\n  - Urgent assignment: "${upcomingAssignments[0].title}" (${upcomingAssignments[0].course?.code || "Academic"})`
      : "";
    const catList = upcomingAssessments.length > 0
      ? `\n  - Approaching CAT: "${upcomingAssessments[0].title}" on ${upcomingAssessments[0].date.toLocaleDateString()}`
      : "";
    academicSnippet = `\n• **🎓 University Orbit:**${classList}${assignList}${catList}`;
  }

  const briefing = `🌅 **Good morning! Here is your daily mission briefing:**

${topTaskText}
• **Queue:** ${tasks.length} active tasks queued up today (~${tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0)}m focus time required).${academicSnippet}
• **Finance:** ${formatKES(remainingBudget)} remaining in your monthly budget.
• **Energy:** You're in your morning peak window (🔋 85%). I recommend tackling the top priority task first before switching to lighter administrative work.`;

  return {
    message: briefing,
    action: {
      type: "BRIEFING_DELIVERED",
      title: "Daily Mission Briefing",
      badge: "🔋 85% Morning Peak",
      details: todayClasses.length > 0 ? `${todayClasses.length} classes scheduled today` : undefined,
      link: "/university",
    },
  };
}

// 7. Low-Energy Dispatch Tool
export async function executeEnergyDispatch(userId: string, minutes: number = 20): Promise<{ message: string; action: ToolActionPayload }> {
  const quickTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { not: "DONE" },
      estimatedMinutes: { lte: 20 },
    },
    include: { course: true },
    take: 3,
  });

  if (quickTasks.length === 0) {
    return {
      message: `You're feeling low on energy. You don't have any pending micro-tasks, so feel free to take a break or step away. I've switched your focus to Energy Conservation Mode.`,
      action: {
        type: "ENERGY_DISPATCH",
        title: "Energy Conservation Active",
        badge: "Rest Recommended",
        link: "/lazy",
      },
    };
  }

  const totalMins = quickTasks.reduce((s, t) => s + (t.estimatedMinutes || 10), 0);
  const taskList = quickTasks.map((t) => `• **${t.title}** (${t.course ? `${t.course.code} • ` : ""}${t.estimatedMinutes}m)`).join("\n");

  return {
    message: `Don't strain yourself. I've pulled a **Low-Energy Batch** of ${quickTasks.length} micro-tasks that you can finish in ~${totalMins} minutes without heavy thinking:\n\n${taskList}\n\nYou can knock them out or click below to view the batch in Lazy Mode.`,
    action: {
      type: "ENERGY_DISPATCH",
      title: `Low-Energy Batch (~${totalMins}m)`,
      badge: "⚡ Low Friction",
      details: `${quickTasks.length} tasks ready`,
      link: "/lazy",
    },
  };
}

// 8. Class Briefing Tool ("Prepare Me")
export async function executeClassBriefing(userId: string, courseCodeOrName?: string): Promise<{ message: string; action: ToolActionPayload }> {
  const whereCourse: any = { userId, status: "ACTIVE" };
  if (courseCodeOrName) {
    whereCourse.OR = [
      { code: { contains: courseCodeOrName } },
      { name: { contains: courseCodeOrName } },
    ];
  }

  const course = await prisma.universityCourse.findFirst({
    where: whereCourse,
    include: {
      materials: { orderBy: { weekNumber: "desc" }, take: 1 },
      assignments: { where: { status: { not: "DONE" } }, take: 1 },
      assessments: { where: { isCompleted: false }, orderBy: { date: "asc" }, take: 1 },
      notes: { orderBy: { updatedAt: "desc" }, take: 2 },
    },
  });

  if (!course) {
    return {
      message: `I couldn't find any active course matching "${courseCodeOrName || "upcoming class"}". Check your courses in the Academic Command Center.`,
      action: {
        type: "CLASS_BRIEFING",
        title: "Course Not Found",
        link: "/university",
      },
    };
  }

  const lastTopic = course.materials[0]?.title || course.notes[0]?.title || "Fundamental Concepts";
  const openAssign = course.assignments[0];
  const upcomingCAT = course.assessments[0];

  const briefing = `🎓 **${course.code} (${course.name}) — CLASS BRIEFING**

• **Lecturer:** ${course.lecturer || "Instructor"}
• **Last Topic Covered:** ${lastTopic}
• **Current Coursework:** ${openAssign ? `"${openAssign.title}" (${openAssign.estimatedMinutes || 120}m estimated)` : "No pending assignments."}
• **Upcoming Assessment:** ${upcomingCAT ? `${upcomingCAT.title} on ${upcomingCAT.date.toLocaleDateString()}` : "No approaching CATs."}
• **Recommended 15-min Prep:** Review ${lastTopic} summary and prepare 1 question on edge cases before class starts.`;

  return {
    message: briefing,
    action: {
      type: "CLASS_BRIEFING",
      title: `Briefing: ${course.code}`,
      badge: "⚡ 15m Prep Ready",
      details: course.name,
      link: `/university?courseId=${course.id}`,
    },
  };
}

// 9. Assignment Decomposer Tool
export async function executeDecomposeAssignment(userId: string, assignmentTitle: string): Promise<{ message: string; action: ToolActionPayload }> {
  const task = await prisma.task.findFirst({
    where: {
      userId,
      isAcademic: true,
      title: { contains: assignmentTitle },
    },
    include: { course: true, subtasks: true },
  });

  if (!task) {
    return {
      message: `I couldn't find an academic assignment matching "${assignmentTitle}". Please specify the exact title.`,
      action: {
        type: "GOAL_DECOMPOSED",
        title: "Assignment Not Found",
        link: "/university",
      },
    };
  }

  // Generate 5 conservative subtasks
  const subtaskTitles = [
    `1. Read assignment requirements & rubrics (${task.course?.code || "Course"}) — 20m`,
    `2. Research key concepts & architectural approaches — 45m`,
    `3. Draft solution & write core algorithms / implementation — 60m`,
    `4. Test edge cases & verify against assignment specs — 30m`,
    `5. Format documentation & prepare Moodle submission archive — 25m`,
  ];

  for (const st of subtaskTitles) {
    await prisma.subtask.create({
      data: {
        taskId: task.id,
        title: st,
      },
    });
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      estimatedMinutes: 180,
    },
  });

  return {
    message: `I've broken down **"${task.title}"** into 5 conservative, manageable steps totaling 3 hours:\n\n${subtaskTitles.map((t) => `• ${t}`).join("\n")}\n\nEach step is logged under the assignment so you can tackle them in low-friction sprints.`,
    action: {
      type: "ASSIGNMENT_DECOMPOSED",
      title: task.title,
      badge: "5 Steps Generated",
      details: `${task.course?.code || "Academic"} • 3h total`,
      link: "/university",
    },
  };
}

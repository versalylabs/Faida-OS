import { prisma } from "@/lib/db";

type FinishedTask = {
  userId: string | null;
  title: string;
  description: string | null;
  priority: string;
  estimatedMinutes: number;
  dueDate: Date | null;
  projectId: string | null;
  category: string | null;
  recurrence: string | null;
  isAcademic: boolean;
  courseId: string | null;
};

/**
 * When a repeating task is finished, line up the next one so recurring chores never have to be re-created.
 * The next due date is measured from the old due date (or from now if that is long past), and is never in the past.
 */
export async function spawnNextRecurrence(task: FinishedTask): Promise<void> {
  if (!task.recurrence || !task.userId) return;

  const base = task.dueDate && task.dueDate.getTime() > Date.now() - 30 * 86400000 ? new Date(task.dueDate) : new Date();
  const next = new Date(base);
  switch (task.recurrence) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKDAYS":
      do {
        next.setDate(next.getDate() + 1);
      } while ([0, 6].includes(next.getDay()));
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return;
  }
  while (next.getTime() < Date.now() - 3600000) next.setDate(next.getDate() + 1);

  const entity = await prisma.entity.create({
    data: { userId: task.userId, type: "TASK", title: task.title, content: task.description, priority: task.priority, status: "ACTIVE" },
  });
  await prisma.task.create({
    data: {
      userId: task.userId,
      entityId: entity.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: "TODO",
      estimatedMinutes: task.estimatedMinutes,
      dueDate: next,
      projectId: task.projectId,
      category: task.category,
      recurrence: task.recurrence,
      isAcademic: task.isAcademic,
      courseId: task.courseId,
    },
  });
}

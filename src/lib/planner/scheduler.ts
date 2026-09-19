export interface SchedulableTask {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedMinutes: number;
  actualMinutes?: number;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BACKLOG";
  projectName?: string | null;
  scheduledTime?: string | null; // e.g. "09:00 - 10:30"
}

export interface ScheduleSlot {
  id: string;
  taskId: string;
  title: string;
  projectName?: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  durationMinutes: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isBreak: boolean;
  status: "PENDING" | "CURRENT" | "DONE";
}

export interface DailyScheduleResult {
  date: string;
  slots: ScheduleSlot[];
  totalAllocatedMinutes: number;
  totalBufferMinutes: number;
  availableMinutes: number;
  overflowTasks: SchedulableTask[];
}

function padZero(num: number): string {
  return num.toString().padStart(2, "0");
}

function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${padZero(hours)}:${padZero(minutes)}`;
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Constructs a daily schedule from prioritized tasks within a focus time budget.
 */
export function buildDailySchedule(
  tasks: SchedulableTask[],
  options: {
    startHour?: number;       // default 9 (09:00)
    startMinute?: number;     // default 0
    availableMinutes: number; // e.g., 270 (4h 30m)
    bufferMinutes?: number;   // default 15
  }
): DailyScheduleResult {
  const {
    startHour = 9,
    startMinute = 0,
    availableMinutes,
    bufferMinutes = 15,
  } = options;

  // Filter out completed tasks and sort by Priority descending
  const pendingTasks = tasks
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.priority] || 1;
      const weightB = PRIORITY_WEIGHTS[b.priority] || 1;
      return weightB - weightA;
    });

  let currentMinute = startHour * 60 + startMinute;
  let remainingBudget = availableMinutes;
  const slots: ScheduleSlot[] = [];
  const overflowTasks: SchedulableTask[] = [];
  let totalAllocatedMinutes = 0;
  let totalBufferMinutes = 0;

  for (let i = 0; i < pendingTasks.length; i++) {
    const task = pendingTasks[i];
    const duration = task.estimatedMinutes || 30;

    // Check if task fits in budget
    if (duration <= remainingBudget) {
      const slotStart = minutesToTimeString(currentMinute);
      const slotEnd = minutesToTimeString(currentMinute + duration);

      slots.push({
        id: `slot-${task.id}`,
        taskId: task.id,
        title: task.title,
        projectName: task.projectName || undefined,
        startTime: slotStart,
        endTime: slotEnd,
        durationMinutes: duration,
        priority: task.priority,
        isBreak: false,
        status: slots.length === 0 ? "CURRENT" : "PENDING",
      });

      currentMinute += duration;
      remainingBudget -= duration;
      totalAllocatedMinutes += duration;

      // Add buffer break if there's remaining budget for subsequent tasks
      if (i < pendingTasks.length - 1 && remainingBudget >= bufferMinutes) {
        const breakStart = minutesToTimeString(currentMinute);
        const breakEnd = minutesToTimeString(currentMinute + bufferMinutes);

        slots.push({
          id: `break-${i}`,
          taskId: "break",
          title: "Cognitive Reset / Buffer",
          startTime: breakStart,
          endTime: breakEnd,
          durationMinutes: bufferMinutes,
          priority: "LOW",
          isBreak: true,
          status: "PENDING",
        });

        currentMinute += bufferMinutes;
        remainingBudget -= bufferMinutes;
        totalBufferMinutes += bufferMinutes;
      }
    } else {
      overflowTasks.push(task);
    }
  }

  return {
    date: new Date().toISOString().split("T")[0],
    slots,
    totalAllocatedMinutes,
    totalBufferMinutes,
    availableMinutes,
    overflowTasks,
  };
}

/**
 * Dynamically shifts the remaining uncompleted schedule when a task overruns or takes longer.
 */
export function replanRemainingSchedule(
  currentSlots: ScheduleSlot[],
  completedSlotId?: string,
  actualMinutesSpent?: number
): ScheduleSlot[] {
  if (currentSlots.length === 0) return [];

  const now = new Date();
  let currentMinute = now.getHours() * 60 + now.getMinutes();

  // Round up to nearest 5 minutes
  currentMinute = Math.ceil(currentMinute / 5) * 5;

  return currentSlots.map((slot) => {
    // If it's already done or is the one being marked done
    if (slot.id === completedSlotId) {
      return {
        ...slot,
        status: "DONE",
      };
    }

    if (slot.status === "DONE") {
      return slot;
    }

    // Shift future pending slots forward starting from current time
    const start = minutesToTimeString(currentMinute);
    const end = minutesToTimeString(currentMinute + slot.durationMinutes);
    currentMinute += slot.durationMinutes;

    return {
      ...slot,
      startTime: start,
      endTime: end,
      status: "PENDING",
    };
  });
}

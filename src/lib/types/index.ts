export type EntityType =
  | "TASK"
  | "PROJECT"
  | "NOTE"
  | "REMINDER"
  | "EVENT"
  | "LEARNING"
  | "FINANCE"
  | "SHOPPING"
  | "MAINTENANCE";

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

export interface UniversalCapturePayload {
  rawText: string;
  inferredType: EntityType;
  title: string;
  details?: string;
  priority?: PriorityLevel;
  dueDate?: string | null;
  estimatedMinutes?: number;
  projectHint?: string;
  category?: string;
  tags?: string[];
  amount?: number;
  shoppingStore?: string;
}

export interface DailyScheduleSlot {
  id: string;
  taskId?: string;
  title: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  durationMinutes: number;
  isCompleted: boolean;
  priority: PriorityLevel;
  category?: string;
}

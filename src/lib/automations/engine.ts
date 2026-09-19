export interface AutomationRuleDef {
  id: string;
  name: string;
  trigger: string;
  description: string;
  action: string;
  isActive: boolean;
  timesTriggered: number;
}

export const DEFAULT_AUTOMATIONS: AutomationRuleDef[] = [
  {
    id: "rule-1",
    name: "Auto-Publish Study Notes to Knowledge Base",
    trigger: "STUDY_SESSION_LOGGED",
    description: "When a study session includes notes, automatically publish them to the connected Knowledge Base under the subject's category.",
    action: "CREATE_KNOWLEDGE_NOTE",
    isActive: true,
    timesTriggered: 14,
  },
  {
    id: "rule-2",
    name: "Escalate Overdue Reminders to Urgent Attention",
    trigger: "REMINDER_OVERDUE",
    description: "When a reminder passes its due date without completion, escalate state to OVERDUE and increment top header urgent badge.",
    action: "ESCALATE_ATTENTION",
    isActive: true,
    timesTriggered: 9,
  },
  {
    id: "rule-3",
    name: "Recurring Maintenance Interval Reset",
    trigger: "MAINTENANCE_COMPLETED",
    description: "When a hygiene task is checked off, advance the next due date by its cadence interval automatically.",
    action: "RESET_CADENCE_TIMER",
    isActive: true,
    timesTriggered: 22,
  },
  {
    id: "rule-4",
    name: "Auto-Construct Daily Work Journal",
    trigger: "DAILY_MIDNIGHT_CRON",
    description: "At the end of each day, compile completed tasks, logged study hours, and project updates into a daily work retrospective.",
    action: "GENERATE_JOURNAL_ENTRY",
    isActive: true,
    timesTriggered: 31,
  },
  {
    id: "rule-5",
    name: "Budget Capacity Alert (KES)",
    trigger: "FINANCE_EXPENSE_LOGGED",
    description: "When monthly expenses exceed 80% of the KES 310,000 budget, trigger an informational budget warning.",
    action: "ALERT_FINANCIAL_THRESHOLD",
    isActive: true,
    timesTriggered: 3,
  },
];

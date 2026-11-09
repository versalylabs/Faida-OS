/**
 * Starting points for a new project: a description and a list of milestones to adjust afterwards.
 * Kept in code (not the database) so every account has them with nothing to set up.
 */

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  milestones: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "software",
    label: "Software build",
    description: "Design, build, test and ship a software product.",
    milestones: ["Requirements and scope", "Design and data model", "Core development", "Testing and fixes", "Deployment", "Handover and documentation"],
  },
  {
    id: "client",
    label: "Client project",
    description: "Deliver a piece of work for a client from kickoff to sign-off.",
    milestones: ["Kickoff and brief", "First draft or proposal", "Client feedback", "Revisions", "Final delivery", "Invoice and follow-up"],
  },
  {
    id: "marketing",
    label: "Marketing campaign",
    description: "Plan, launch and review a marketing campaign.",
    milestones: ["Goals and audience", "Content plan", "Create assets", "Launch", "Review results"],
  },
  {
    id: "assignment",
    label: "Study or research",
    description: "Work through a research task or big assignment in stages.",
    milestones: ["Understand the brief", "Research and notes", "First draft", "Review and edit", "Submit"],
  },
  {
    id: "event",
    label: "Event",
    description: "Organise an event from planning to wrap-up.",
    milestones: ["Plan and budget", "Book venue and suppliers", "Promote", "Final preparations", "Event day", "Wrap-up and thank-yous"],
  },
];

/**
 * Spreads milestone due dates evenly from today up to the target date, the last one landing on it.
 * Returns YYYY-MM-DD strings (plain dates, like the rest of the due dates), or nulls when there is no
 * usable future target date.
 */
export function spreadDueDates(count: number, targetDate: string, today: Date = new Date()): (string | null)[] {
  const target = Date.parse(targetDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (count <= 0 || Number.isNaN(target) || target <= startMs) return Array(Math.max(count, 0)).fill(null);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startMs + ((target - startMs) * (i + 1)) / count);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  });
}

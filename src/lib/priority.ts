/**
 * Task priority order. Sorting the priority column in the database is alphabetical, which puts
 * HIGH below MEDIUM and LOW ("URGENT" > "MEDIUM" > "LOW" > "HIGH" when descending). Rank it here instead.
 */
const RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function priorityRank(priority: string | null | undefined): number {
  return RANK[(priority || "MEDIUM").toUpperCase()] ?? 2;
}

/** Comparator: most important first, then newest first. */
export function byPriorityThenNewest<T extends { priority?: string | null; createdAt?: Date | string | null }>(a: T, b: T): number {
  const diff = priorityRank(a.priority) - priorityRank(b.priority);
  if (diff !== 0) return diff;
  return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
}

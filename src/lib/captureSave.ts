import { prisma } from "@/lib/db";
import { createEntry, defaultAccountId, deleteEntry } from "@/lib/ledger";
import type { ParsedEntityResult } from "@/lib/ai/classifier";

/**
 * Saves one classified capture where it belongs (task, reminder, event, shopping, note, money) and says exactly
 * what was created, so the Capture screen can offer Undo for it.
 */

export type UndoKind = "task" | "reminder" | "event" | "shopping" | "note" | "finance" | "none";

export interface UndoRef {
  kind: UndoKind;
  ids: string[];
  entityId: string;
}

export interface SavedCapture {
  type: ParsedEntityResult["type"];
  title: string;
  when: string | null;
  amount: number | null;
  note: string | null; // e.g. why nothing was added to the ledger
  undo: UndoRef;
}

export async function saveCapture(userId: string, input: string, parsed: ParsedEntityResult): Promise<SavedCapture> {
  const entity = await prisma.entity.create({
    data: {
      userId,
      type: parsed.type,
      title: parsed.title,
      content: parsed.details || input,
      status: "ACTIVE",
      priority: parsed.priority || "MEDIUM",
      metadata: JSON.stringify(parsed),
    },
  });

  let kind: UndoKind = "none";
  let ids: string[] = [];
  let when: string | null = null;
  let note: string | null = null;

  if (parsed.type === "TASK") {
    let projectId: string | undefined;
    // Link to a project only when one with that name exists (never create projects from a guess)
    if (parsed.projectHint) {
      const proj = await prisma.project.findFirst({ where: { userId, name: { contains: parsed.projectHint, mode: "insensitive" } } });
      projectId = proj?.id;
    }
    const task = await prisma.task.create({
      data: {
        userId,
        entityId: entity.id,
        title: parsed.title,
        description: parsed.details,
        priority: parsed.priority || "MEDIUM",
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        estimatedMinutes: parsed.estimatedMinutes || 30,
        projectId,
      },
    });
    kind = "task";
    ids = [task.id];
    when = task.dueDate?.toISOString() ?? null;
  } else if (parsed.type === "REMINDER") {
    const reminder = await prisma.reminder.create({
      data: {
        userId,
        entityId: entity.id,
        title: parsed.title,
        description: parsed.details,
        dueAt: parsed.dueDate ? new Date(parsed.dueDate) : new Date(Date.now() + 86400000),
        escalationState: "UPCOMING",
      },
    });
    kind = "reminder";
    ids = [reminder.id];
    when = reminder.dueAt.toISOString();
  } else if (parsed.type === "EVENT") {
    const start = parsed.startTime ? new Date(parsed.startTime) : new Date(Date.now() + 3600000);
    const end = parsed.endTime ? new Date(parsed.endTime) : new Date(start.getTime() + 3600000);
    const event = await prisma.calendarEvent.create({
      data: { userId, title: parsed.title, description: parsed.details, startTime: start, endTime: end },
    });
    kind = "event";
    ids = [event.id];
    when = start.toISOString();
  } else if (parsed.type === "SHOPPING") {
    const items = parsed.shoppingItems && parsed.shoppingItems.length > 0 ? parsed.shoppingItems : [parsed.title];
    for (const name of items.slice(0, 30)) {
      const item = await prisma.shoppingItem.create({
        data: { userId, name, category: parsed.category || "General", estimatedPrice: parsed.amount || null },
      });
      ids.push(item.id);
    }
    kind = "shopping";
  } else if (parsed.type === "NOTE" || parsed.type === "KNOWLEDGE") {
    const n = await prisma.note.create({
      data: {
        userId,
        entityId: entity.id,
        title: parsed.title,
        content: parsed.details || input,
        category: parsed.category || "General",
        tags: parsed.tags ? parsed.tags.join(", ") : undefined,
      },
    });
    kind = "note";
    ids = [n.id];
  } else if (parsed.type === "FINANCE") {
    // An amount is needed to record money; without one nothing is added to the ledger
    if (parsed.amount && Math.abs(parsed.amount) > 0) {
      const income = parsed.transactionType === "INCOME";
      const tx = await createEntry({
        userId,
        description: parsed.title,
        amount: income ? Math.abs(parsed.amount) : -Math.abs(parsed.amount),
        type: income ? "INCOME" : "EXPENSE",
        category: parsed.category || "General",
        accountId: await defaultAccountId(userId),
      });
      kind = "finance";
      ids = [tx.id];
    } else {
      note = "No amount found, so nothing was added to Finance";
    }
  }

  await prisma.activityLog.create({
    data: { entityId: entity.id, action: "CAPTURED", details: `Universal capture [${parsed.type}]: ${parsed.title}` },
  });

  return {
    type: parsed.type,
    title: parsed.title,
    when,
    amount: parsed.type === "FINANCE" && parsed.amount ? Math.abs(parsed.amount) : null,
    note,
    undo: { kind, ids, entityId: entity.id },
  };
}

/** Takes one capture back out: the record it created (money also leaves the balance) and its entry in the feed. */
export async function undoCapture(userId: string, ref: UndoRef): Promise<boolean> {
  const ids = ref.ids.slice(0, 30);
  switch (ref.kind) {
    case "task":
      await prisma.task.deleteMany({ where: { userId, id: { in: ids } } });
      break;
    case "reminder":
      await prisma.reminder.deleteMany({ where: { userId, id: { in: ids } } });
      break;
    case "event":
      await prisma.calendarEvent.deleteMany({ where: { userId, id: { in: ids } } });
      break;
    case "shopping":
      await prisma.shoppingItem.deleteMany({ where: { userId, id: { in: ids } } });
      break;
    case "note":
      await prisma.note.deleteMany({ where: { userId, id: { in: ids } } });
      break;
    case "finance":
      for (const id of ids) {
        const tx = await prisma.financeTransaction.findFirst({ where: { userId, id }, select: { id: true } });
        if (tx) await deleteEntry(userId, tx.id);
      }
      break;
  }
  await prisma.entity.deleteMany({ where: { userId, id: ref.entityId } });
  return true;
}

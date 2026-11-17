import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

/**
 * The one place money is recorded. Every transaction that names an account moves that account's balance in the
 * same database transaction (income adds, an expense subtracts), so balances and the ledger can never disagree.
 *
 * Amounts are signed: income is positive, an expense negative. A transfer is two rows (out of one account, into
 * the other) sharing a transferGroup, with type TRANSFER, so it moves money without counting as income or spending.
 */

export const TRANSFER = "TRANSFER";

type Db = Prisma.TransactionClient;

export interface EntryInput {
  userId: string;
  description: string;
  amount: number; // signed
  type: "INCOME" | "EXPENSE";
  category: string;
  date?: Date;
  isRecurring?: boolean;
  businessId?: string | null;
  clientId?: string | null;
  accountId?: string | null;
}

export class LedgerError extends Error {}

/** The account to use when the caller did not choose one (quick capture, Faida AI): the user's default, if any. */
export async function defaultAccountId(userId: string): Promise<string | null> {
  const a = await prisma.financeAccount.findFirst({ where: { userId, isDefault: true }, select: { id: true } });
  return a?.id ?? null;
}

async function ownedAccount(db: Db, userId: string, id: string) {
  const acc = await db.financeAccount.findFirst({ where: { id, userId }, select: { id: true, name: true } });
  if (!acc) throw new LedgerError("Account not found");
  return acc;
}

/** Records income or an expense and moves the account balance with it. */
export async function createEntry(input: EntryInput) {
  return prisma.$transaction(async (db) => {
    if (input.accountId) await ownedAccount(db, input.userId, input.accountId);
    const tx = await db.financeTransaction.create({
      data: {
        userId: input.userId,
        description: input.description,
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: input.date ?? new Date(),
        isRecurring: input.isRecurring === true,
        businessId: input.businessId ?? null,
        clientId: input.clientId ?? null,
        accountId: input.accountId ?? null,
      },
    });
    if (input.accountId) {
      await db.financeAccount.update({ where: { id: input.accountId }, data: { balance: { increment: input.amount } } });
    }
    return tx;
  });
}

export interface EntryPatch {
  description?: string;
  amount?: number; // signed, already matching the type
  type?: "INCOME" | "EXPENSE";
  category?: string;
  date?: Date;
  isRecurring?: boolean;
  accountId?: string | null; // undefined = unchanged
  clientId?: string | null;
  /**
   * For a transaction that had no account: assigning one normally just labels it (the balance you typed already
   * includes that money). Pass true to also add it to the balance.
   */
  applyToBalance?: boolean;
}

/** Edits a transaction and fixes the balances: the old effect is undone and the new one applied. */
export async function updateEntry(userId: string, id: string, patch: EntryPatch) {
  return prisma.$transaction(async (db) => {
    const existing = await db.financeTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new LedgerError("Transaction not found");
    if (existing.type === TRANSFER) throw new LedgerError("A transfer cannot be edited. Delete it and record it again.");

    const nextAccountId = patch.accountId === undefined ? existing.accountId : patch.accountId;
    if (nextAccountId && nextAccountId !== existing.accountId) await ownedAccount(db, userId, nextAccountId);
    const nextAmount = patch.amount ?? existing.amount;

    // 1. undo what the old row did to its account
    if (existing.accountId) {
      await db.financeAccount.update({ where: { id: existing.accountId }, data: { balance: { increment: -existing.amount } } });
    }
    // 2. apply the new row to its account (a previously unassigned row only touches the balance when asked to)
    if (nextAccountId && (existing.accountId || patch.applyToBalance)) {
      await db.financeAccount.update({ where: { id: nextAccountId }, data: { balance: { increment: nextAmount } } });
    }

    return db.financeTransaction.update({
      where: { id },
      data: {
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.amount !== undefined && { amount: patch.amount }),
        ...(patch.type !== undefined && { type: patch.type }),
        ...(patch.category !== undefined && { category: patch.category }),
        ...(patch.date !== undefined && { date: patch.date }),
        ...(patch.isRecurring !== undefined && { isRecurring: patch.isRecurring }),
        ...(patch.clientId !== undefined && { clientId: patch.clientId }),
        accountId: nextAccountId ?? null,
      },
    });
  });
}

/** Deletes a transaction (both halves of a transfer) and takes its effect back out of the balances. */
export async function deleteEntry(userId: string, id: string): Promise<number> {
  return prisma.$transaction(async (db) => {
    const existing = await db.financeTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new LedgerError("Transaction not found");
    const rows = existing.transferGroup
      ? await db.financeTransaction.findMany({ where: { userId, transferGroup: existing.transferGroup } })
      : [existing];
    for (const r of rows) {
      if (r.accountId) await db.financeAccount.update({ where: { id: r.accountId }, data: { balance: { increment: -r.amount } } });
    }
    await db.financeTransaction.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, userId } });
    return rows.length;
  });
}

/** Moves money between two of the user's accounts. It is not income and not spending. */
export async function createTransfer(input: { userId: string; fromId: string; toId: string; amount: number; date?: Date; note?: string | null }) {
  if (input.fromId === input.toId) throw new LedgerError("Choose two different accounts");
  if (!(input.amount > 0)) throw new LedgerError("The amount must be more than 0");
  return prisma.$transaction(async (db) => {
    const from = await ownedAccount(db, input.userId, input.fromId);
    const to = await ownedAccount(db, input.userId, input.toId);
    const group = randomUUID();
    const when = input.date ?? new Date();
    const note = input.note ? `: ${input.note}` : "";
    await db.financeTransaction.createMany({
      data: [
        { userId: input.userId, description: `Transfer to ${to.name}${note}`, amount: -input.amount, type: TRANSFER, category: "Transfer", date: when, accountId: from.id, transferGroup: group },
        { userId: input.userId, description: `Transfer from ${from.name}${note}`, amount: input.amount, type: TRANSFER, category: "Transfer", date: when, accountId: to.id, transferGroup: group },
      ],
    });
    await db.financeAccount.update({ where: { id: from.id }, data: { balance: { increment: -input.amount } } });
    await db.financeAccount.update({ where: { id: to.id }, data: { balance: { increment: input.amount } } });
    return { group, from: from.name, to: to.name };
  });
}

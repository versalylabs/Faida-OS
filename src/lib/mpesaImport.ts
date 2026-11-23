import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createEntry, createTransfer } from "@/lib/ledger";
import { defaultCategory, describe, merchantKey, parseMpesa, type MpesaMessage } from "@/lib/mpesa";

/**
 * M-Pesa auto-import: the phone forwards each M-Pesa SMS to /api/ingest/mpesa with a private key, and it is
 * logged straight away (marked "to check"), filed by merchant memory, and never twice.
 */

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function newKey(): string {
  return `fk_${randomBytes(24).toString("base64url")}`;
}

/** The user a key belongs to (and marks it used), or null. */
export async function userForKey(key: string): Promise<string | null> {
  if (!/^fk_[A-Za-z0-9_-]{32}$/.test(key)) return null;
  const row = await prisma.ingestKey.findUnique({ where: { keyHash: hashKey(key) } });
  if (!row) return null;
  await prisma.ingestKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return row.userId;
}

/** The account M-Pesa money moves: one named like "M-Pesa", else your default account, else none. */
async function mpesaAccountId(userId: string): Promise<string | null> {
  const accounts = await prisma.financeAccount.findMany({ where: { userId }, select: { id: true, name: true, isDefault: true } });
  return (accounts.find((a) => /m-?pesa/i.test(a.name)) ?? accounts.find((a) => a.isDefault))?.id ?? null;
}

async function cashAccountId(userId: string): Promise<string | null> {
  const a = await prisma.financeAccount.findFirst({ where: { userId, name: { contains: "cash", mode: "insensitive" } }, select: { id: true } });
  return a?.id ?? null;
}

export type ImportResult =
  | { status: "logged"; description: string; amount: number; category: string; remembered: boolean }
  | { status: "duplicate"; code: string }
  | { status: "ignored"; reason: string };

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function importMpesa(userId: string, text: string): Promise<ImportResult> {
  const msg: MpesaMessage | null = parseMpesa(text);
  if (!msg) return { status: "ignored", reason: "Not an M-Pesa confirmation Faida can read" };
  if (!(msg.amount > 0)) return { status: "ignored", reason: "No amount in the message" };

  const already = await prisma.financeTransaction.findFirst({ where: { userId, externalRef: msg.code }, select: { id: true } });
  if (already) return { status: "duplicate", code: msg.code };

  const date = msg.date && Math.abs(msg.date.getTime() - Date.now()) < 7 * 86400000 ? msg.date : new Date();
  const accountId = await mpesaAccountId(userId);
  const description = describe(msg);

  try {
    // Cash in and out at an agent moves money between your M-Pesa and Cash accounts: not spending.
    if ((msg.kind === "WITHDRAW" || msg.kind === "DEPOSIT") && accountId) {
      const cashId = await cashAccountId(userId);
      if (cashId && cashId !== accountId) {
        await createTransfer({
          userId,
          fromId: msg.kind === "WITHDRAW" ? accountId : cashId,
          toId: msg.kind === "WITHDRAW" ? cashId : accountId,
          amount: msg.amount,
          date,
          note: `M-Pesa ${msg.kind === "WITHDRAW" ? "withdrawal" : "deposit"} (${msg.party})`,
          externalRef: msg.code,
        });
        await logFee(userId, msg, accountId, date);
        return { status: "logged", description, amount: msg.amount, category: "Transfer", remembered: false };
      }
    }

    const rule = await prisma.merchantRule.findUnique({ where: { userId_merchant: { userId, merchant: merchantKey(msg.party) } } });
    const category = rule?.category ?? defaultCategory(msg);
    const income = msg.direction === "IN";
    await createEntry({
      userId,
      description,
      amount: income ? msg.amount : -msg.amount,
      type: income ? "INCOME" : "EXPENSE",
      category,
      date,
      accountId,
      businessId: rule?.businessId ?? null,
      externalRef: msg.code,
      needsReview: true,
    });
    await logFee(userId, msg, accountId, date);
    return { status: "logged", description, amount: msg.amount, category, remembered: Boolean(rule) };
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate", code: msg.code };
    throw e;
  }
}

/** The transaction cost as its own small expense, so the month shows what M-Pesa fees really cost. */
async function logFee(userId: string, msg: MpesaMessage, accountId: string | null, date: Date) {
  if (!(msg.fee > 0)) return;
  try {
    await createEntry({
      userId,
      description: `M-Pesa fee: ${describe(msg).replace(/^M-Pesa: /, "")}`,
      amount: -msg.fee,
      type: "EXPENSE",
      category: "M-Pesa fees",
      date,
      accountId,
      externalRef: `${msg.code}:fee`,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

/**
 * Merchant memory: file a transaction (and every later payment to the same payee) under a category.
 * The payee is read back from the transaction's description.
 */
export async function rememberMerchant(userId: string, description: string, category: string, businessId: string | null) {
  const party = description.match(/^M-Pesa: (?:paid to|sent to|received from) (.+)$/)?.[1] ?? description.match(/^M-Pesa: (.+?)(?: \(acc .*\))?$/)?.[1];
  if (!party || /^(airtime|cash withdrawal|cash deposit)/i.test(party)) return false;
  const merchant = merchantKey(party);
  if (!merchant) return false;
  await prisma.merchantRule.upsert({
    where: { userId_merchant: { userId, merchant } },
    create: { userId, merchant, category, businessId },
    update: { category, businessId },
  });
  return true;
}

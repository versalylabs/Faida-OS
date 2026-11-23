import { prisma } from "@/lib/db";
import { createEntry } from "@/lib/ledger";
import { merchantKey } from "@/lib/mpesa";
import { zonedDateKey, zonedTime } from "@/lib/tz";

/**
 * Bills: things that are due again and again (rent, KPLC, Wi-Fi, subscriptions).
 * A bill is never logged as spent until it is paid: tapping "Paid", or a forwarded M-Pesa paybill SMS that matches
 * it. Paying lines up the next due date, one period on from the one just paid, so a missed month stays owed.
 */

export const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "ONCE"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const DUE_TIME = "09:00";

/** The instant a bill is due on a calendar day (09:00 Nairobi). */
export function dueAt(dateKey: string): Date {
  return zonedTime(dateKey, DUE_TIME);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based here
}

/** The next due date after `current`, one period on. Monthly bills keep their day (31st -> 30th -> 31st). */
export function nextDue(current: Date, frequency: string, anchorDay: number | null): Date | null {
  const key = zonedDateKey(current);
  const [y, m, d] = key.split("-").map(Number);
  const shiftMonths = (months: number) => {
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
    return dueAt(`${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };
  switch (frequency) {
    case "WEEKLY":
      return dueAt(new Date(Date.UTC(y, m - 1, d + 7, 12)).toISOString().slice(0, 10));
    case "MONTHLY":
      return shiftMonths(1);
    case "QUARTERLY":
      return shiftMonths(3);
    case "YEARLY":
      return shiftMonths(12);
    default:
      return null; // ONCE: nothing comes after
  }
}

/** Whole days from today (Nairobi) to the due day: 0 = today, negative = overdue. */
export function daysUntil(due: Date, now: Date = new Date()): number {
  const a = Date.parse(`${zonedDateKey(due)}T12:00:00Z`);
  const b = Date.parse(`${zonedDateKey(now)}T12:00:00Z`);
  return Math.round((a - b) / 86400000);
}

export class BillError extends Error {}

/**
 * Marks a bill paid: logs the expense (unless `alreadyLogged`, e.g. it came from an M-Pesa SMS) and moves the bill
 * to its next due date. Returns what happened.
 */
export async function payBill(
  userId: string,
  billId: string,
  opts: { amount?: number | null; accountId?: string | null; alreadyLogged?: boolean; date?: Date } = {}
) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new BillError("Bill not found");
  const amount = opts.amount ?? bill.amount;
  if (!opts.alreadyLogged && !(amount && amount > 0)) throw new BillError("How much did you pay? This bill's amount varies.");

  if (!opts.alreadyLogged) {
    await createEntry({
      userId,
      description: `Bill: ${bill.name}${bill.accountNo ? ` (acc ${bill.accountNo})` : ""}`,
      amount: -Math.abs(amount as number),
      type: "EXPENSE",
      category: bill.category,
      date: opts.date ?? new Date(),
      accountId: opts.accountId ?? bill.accountId,
      businessId: bill.businessId,
    });
  }

  const next = nextDue(bill.nextDueAt, bill.frequency, bill.anchorDay);
  await prisma.bill.update({
    where: { id: bill.id },
    data: { lastPaidAt: opts.date ?? new Date(), ...(next ? { nextDueAt: next } : { active: false }) },
  });
  return { name: bill.name, amount: amount ?? null, nextDueAt: next };
}

/**
 * An M-Pesa paybill or till payment that matches an active bill (same account number, or the same name) and is
 * for the current period (due within the next 20 days, or overdue). Returns the bill, or null.
 */
export async function matchBill(userId: string, msg: { party: string; account: string | null }, when: Date) {
  const bills = await prisma.bill.findMany({ where: { userId, active: true, nextDueAt: { lte: new Date(when.getTime() + 20 * 86400000) } } });
  const party = merchantKey(msg.party);
  const account = msg.account?.replace(/\s+/g, "").toLowerCase() ?? null;
  return (
    bills.find((b) => account && b.accountNo && b.accountNo.replace(/\s+/g, "").toLowerCase() === account) ??
    bills.find((b) => {
      const name = merchantKey(b.name);
      return name.length >= 3 && (party.includes(name) || name.includes(party));
    }) ??
    null
  );
}

import { zonedTime } from "@/lib/tz";

/**
 * Reads an M-Pesa confirmation SMS. Pure (no database), so every format can be tested with a sample message.
 *
 * Handles the everyday messages:
 *   SEND      "QH12AB3CD4 Confirmed. Ksh500.00 sent to JOHN DOE 0712345678 on 23/11/26 at 1:05 PM. ... Transaction cost, Ksh7.00."
 *   PAYBILL   "... Ksh1,000.00 sent to KPLC PREPAID for account 37123456789 on 23/11/26 at 1:05 PM ..."
 *   TILL      "... Ksh500.00 paid to JAVA HOUSE. on 23/11/26 at 1:05 PM ..."
 *   RECEIVED  "... You have received Ksh2,000.00 from JANE DOE 0712345678 on 23/11/26 at 1:05 PM ..."
 *   WITHDRAW  "... on 23/11/26 at 1:05 PMWithdraw Ksh2,000.00 from 123456 - AGENT SHOP New M-PESA balance ..."
 *   DEPOSIT   "... On 23/11/26 at 1:05 PM Give Ksh1,000.00 cash to AGENT SHOP New M-PESA balance ..."
 *   AIRTIME   "... You bought Ksh100.00 of airtime on 23/11/26 at 1:05 PM ..."
 * Anything else (Fuliza notices, promotions, failed transactions) returns null and is ignored.
 */

export type MpesaKind = "SEND" | "PAYBILL" | "TILL" | "RECEIVED" | "WITHDRAW" | "DEPOSIT" | "AIRTIME";

export interface MpesaMessage {
  code: string; // the M-Pesa transaction code, unique per transaction
  kind: MpesaKind;
  direction: "IN" | "OUT";
  amount: number; // KES, positive
  fee: number; // transaction cost, KES
  party: string; // who the money went to or came from, tidied ("Java House")
  account: string | null; // paybill account number
  date: Date | null; // when M-Pesa says it happened (Nairobi time)
}

const AMOUNT = String.raw`Ksh\s?([\d,]+(?:\.\d{1,2})?)`;
const toNumber = (s: string) => parseFloat(s.replace(/,/g, ""));

function tidyName(raw: string): string {
  const cleaned = raw
    .replace(/\s+\d{9,}.*$/, "") // phone number and anything after it
    .replace(/[.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.toLowerCase().replace(/(^|[\s&/-])\w/g, (c) => c.toUpperCase());
}

function parseDate(text: string): Date | null {
  const m = text.match(/\bon\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const meridian = m[6]?.toUpperCase();
  if (meridian === "PM" && hour < 12) hour += 12;
  if (meridian === "AM" && hour === 12) hour = 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return zonedTime(key, `${hour}:${minute}`);
}

export function parseMpesa(input: string): MpesaMessage | null {
  const text = input.replace(/\s+/g, " ").trim();
  const codeMatch = text.match(/\b([A-Z0-9]{10})\s+confirmed/i);
  if (!codeMatch) return null;
  const code = codeMatch[1].toUpperCase();

  const feeMatch = text.match(new RegExp(String.raw`transaction cost,?\s*` + AMOUNT, "i"));
  const fee = feeMatch ? toNumber(feeMatch[1]) : 0;
  const date = parseDate(text);
  const base = { code, fee, date, account: null as string | null };

  let m: RegExpMatchArray | null;

  if ((m = text.match(new RegExp(String.raw`received\s+` + AMOUNT + String.raw`\s+from\s+(.+?)(?:\s+\d{9,}|\s+on\s+\d)`, "i")))) {
    return { ...base, kind: "RECEIVED", direction: "IN", amount: toNumber(m[1]), party: tidyName(m[2]) };
  }
  if ((m = text.match(new RegExp(AMOUNT + String.raw`\s+sent to\s+(.+?)\s+for account\s+([^\s]+?)\.?\s+on\s`, "i")))) {
    return { ...base, kind: "PAYBILL", direction: "OUT", amount: toNumber(m[1]), party: tidyName(m[2]), account: m[3] };
  }
  if ((m = text.match(new RegExp(AMOUNT + String.raw`\s+sent to\s+(.+?)(?:\s+\d{9,}|\.?\s+on\s+\d)`, "i")))) {
    return { ...base, kind: "SEND", direction: "OUT", amount: toNumber(m[1]), party: tidyName(m[2]) };
  }
  if ((m = text.match(new RegExp(AMOUNT + String.raw`\s+paid to\s+(.+?)\.?\s+on\s+\d`, "i")))) {
    return { ...base, kind: "TILL", direction: "OUT", amount: toNumber(m[1]), party: tidyName(m[2]) };
  }
  if ((m = text.match(new RegExp(String.raw`withdraw\s+` + AMOUNT + String.raw`\s+from\s+(.+?)\s+new m-?pesa`, "i")))) {
    const agent = m[2].replace(/^\d+\s*-\s*/, "");
    return { ...base, kind: "WITHDRAW", direction: "OUT", amount: toNumber(m[1]), party: tidyName(agent) };
  }
  if ((m = text.match(new RegExp(String.raw`give\s+` + AMOUNT + String.raw`\s+cash to\s+(.+?)\s+new m-?pesa`, "i")))) {
    return { ...base, kind: "DEPOSIT", direction: "IN", amount: toNumber(m[1]), party: tidyName(m[2]) };
  }
  if ((m = text.match(new RegExp(String.raw`bought\s+` + AMOUNT + String.raw`\s+of airtime`, "i")))) {
    return { ...base, kind: "AIRTIME", direction: "OUT", amount: toNumber(m[1]), party: "Airtime" };
  }
  return null;
}

/** The form merchant memory is keyed on: "JAVA HOUSE." and "Java  House" are the same merchant. */
export function merchantKey(party: string): string {
  return party
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** A sensible category before you have filed this merchant yourself. */
export function defaultCategory(msg: MpesaMessage): string {
  if (msg.kind === "RECEIVED") return "Income";
  if (msg.kind === "AIRTIME") return "Airtime";
  if (msg.kind === "WITHDRAW") return "Cash withdrawal";
  if (msg.kind === "DEPOSIT") return "Cash deposit";
  if (/kplc|power|token/i.test(msg.party)) return "Utilities";
  if (/safaricom home|zuku|faiba|wifi|internet/i.test(msg.party)) return "Internet";
  return "M-Pesa";
}

/** One line for the ledger, e.g. "M-Pesa: paid to Java House" or "M-Pesa: KPLC Prepaid (acc 3712…)". */
export function describe(msg: MpesaMessage): string {
  switch (msg.kind) {
    case "RECEIVED":
      return `M-Pesa: received from ${msg.party}`;
    case "PAYBILL":
      return `M-Pesa: ${msg.party}${msg.account ? ` (acc ${msg.account})` : ""}`;
    case "SEND":
      return `M-Pesa: sent to ${msg.party}`;
    case "TILL":
      return `M-Pesa: paid to ${msg.party}`;
    case "WITHDRAW":
      return `M-Pesa: cash withdrawal (${msg.party})`;
    case "DEPOSIT":
      return `M-Pesa: cash deposit (${msg.party})`;
    case "AIRTIME":
      return "M-Pesa: airtime";
  }
}

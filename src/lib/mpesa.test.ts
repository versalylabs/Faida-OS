import { describe, expect, it } from "vitest";
import { defaultCategory, describe as describeMsg, merchantKey, parseMpesa } from "@/lib/mpesa";
import { zonedDateKey } from "@/lib/tz";

const nairobi = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Africa/Nairobi", hour12: false });

describe("parseMpesa", () => {
  it("reads a send-money message with its fee and time", () => {
    const m = parseMpesa(
      "QH12AB3CD4 Confirmed. Ksh500.00 sent to JOHN DOE 0712345678 on 23/11/26 at 1:05 PM. New M-PESA balance is Ksh1,234.00. Transaction cost, Ksh7.00. Amount you can transact within the day is 499,500.00."
    )!;
    expect(m).toMatchObject({ code: "QH12AB3CD4", kind: "SEND", direction: "OUT", amount: 500, fee: 7, party: "John Doe" });
    expect(nairobi(m.date!)).toBe("23/11/2026, 13:05:00");
  });

  it("reads a paybill payment with its account number", () => {
    const m = parseMpesa(
      "QH12AB3CD5 Confirmed. Ksh1,000.00 sent to KPLC PREPAID for account 37123456789 on 23/11/26 at 9:15 AM New M-PESA balance is Ksh234.00. Transaction cost, Ksh0.00."
    )!;
    expect(m).toMatchObject({ kind: "PAYBILL", amount: 1000, account: "37123456789", fee: 0 });
    expect(defaultCategory(m)).toBe("Utilities");
  });

  it("reads till, received, withdraw, deposit and airtime", () => {
    const till = parseMpesa("QH12AB3CD6 Confirmed. Ksh500.00 paid to JAVA HOUSE. on 23/11/26 at 1:05 PM.New M-PESA balance is Ksh734.00.")!;
    expect(till).toMatchObject({ kind: "TILL", party: "Java House" });
    expect(describeMsg(till)).toBe("M-Pesa: paid to Java House");

    const received = parseMpesa("QH12AB3CD7 Confirmed.You have received Ksh2,000.00 from JANE DOE 0712345678 on 23/11/26 at 6:40 PM New M-PESA balance is Ksh2,734.00.")!;
    expect(received).toMatchObject({ kind: "RECEIVED", direction: "IN", amount: 2000, party: "Jane Doe" });

    const withdraw = parseMpesa("QH12AB3CD8 Confirmed.on 23/11/26 at 7:02 PMWithdraw Ksh2,000.00 from 123456 - MAMA MBOGA SHOP New M-PESA balance is Ksh705.00. Transaction cost, Ksh29.00.")!;
    expect(withdraw).toMatchObject({ kind: "WITHDRAW", amount: 2000, fee: 29, party: "Mama Mboga Shop" });

    const deposit = parseMpesa("QH12AB3CD9 Confirmed. On 24/11/26 at 10:00 AM Give Ksh1,000.00 cash to KAMAU AGENCIES New M-PESA balance is Ksh1,705.00.")!;
    expect(deposit).toMatchObject({ kind: "DEPOSIT", direction: "IN" });

    const airtime = parseMpesa("QH12AB3CE0 confirmed.You bought Ksh100.00 of airtime on 24/11/26 at 8:00 AM.New M-PESA balance is Ksh1,605.00.")!;
    expect(airtime).toMatchObject({ kind: "AIRTIME", amount: 100 });
  });

  it("ignores messages that are not confirmations", () => {
    expect(parseMpesa("Fuliza M-PESA amount is Ksh 50.00. Access fee charged Ksh 0.50.")).toBeNull();
    expect(parseMpesa("Spent KES 300 on lunch")).toBeNull();
  });

  it("uses the SMS date in Nairobi, not the server's", () => {
    const m = parseMpesa("QH12AB3CE1 Confirmed. Ksh50.00 paid to KIOSK. on 1/12/26 at 12:30 AM.New M-PESA balance is Ksh1.00.")!;
    expect(zonedDateKey(m.date!)).toBe("2026-12-01");
  });
});

describe("merchantKey", () => {
  it("treats spelling and punctuation variants as one merchant", () => {
    expect(merchantKey("JAVA HOUSE.")).toBe("java house");
    expect(merchantKey("Java  House")).toBe("java house");
  });
});

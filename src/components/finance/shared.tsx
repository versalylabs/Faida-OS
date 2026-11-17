"use client";

import { Banknote, Building2, Coins, CreditCard, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";

export interface FinAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  color?: string | null;
  isDefault?: boolean;
  monthIn?: number;
  monthOut?: number;
}

export interface FinCategory {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | string;
  color?: string | null;
}

export interface FinTransaction {
  id: string;
  description: string;
  amount: number; // income positive, expense negative
  type: string; // INCOME, EXPENSE or TRANSFER
  category: string;
  date: string;
  isRecurring: boolean;
  accountId?: string | null;
  transferGroup?: string | null;
  businessId?: string | null;
  account?: { name: string; color?: string | null } | null;
  business?: { name: string } | null;
}

export const accountIcon = (type: string): ReactNode => {
  switch (type) {
    case "CARD":
      return <CreditCard className="h-4 w-4" />;
    case "CASH":
      return <Banknote className="h-4 w-4" />;
    case "SAVINGS":
      return <PiggyBank className="h-4 w-4" />;
    case "BANK":
      return <Building2 className="h-4 w-4" />;
    default:
      return <Coins className="h-4 w-4" />;
  }
};

/** Today's date as the date input wants it, in Nairobi time. */
export const todayInput = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

/** A date-input value as a real instant (noon Nairobi time, so it never slips a day). */
export const inputToIso = (value: string) => new Date(`${value}T12:00:00+03:00`).toISOString();

export const dateToInput = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

export const fieldCls = "w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500";
export const labelCls = "text-slate-300 block mb-1 font-medium";

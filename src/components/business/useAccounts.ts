"use client";

import { useEffect, useState } from "react";
import { offlineFetch } from "@/lib/offlineSync";

export interface AccountOption {
  id: string;
  name: string;
  balance: number;
  isDefault?: boolean;
}

/** The user's money accounts, so business money can say which account it moved. */
export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    offlineFetch("/api/finance/accounts", { cache: "no-store" })
      .then((r: any) => r.json())
      .then((d: any) => alive && d?.success && setAccounts(d.accounts || []))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  return { accounts, loaded };
}

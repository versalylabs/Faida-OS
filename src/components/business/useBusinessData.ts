"use client";

import { useCallback, useEffect, useState } from "react";
import { offlineFetch } from "@/lib/offlineSync";
import type { BusinessItem, PortfolioSummary } from "@/components/business/types";

/**
 * The business section's data. Until the first answer arrives `loading` is true and every number is
 * absent (never a made-up placeholder), so the page shows skeletons instead of figures.
 */
export function useBusinessData() {
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await offlineFetch("/api/business", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.businesses || []);
        setSummary(data.portfolioSummary || null);
        setError(null);
      } else {
        setError(data.error || "Could not load the business section");
      }
    } catch (e) {
      console.error("Failed to load business data", e);
      setError("Could not load the business section");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { businesses, summary, loading, error, reload };
}

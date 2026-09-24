import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, queueDulceHoraDetailBackfill, type SalesSummary } from "./api";
import { useBranchScope } from "./branchScope";
import { invalidateDulceHoraReporting } from "./dulceHoraDetails";

const queuedHydrations = new Set<string>();

type AutoHydrationOptions = {
  date: string;
  enabled?: boolean;
  coverage?: number | null;
};

type AutoHydrationState = {
  running: boolean;
  coverage: number;
  remaining: number | null;
  queued: boolean;
};

export function useProductDetailHydration({
  date,
  enabled = true,
  coverage
}: AutoHydrationOptions): AutoHydrationState {
  const queryClient = useQueryClient();
  const { branchId, consolidated } = useBranchScope();
  const hydrationKey = `${branchId}:${date}`;
  const [queuedKey, setQueuedKey] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const coverageQuery = useQuery({
    queryKey: ["sales-summary", date, date],
    queryFn: () => api<SalesSummary>(`/api/sales/summary?from=${date}&to=${date}`),
    enabled: enabled && coverage == null && Boolean(date),
    staleTime: 30_000
  });

  const currentCoverage = useMemo(() => {
    if (typeof coverage === "number") return coverage;
    return coverageQuery.data?.summary.itemDetailCoverage ?? 1;
  }, [coverage, coverageQuery.data?.summary.itemDetailCoverage]);

  useEffect(() => {
    if (consolidated || !enabled || !date || currentCoverage >= 0.995 || queuedHydrations.has(hydrationKey)) return;

    let mounted = true;
    queuedHydrations.add(hydrationKey);
    queueMicrotask(() => {
      if (mounted) {
        setQueuedKey(hydrationKey);
        setRemaining(null);
      }
    });

    void queueDulceHoraDetailBackfill({ date, days: 1, refreshLastDate: false })
      .catch((error) => {
        queuedHydrations.delete(hydrationKey);
        console.warn("[dulce-hora] No se pudo iniciar la recuperacion de productos", error);
        if (mounted) {
          setQueuedKey(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [consolidated, currentCoverage, date, enabled, hydrationKey, queryClient]);

  useEffect(() => {
    if (queuedKey !== hydrationKey || currentCoverage >= 0.995) return;
    const timer = window.setInterval(() => {
      void invalidateDulceHoraReporting(queryClient);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [currentCoverage, hydrationKey, queryClient, queuedKey]);

  useEffect(() => {
    if (currentCoverage < 0.995 || queuedKey !== hydrationKey) return;
    queuedHydrations.delete(hydrationKey);
    setQueuedKey(null);
    setRemaining(null);
  }, [currentCoverage, hydrationKey, queuedKey]);

  return {
    running: queuedKey === hydrationKey || queuedHydrations.has(hydrationKey),
    coverage: currentCoverage,
    remaining,
    queued: queuedKey === hydrationKey || queuedHydrations.has(hydrationKey)
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type SalesSummary } from "./api";
import { hydrateDulceHoraDetailsUntilDone } from "./dulceHoraDetails";

const runningHydrations = new Set<string>();

type AutoHydrationOptions = {
  date: string;
  enabled?: boolean;
  coverage?: number | null;
};

type AutoHydrationState = {
  running: boolean;
  coverage: number;
  remaining: number | null;
};

export function useProductDetailHydration({
  date,
  enabled = true,
  coverage
}: AutoHydrationOptions): AutoHydrationState {
  const queryClient = useQueryClient();
  const [runningDate, setRunningDate] = useState<string | null>(null);
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
    if (!enabled || !date || currentCoverage >= 0.995 || runningHydrations.has(date)) return;

    let mounted = true;
    runningHydrations.add(date);
    setRunningDate(date);
    setRemaining(null);

    void hydrateDulceHoraDetailsUntilDone({
      date,
      queryClient,
      limit: 3,
      maxRuns: 36,
      pauseMs: 650,
      onProgress: (progress) => {
        if (!mounted) return;
        setRemaining(progress.remaining);
      }
    })
      .catch((error) => {
        console.warn("[dulce-hora] No se pudo completar detalle de productos automaticamente", error);
      })
      .finally(() => {
        runningHydrations.delete(date);
        if (mounted) {
          setRunningDate(null);
          setRemaining(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentCoverage, date, enabled, queryClient]);

  return {
    running: runningDate === date || runningHydrations.has(date),
    coverage: currentCoverage,
    remaining
  };
}

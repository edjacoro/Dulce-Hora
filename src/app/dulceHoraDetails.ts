import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type DetailHydrationResult = {
  runId: string;
  date: string;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  itemRows: number;
  wasteRecordsReceived: number;
  wasteRecordsCreated: number;
  wasteRecordsUpdated: number;
  errors: string[];
  warnings?: string[];
  detailRecordsRemaining?: number;
};

type HydrationProgress = {
  run: number;
  totalRuns: number;
  itemRows: number;
  recordsUpdated: number;
  remaining: number | null;
};

type HydrationOptions = {
  date: string;
  queryClient: QueryClient;
  limit?: number;
  maxRuns?: number;
  pauseMs?: number;
  shouldContinue?: () => boolean;
  onProgress?: (progress: HydrationProgress) => void;
};

export async function hydrateDulceHoraDetailsUntilDone({
  date,
  queryClient,
  limit = 3,
  maxRuns = 45,
  pauseMs = 550,
  shouldContinue = () => true,
  onProgress
}: HydrationOptions) {
  let totalItemRows = 0;
  let totalRecordsUpdated = 0;
  let lastRemaining: number | null = null;

  for (let run = 1; run <= maxRuns; run += 1) {
    if (!shouldContinue()) break;

    const result = await api<DetailHydrationResult>("/api/integration/dulce-hora/hydrate-date-details", {
      method: "POST",
      body: JSON.stringify({ date, limit })
    });

    totalItemRows += result.itemRows;
    totalRecordsUpdated += result.recordsUpdated;
    lastRemaining = result.detailRecordsRemaining ?? null;
    onProgress?.({
      run,
      totalRuns: maxRuns,
      itemRows: totalItemRows,
      recordsUpdated: totalRecordsUpdated,
      remaining: lastRemaining
    });

    if (run === 1 || run % 3 === 0 || lastRemaining === 0) {
      await invalidateDulceHoraReporting(queryClient);
    }
    if (lastRemaining === 0 || (result.recordsUpdated === 0 && result.itemRows === 0)) break;
    if (pauseMs > 0) await wait(pauseMs);
  }

  await invalidateDulceHoraReporting(queryClient);
  return {
    itemRows: totalItemRows,
    recordsUpdated: totalRecordsUpdated,
    detailRecordsRemaining: lastRemaining
  };
}

export async function invalidateDulceHoraReporting(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["integration-status"] }),
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["product-performance"] }),
    queryClient.invalidateQueries({ queryKey: ["hour-performance"] }),
    queryClient.invalidateQueries({ queryKey: ["analysis-sales"] }),
    queryClient.invalidateQueries({ queryKey: ["waste-records"] }),
    queryClient.invalidateQueries({ queryKey: ["waste-summary"] })
  ]);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

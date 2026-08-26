import { useEffect } from "react";
import { useDulceHoraImportJob } from "./dulceHoraImportJob";
import { canRunDulceHoraDateSyncFromThisHost } from "./runtime";
import { todayArgentina } from "./usePeriodUrlState";

type AutoDailySyncOptions = {
  date: string;
  enabled: boolean;
  reason: string;
  includeWaste?: boolean;
  includeProductDetails?: boolean;
  maxRuns?: number;
  detailLimit?: number;
};

export function useAutoDailyDulceHoraSync({
  date,
  enabled,
  reason,
  includeWaste = false,
  includeProductDetails = true,
  maxRuns,
  detailLimit
}: AutoDailySyncOptions) {
  const importJob = useDulceHoraImportJob();

  useEffect(() => {
    if (!enabled || !date || importJob.state.active || !canRunDulceHoraDateSyncFromThisHost(date)) return;
    if (date > todayArgentina()) return;

    const key = `dulce-hora:auto-sync:${reason}:${date}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "true");

    void importJob.startImport({
      date,
      includeWaste,
      includeProductDetails,
      maxRuns,
      detailLimit
    });
  }, [date, detailLimit, enabled, importJob, includeProductDetails, includeWaste, maxRuns, reason]);
}

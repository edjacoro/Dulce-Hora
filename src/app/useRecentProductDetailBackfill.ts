import { useEffect } from "react";
import { queueDulceHoraDetailBackfill } from "./api";
import { useBranchScope } from "./branchScope";
import { todayArgentina } from "./usePeriodUrlState";

export function useRecentProductDetailBackfill() {
  const { branchId, consolidated } = useBranchScope();

  useEffect(() => {
    if (consolidated || !branchId || branchId === "all") return;

    const key = `dulce-hora:recent-product-backfill:${branchId}:${todayArgentina()}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "queued");

    void queueDulceHoraDetailBackfill({ days: 4, refreshLastDate: true }).catch((error) => {
      window.sessionStorage.removeItem(key);
      console.warn("[dulce-hora] No se pudo iniciar la recuperacion de productos", error);
    });
  }, [branchId, consolidated]);
}

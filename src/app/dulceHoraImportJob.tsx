import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { hydrateDulceHoraDetailsUntilDone, invalidateDulceHoraReporting } from "./dulceHoraDetails";

type SyncResult = {
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
};

type ImportPhase = "idle" | "syncing" | "details" | "done" | "error";

export type DulceHoraImportJobState = {
  active: boolean;
  phase: ImportPhase;
  date: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  recordsReceived: number | null;
  recordsCreated: number | null;
  recordsUpdated: number | null;
  recordsRejected: number | null;
  baseItemRows: number | null;
  detailRun: number;
  detailTotalRuns: number;
  detailItemRows: number;
  detailRecordsUpdated: number;
  detailRemaining: number | null;
  warnings: string[];
  error: string | null;
};

type StartImportOptions = {
  date: string;
  maxRuns?: number;
  detailLimit?: number;
  includeWaste?: boolean;
  includeProductDetails?: boolean;
};

type DulceHoraImportJobContextValue = {
  state: DulceHoraImportJobState;
  startImport: (options: StartImportOptions) => Promise<void>;
  resetFinished: () => void;
};

const idleState: DulceHoraImportJobState = {
  active: false,
  phase: "idle",
  date: null,
  startedAt: null,
  finishedAt: null,
  recordsReceived: null,
  recordsCreated: null,
  recordsUpdated: null,
  recordsRejected: null,
  baseItemRows: null,
  detailRun: 0,
  detailTotalRuns: 0,
  detailItemRows: 0,
  detailRecordsUpdated: 0,
  detailRemaining: null,
  warnings: [],
  error: null
};

const DulceHoraImportJobContext = createContext<DulceHoraImportJobContextValue | null>(null);

export function DulceHoraImportJobProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DulceHoraImportJobState>(idleState);
  const runningJobRef = useRef<Promise<void> | null>(null);

  const startImport = useCallback(
    (options: StartImportOptions) => {
      if (runningJobRef.current) {
        return runningJobRef.current;
      }

      const date = options.date;
      const maxRuns = options.maxRuns ?? 55;
      const detailLimit = options.detailLimit ?? 3;
      const includeWaste = options.includeWaste ?? false;
      const includeProductDetails = options.includeProductDetails ?? true;

      const job = (async () => {
        setState({
          ...idleState,
          active: true,
          phase: "syncing",
          date,
          startedAt: new Date().toISOString(),
          detailTotalRuns: maxRuns
        });

        try {
          const syncResult = await api<SyncResult>("/api/integration/dulce-hora/sync-date", {
            method: "POST",
            body: JSON.stringify({ date, includeWaste, includeStatistics: false })
          });

          await invalidateDulceHoraReporting(queryClient);
          setState((current) => ({
            ...current,
            active: true,
            phase: "details",
            date,
            recordsReceived: syncResult.recordsReceived,
            recordsCreated: syncResult.recordsCreated,
            recordsUpdated: syncResult.recordsUpdated,
            recordsRejected: syncResult.recordsRejected,
            baseItemRows: syncResult.itemRows,
            detailTotalRuns: maxRuns,
            warnings: syncResult.warnings ?? [],
            error: null
          }));

          const detailResult = includeProductDetails
            ? await hydrateDulceHoraDetailsUntilDone({
                date,
                queryClient,
                limit: detailLimit,
                maxRuns,
                onProgress: (progress) => {
                  setState((current) => ({
                    ...current,
                    active: true,
                    phase: "details",
                    date,
                    detailRun: progress.run,
                    detailTotalRuns: progress.totalRuns,
                    detailItemRows: progress.itemRows,
                    detailRecordsUpdated: progress.recordsUpdated,
                    detailRemaining: progress.remaining,
                    error: null
                  }));
                }
              })
            : { itemRows: 0, recordsUpdated: 0, detailRecordsRemaining: null };

          setState((current) => ({
            ...current,
            active: false,
            phase: "done",
            date,
            finishedAt: new Date().toISOString(),
            detailItemRows: detailResult.itemRows,
            detailRecordsUpdated: detailResult.recordsUpdated,
            detailRemaining: detailResult.detailRecordsRemaining,
            error: null
          }));
        } catch (error) {
          console.warn("[dulce-hora] No se pudo completar la importacion en segundo plano", error);
          setState((current) => ({
            ...current,
            active: false,
            phase: "error",
            date,
            finishedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : "No se pudo completar la importacion"
          }));
        } finally {
          runningJobRef.current = null;
        }
      })();

      runningJobRef.current = job;
      return job;
    },
    [queryClient]
  );

  const resetFinished = useCallback(() => {
    setState((current) => (current.active ? current : idleState));
  }, []);

  const value = useMemo(
    () => ({
      state,
      startImport,
      resetFinished
    }),
    [resetFinished, startImport, state]
  );

  return <DulceHoraImportJobContext.Provider value={value}>{children}</DulceHoraImportJobContext.Provider>;
}

export function useDulceHoraImportJob() {
  const context = useContext(DulceHoraImportJobContext);
  if (!context) {
    throw new Error("useDulceHoraImportJob debe usarse dentro de DulceHoraImportJobProvider");
  }
  return context;
}

export function DulceHoraImportJobBanner() {
  const { state, resetFinished } = useDulceHoraImportJob();

  if (state.phase === "idle") {
    return null;
  }

  const isDone = state.phase === "done";
  const isError = state.phase === "error";
  const title = state.phase === "syncing" ? "Sincronizando Dulce Hora" : state.active ? "Completando productos" : isDone ? "Importacion lista" : "Importacion con error";

  return (
    <div className={`background-import-banner ${isError ? "error" : isDone ? "done" : "active"}`}>
      <span className={`sync-dot ${state.active ? "pending" : isError ? "off" : "ok"}`} />
      <div>
        <strong>
          {title}
          {state.date ? ` - ${formatDate(state.date)}` : ""}
        </strong>
        <small>
          {state.phase === "syncing"
            ? "Leyendo ventas desde Dulce Hora. Podes seguir usando la app."
            : state.error
              ? state.error
              : `${state.detailItemRows} items cargados${state.detailRemaining !== null ? `, ${state.detailRemaining} comprobantes pendientes` : ""}.`}
        </small>
      </div>
      {!state.active ? (
        <button className="secondary-button compact" onClick={resetFinished} type="button">
          Ocultar
        </button>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

import { api } from "./api";

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

export type SyncHistoryResult = SyncResult & {
  dateFrom: string | null;
  dateTo: string | null;
  datesSynced: number;
};

const defaultHistoryStartDate = "2026-04-17";

export async function syncHistoryInChunks(
  onChunk?: (result: SyncHistoryResult, chunk: { from: string; to: string; index: number; total: number; label?: string }) => void
) {
  const startDate = historyStartDate();
  const endDate = todayArgentina();
  let aggregate = emptyHistoryResult();

  onChunk?.(aggregate, {
    from: startDate,
    to: endDate,
    index: 1,
    total: 1,
    label: "Historial completo"
  });
  try {
    const result = await api<SyncHistoryResult>("/api/integration/dulce-hora/sync-history", {
      method: "POST",
      body: JSON.stringify({ from: startDate, to: endDate, includeWaste: true })
    });
    aggregate = mergeHistoryResults(aggregate, result);
  } catch (error) {
    aggregate.errors.push(error instanceof Error ? error.message : "Error desconocido");
  }
  onChunk?.(aggregate, { from: startDate, to: endDate, index: 1, total: 1, label: "Historial completo" });

  if (aggregate.errors.length > 0 && aggregate.recordsReceived === 0 && aggregate.wasteRecordsReceived === 0) {
    throw new Error(
      `No se pudo sincronizar ningun dia del historial de Dulce Hora. ${aggregate.errors.slice(0, 3).join(" | ")}`
    );
  }

  return aggregate;
}

function mergeHistoryResults(left: SyncHistoryResult, right: SyncHistoryResult): SyncHistoryResult {
  return {
    runId: right.runId || left.runId,
    date: "historial",
    dateFrom: minDate(left.dateFrom, right.dateFrom),
    dateTo: maxDate(left.dateTo, right.dateTo),
    datesSynced: left.datesSynced + right.datesSynced,
    recordsReceived: left.recordsReceived + right.recordsReceived,
    recordsCreated: left.recordsCreated + right.recordsCreated,
    recordsUpdated: left.recordsUpdated + right.recordsUpdated,
    recordsRejected: left.recordsRejected + right.recordsRejected,
    itemRows: left.itemRows + right.itemRows,
    wasteRecordsReceived: left.wasteRecordsReceived + right.wasteRecordsReceived,
    wasteRecordsCreated: left.wasteRecordsCreated + right.wasteRecordsCreated,
    wasteRecordsUpdated: left.wasteRecordsUpdated + right.wasteRecordsUpdated,
    errors: [...left.errors, ...right.errors],
    warnings: uniqueMessages([...(left.warnings ?? []), ...(right.warnings ?? [])])
  };
}

function emptyHistoryResult(): SyncHistoryResult {
  return {
    runId: "",
    date: "historial",
    dateFrom: null,
    dateTo: null,
    datesSynced: 0,
    recordsReceived: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsRejected: 0,
    itemRows: 0,
    wasteRecordsReceived: 0,
    wasteRecordsCreated: 0,
    wasteRecordsUpdated: 0,
    errors: [],
    warnings: []
  };
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}

function historyStartDate() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_DULCE_HORA_HISTORY_START || defaultHistoryStartDate;
}

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function minDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

function maxDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

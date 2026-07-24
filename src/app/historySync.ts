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
};

export type SyncHistoryResult = SyncResult & {
  dateFrom: string | null;
  dateTo: string | null;
  datesSynced: number;
};

const defaultHistoryStartDate = "2026-04-17";
const defaultHistoryChunkDays = 1;

export async function syncHistoryInChunks(
  onChunk?: (result: SyncHistoryResult, chunk: { from: string; to: string; index: number; total: number }) => void
) {
  const chunks = dateChunks(historyStartDate(), todayArgentina(), historyChunkDays());
  let aggregate = emptyHistoryResult();

  for (const [index, chunk] of chunks.entries()) {
    try {
      if (chunk.from === chunk.to) {
        const result = await api<SyncResult>("/api/integration/dulce-hora/sync-date", {
          method: "POST",
          body: JSON.stringify({ date: chunk.from })
        });
        aggregate = mergeHistoryResults(aggregate, dateResultToHistory(result));
      } else {
        const result = await api<SyncHistoryResult>("/api/integration/dulce-hora/sync-history", {
          method: "POST",
          body: JSON.stringify({ from: chunk.from, to: chunk.to })
        });
        aggregate = mergeHistoryResults(aggregate, result);
      }
    } catch (error) {
      const dateLabel = chunk.from === chunk.to ? chunk.from : `${chunk.from} a ${chunk.to}`;
      aggregate.errors.push(`${dateLabel}: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
    onChunk?.(aggregate, { ...chunk, index: index + 1, total: chunks.length });
  }

  if (aggregate.errors.length >= chunks.length) {
    throw new Error(
      `No se pudo sincronizar ningun dia del historial de Dulce Hora. ${aggregate.errors.slice(0, 3).join(" | ")}`
    );
  }

  return aggregate;
}

function dateResultToHistory(result: SyncResult): SyncHistoryResult {
  const hasData = result.recordsReceived > 0 || result.wasteRecordsReceived > 0;
  return {
    ...result,
    date: "historial",
    dateFrom: result.date,
    dateTo: result.date,
    datesSynced: hasData ? 1 : 0
  };
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
    errors: [...left.errors, ...right.errors]
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
    errors: []
  };
}

function dateChunks(from: string, to: string, size: number) {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = parseDate(from);
  const last = parseDate(to);

  while (cursor <= last) {
    const chunkFrom = formatDate(cursor);
    const chunkEnd = addDays(cursor, size - 1);
    const chunkTo = formatDate(chunkEnd <= last ? chunkEnd : last);
    chunks.push({ from: chunkFrom, to: chunkTo });
    cursor = addDays(chunkEnd, 1);
  }

  return chunks;
}

function historyStartDate() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_DULCE_HORA_HISTORY_START || defaultHistoryStartDate;
}

function historyChunkDays() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const parsed = Number(env?.VITE_DULCE_HORA_HISTORY_CHUNK_DAYS ?? defaultHistoryChunkDays);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultHistoryChunkDays;
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

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
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

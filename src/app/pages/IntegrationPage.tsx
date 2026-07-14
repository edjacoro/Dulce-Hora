import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CalendarSync, CheckCircle2, FileSpreadsheet, LockKeyhole, Server, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api";

type IntegrationStatus = {
  phase: string;
  credentialsConfigured: boolean;
  readOnlyAllowlist: string[];
  discoveredCapabilities: Record<string, boolean>;
  nextPhase: string;
  syncRuns: SyncRun[];
};

type SyncRun = {
  id: string;
  integration: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  records_received: number;
  records_created: number;
  records_updated: number;
  error_message: string | null;
  branch_name: string;
};

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

type PortalProvider = "pedidosya" | "rappi" | "otro";

type PortalSalesRow = {
  date: string;
  provider: PortalProvider;
  total: number;
  orders: number;
  hour?: string | null;
  notes?: string;
};

type PortalSalesImportResult = {
  rowsReceived: number;
  documentsReceived: number;
  documentsCreated: number;
  documentsReplaced: number;
  totalImported: number;
  providers: PortalProvider[];
};

export function IntegrationPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => todayArgentina());
  const [portalForm, setPortalForm] = useState({
    provider: "pedidosya" as PortalProvider,
    date: todayArgentina(),
    total: "",
    orders: "",
    hour: "",
    notes: ""
  });
  const [csvText, setCsvText] = useState("");
  const [portalError, setPortalError] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => api<IntegrationStatus>("/api/integration/status")
  });

  const sync = useMutation({
    mutationFn: () =>
      api<SyncResult>("/api/integration/dulce-hora/sync-date", {
        method: "POST",
        body: JSON.stringify({ date })
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-status"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-records"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-summary"] })
      ]);
    }
  });
  const portalImport = useMutation({
    mutationFn: (rows: PortalSalesRow[]) =>
      api<PortalSalesImportResult>("/api/imports/portal-sales", {
        method: "POST",
        body: JSON.stringify({ rows })
      }),
    onSuccess: async () => {
      setPortalError(null);
      await invalidateReporting(queryClient);
    }
  });

  function submitPortalForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = parseMoneyInput(portalForm.total);
    const orders = Number(portalForm.orders);

    if (!portalForm.date || !Number.isFinite(total) || total <= 0 || !Number.isInteger(orders) || orders <= 0) {
      setPortalError("Revisa fecha, total y cantidad de pedidos.");
      return;
    }

    portalImport.mutate([
      {
        date: portalForm.date,
        provider: portalForm.provider,
        total,
        orders,
        hour: portalForm.hour || null,
        notes: portalForm.notes
      }
    ]);
  }

  function submitPortalCsv() {
    try {
      const rows = parsePortalCsv(csvText);
      if (rows.length === 0) {
        setPortalError("No encontre filas para importar.");
        return;
      }
      portalImport.mutate(rows);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "No pude leer el CSV.");
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Importaciones</h1>
          <p>{status.data?.phase ?? "Cargando integracion"}</p>
        </div>
      </div>

      <section className="content-band">
        <h2>
          <CalendarSync size={18} aria-hidden="true" />
          Sincronizar facturacion y mermas por fecha
        </h2>

        <div className="sync-form">
          <label>
            Fecha
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button
            className="primary-button"
            disabled={sync.isPending || !status.data?.credentialsConfigured}
            onClick={() => sync.mutate()}
            type="button"
          >
            <CalendarSync size={18} aria-hidden="true" />
            {sync.isPending ? "Sincronizando..." : "Tomar ventas y mermas desde Dulce Hora"}
          </button>
        </div>

        {!status.data?.credentialsConfigured ? (
          <p className="form-error">
            Faltan las variables DULCE_HORA_USERNAME y DULCE_HORA_PASSWORD en el entorno del
            backend local.
          </p>
        ) : null}

        {sync.error ? <p className="form-error">{sync.error.message}</p> : null}

        {sync.data ? (
          <div className="sync-result">
            <strong>Sincronizacion terminada</strong>
            <span>{sync.data.recordsReceived} comprobantes leidos</span>
            <span>{sync.data.recordsCreated} nuevos</span>
            <span>{sync.data.recordsUpdated} actualizados</span>
            <span>{sync.data.recordsRejected} rechazados</span>
            <span>{sync.data.itemRows} items</span>
            <span>{sync.data.wasteRecordsReceived} mermas leidas</span>
            <span>{sync.data.wasteRecordsCreated} mermas nuevas</span>
            <span>{sync.data.wasteRecordsUpdated} mermas actualizadas</span>
          </div>
        ) : null}
      </section>

      <section className="content-band">
        <h2>
          <FileSpreadsheet size={18} aria-hidden="true" />
          Ventas por portal
        </h2>

        <form className="form-grid" onSubmit={submitPortalForm}>
          <label>
            Portal
            <select
              value={portalForm.provider}
              onChange={(event) =>
                setPortalForm((current) => ({
                  ...current,
                  provider: event.target.value as PortalProvider
                }))
              }
            >
              <option value="pedidosya">Pedidos Ya</option>
              <option value="rappi">Rappi</option>
              <option value="otro">Otro portal</option>
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={portalForm.date}
              onChange={(event) => setPortalForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label>
            Venta neta
            <input
              inputMode="decimal"
              placeholder="$ 0"
              value={portalForm.total}
              onChange={(event) => setPortalForm((current) => ({ ...current, total: event.target.value }))}
            />
          </label>
          <label>
            Pedidos
            <input
              min="1"
              type="number"
              value={portalForm.orders}
              onChange={(event) => setPortalForm((current) => ({ ...current, orders: event.target.value }))}
            />
          </label>
          <label>
            Hora
            <input
              type="time"
              value={portalForm.hour}
              onChange={(event) => setPortalForm((current) => ({ ...current, hour: event.target.value }))}
            />
          </label>
          <label>
            Notas
            <input
              value={portalForm.notes}
              onChange={(event) => setPortalForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <button className="primary-button full" disabled={portalImport.isPending} type="submit">
            <Upload size={18} aria-hidden="true" />
            {portalImport.isPending ? "Cargando..." : "Cargar ventas"}
          </button>
        </form>

        <div className="form-stack">
          <label>
            CSV rapido
            <textarea
              rows={4}
              value={csvText}
              placeholder="2026-07-12;pedidosya;150000;22;20:00"
              onChange={(event) => setCsvText(event.target.value)}
            />
          </label>
          <button
            className="icon-text-button"
            disabled={portalImport.isPending}
            onClick={submitPortalCsv}
            type="button"
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            Importar CSV
          </button>
        </div>

        {portalError ? <p className="form-error">{portalError}</p> : null}
        {portalImport.error ? <p className="form-error">{portalImport.error.message}</p> : null}

        {portalImport.data ? (
          <div className="sync-result">
            <strong>Ventas cargadas</strong>
            <span>{portalImport.data.rowsReceived} filas</span>
            <span>{portalImport.data.documentsCreated} tickets</span>
            <span>{portalImport.data.documentsReplaced} reemplazados</span>
            <span>{formatCurrency(portalImport.data.totalImported)}</span>
          </div>
        ) : null}
      </section>

      <div className="split-layout">
        <section className="content-band">
          <h2>Lecturas permitidas</h2>
          <div className="route-list">
            {status.data?.readOnlyAllowlist.map((route) => (
              <code key={route}>{route}</code>
            ))}
          </div>
        </section>

        <section className="content-band">
          <h2>Estado tecnico</h2>
          <div className="status-list">
            <span>
              {status.data?.credentialsConfigured ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <LockKeyhole size={18} aria-hidden="true" />
              )}
              Credenciales del panel
            </span>
            {Object.entries(status.data?.discoveredCapabilities ?? {}).map(([key, enabled]) => (
              <span key={key}>
                {enabled ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <LockKeyhole size={18} aria-hidden="true" />
                )}
                {label(key)}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="content-band">
        <h2>
          <Server size={18} aria-hidden="true" />
          Ultimas ejecuciones
        </h2>
        {status.data?.syncRuns.length ? (
          <div className="run-list">
            {status.data.syncRuns.map((run) => (
              <div className="list-row" key={run.id}>
                <strong>
                  {run.branch_name} - {run.status}
                </strong>
                <span>
                  {new Date(run.started_at).toLocaleString("es-AR")} - {run.records_received}{" "}
                  leidos - {run.records_created} nuevos - {run.records_updated} actualizados
                </span>
                {run.error_message ? <span>{run.error_message}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Server size={22} aria-hidden="true" />
            <div>
              <h2>Sin ejecuciones todavia</h2>
              <p>{status.data?.nextPhase ?? "Preparando estado"}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function label(key: string) {
  const labels: Record<string, string> = {
    statisticsXlsx: "XLSX de estadisticas",
    documentHtmlListing: "Listado HTML diario",
    documentJsonDetail: "Detalle JSON",
    ticketItems: "Items por ticket",
    wasteRecords: "Desperdicios del panel",
    mutatingRoutesBlocked: "Rutas mutantes bloqueadas"
  };
  return labels[key] ?? key;
}

async function invalidateReporting(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["integration-status"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["product-performance"] }),
    queryClient.invalidateQueries({ queryKey: ["hour-performance"] }),
    queryClient.invalidateQueries({ queryKey: ["waste-records"] }),
    queryClient.invalidateQueries({ queryKey: ["waste-summary"] })
  ]);
}

function parsePortalCsv(value: string): PortalSalesRow[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const separator = line.includes(";") ? ";" : ",";
      const [rawDate, rawProvider, rawTotal, rawOrders, rawHour, ...notes] = line
        .split(separator)
        .map((part) => part.trim());

      if (index === 0 && rawDate?.toLowerCase().includes("fecha")) {
        return [];
      }

      const date = normalizeDate(rawDate);
      const provider = normalizeProvider(rawProvider);
      const total = parseMoneyInput(rawTotal);
      const orders = Number((rawOrders ?? "").replace(/\D/g, ""));
      const hour = normalizeHour(rawHour);

      if (!date || !Number.isFinite(total) || total <= 0 || !Number.isInteger(orders) || orders <= 0) {
        throw new Error(`Fila ${index + 1}: fecha, total o pedidos invalidos.`);
      }

      return [
        {
          date,
          provider,
          total,
          orders,
          hour,
          notes: notes.join(" ")
        }
      ];
    });
}

function normalizeProvider(value: string | undefined): PortalProvider {
  const normalized = (value ?? "").toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("pedido")) {
    return "pedidosya";
  }
  if (normalized.includes("rappi")) {
    return "rappi";
  }
  return "otro";
}

function normalizeDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) {
    return null;
  }
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function normalizeHour(value: string | undefined) {
  if (!value) {
    return null;
  }
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return value;
  }
  if (/^\d{1,2}$/.test(value)) {
    const hour = value.padStart(2, "0");
    return /^([01]\d|2[0-3])$/.test(hour) ? `${hour}:00` : null;
  }
  return null;
}

function parseMoneyInput(value: string | undefined) {
  let cleaned = (value ?? "").replace(/[^\d,.-]/g, "");
  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  if (commaIndex > dotIndex) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dotCount > 1 && commaIndex === -1) {
    cleaned = cleaned.replace(/\./g, "");
  } else if (dotIndex > commaIndex) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(/\./g, "");
  }

  return Number(cleaned);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

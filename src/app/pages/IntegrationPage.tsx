import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, CheckCircle2, FileSpreadsheet, LockKeyhole, Server, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { invalidateDulceHoraReporting } from "../dulceHoraDetails";
import { useDulceHoraImportJob } from "../dulceHoraImportJob";
import { canRunDulceHoraDateSyncFromThisHost } from "../runtime";

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

type PortalProvider = "pedidosya" | "rappi" | "otro";
type PortalPaymentKind = "online" | "cash";

type PortalSalesRow = {
  date: string;
  provider: PortalProvider;
  paymentKind?: PortalPaymentKind;
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
  const importJob = useDulceHoraImportJob();
  const [date, setDate] = useState(() => todayArgentina());
  const canRunSelectedDateSync = canRunDulceHoraDateSyncFromThisHost(date);
  const selectedDateIsToday = date === todayArgentina();
  const selectedImport = importJob.state.date === date ? importJob.state : null;
  const runningSelectedDate = Boolean(selectedImport?.active);
  const runningAnotherDate = importJob.state.active && importJob.state.date !== date;
  const [portalForm, setPortalForm] = useState({
    provider: "pedidosya" as PortalProvider,
    paymentKind: "online" as PortalPaymentKind,
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

  const portalImport = useMutation({
    mutationFn: (rows: PortalSalesRow[]) =>
      api<PortalSalesImportResult>("/api/imports/portal-sales", {
        method: "POST",
        body: JSON.stringify({ rows })
    }),
    onSuccess: async () => {
      setPortalError(null);
      await invalidateDulceHoraReporting(queryClient);
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
        paymentKind: portalForm.paymentKind,
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
          Sincronizar facturacion por fecha
        </h2>

        <div className="sync-form">
          <label>
            Fecha
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={importJob.state.active || !status.data?.credentialsConfigured || !canRunSelectedDateSync}
            onClick={() => {
              void importJob.startImport({ date, maxRuns: 55 });
            }}
            type="button"
          >
            <CalendarSync size={18} aria-hidden="true" />
            {runningSelectedDate
              ? selectedImport?.phase === "syncing"
                ? "Sincronizando..."
                : "Completando productos..."
              : runningAnotherDate
                ? "Importacion en curso..."
                : "Tomar ventas desde Dulce Hora"}
          </button>
        </div>

        {!status.data?.credentialsConfigured ? (
          <p className="form-error">
            Faltan las variables DULCE_HORA_USERNAME y DULCE_HORA_PASSWORD en el entorno del
            backend online.
          </p>
        ) : null}
        {!canRunSelectedDateSync ? (
          <p className="form-error">Esta fecha no esta habilitada para sincronizacion online.</p>
        ) : null}

        {runningAnotherDate ? (
          <div className="form-warning">
            <strong>Importacion en segundo plano</strong>
            <span>
              Hay una importacion corriendo para {formatDate(importJob.state.date)}. Podes salir de esta pantalla y seguir usando la app.
            </span>
          </div>
        ) : null}

        {selectedImport?.phase === "error" ? <p className="form-error">{selectedImport.error}</p> : null}

        {selectedImport?.recordsReceived !== null && selectedImport?.recordsReceived !== undefined ? (
          <div className="sync-result">
            <strong>{selectedImport.active ? "Sincronizacion en curso" : "Sincronizacion terminada"}</strong>
            <span>{selectedImport.recordsReceived} comprobantes leidos</span>
            <span>{selectedImport.recordsCreated ?? 0} nuevos</span>
            <span>{selectedImport.recordsUpdated ?? 0} actualizados</span>
            <span>{selectedImport.recordsRejected ?? 0} rechazados</span>
          </div>
        ) : null}
        {selectedImport?.warnings.length ? (
          <div className="form-warning">
            <strong>Advertencias</strong>
            {selectedImport.warnings.slice(-3).map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}
        {selectedImport && (selectedImport.phase === "details" || selectedImport.detailItemRows > 0 || selectedImport.error) ? (
          <div className={selectedImport.error ? "form-error" : "form-warning"}>
            <strong>{selectedImport.active ? "Completando productos" : "Detalle de productos actualizado"}</strong>
            {selectedImport.active ? (
              <span>
                Tanda {selectedImport.detailRun}: {selectedImport.detailItemRows} items de producto cargados.
              </span>
            ) : (
              <span>{selectedImport.detailItemRows} items de producto cargados.</span>
            )}
            {selectedImport.detailRemaining !== null ? (
              <span>
                {selectedImport.detailRemaining === 0
                  ? "Productos completos para la fecha."
                  : `Quedan ${selectedImport.detailRemaining} comprobantes por completar.`}
              </span>
            ) : null}
            {selectedImport.error ? <span>{selectedImport.error}</span> : null}
          </div>
        ) : null}

        <div className="form-warning">
          <strong>Datos guardados en Neon</strong>
          <span>
            Los dias ya importados quedan guardados en Neon y la app los lee desde la base online.
          </span>
          <span>
            {selectedDateIsToday
              ? "El dia en curso se puede tomar desde Dulce Hora y actualizar en Neon desde Netlify."
              : "Para fechas anteriores, reintenta solo el dia que quieras corregir; no hace falta volver a cargar meses cerrados."}
          </span>
        </div>
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
                  provider: event.target.value as PortalProvider,
                  paymentKind: event.target.value === "pedidosya" ? current.paymentKind : "online"
                }))
              }
            >
              <option value="pedidosya">Pedidos Ya</option>
              <option value="rappi">Rappi</option>
              <option value="otro">Otro portal</option>
            </select>
          </label>
          <label>
            Tipo cobro
            <select
              value={portalForm.paymentKind}
              onChange={(event) => setPortalForm((current) => ({ ...current, paymentKind: event.target.value as PortalPaymentKind }))}
            >
              <option value="online">Online / plataforma</option>
              <option value="cash">Efectivo</option>
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
              placeholder="2026-07-12;pedidosya;online;150000;22;20:00"
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

function parsePortalCsv(value: string): PortalSalesRow[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const separator = line.includes(";") ? ";" : ",";
      const parts = line
        .split(separator)
        .map((part) => part.trim());
      const [rawDate, rawProvider] = parts;
      const maybePaymentKind = normalizePaymentKind(parts[2]);
      const rawPaymentKind = maybePaymentKind ?? "online";
      const rawTotal = maybePaymentKind ? parts[3] : parts[2];
      const rawOrders = maybePaymentKind ? parts[4] : parts[3];
      const rawHour = maybePaymentKind ? parts[5] : parts[4];
      const notes = maybePaymentKind ? parts.slice(6) : parts.slice(5);

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
          paymentKind: rawPaymentKind,
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

function normalizePaymentKind(value: string | undefined): PortalPaymentKind | null {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (["online", "plataforma", "app", "tarjeta"].includes(normalized)) {
    return "online";
  }
  if (["efectivo", "cash"].includes(normalized)) {
    return "cash";
  }
  return null;
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

function formatDate(value: string | null) {
  if (!value) {
    return "otra fecha";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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

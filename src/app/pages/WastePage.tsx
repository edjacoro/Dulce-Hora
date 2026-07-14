import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Download, PackageSearch, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, type WasteRecord, type WasteSummary } from "../api";
import { downloadWastePdf } from "../reportPdf";

type WasteResponse = {
  records: WasteRecord[];
};

type PeriodMode = "day" | "range";

export function WastePage() {
  const [mode, setMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [from, setFrom] = useState(() => monthStart());
  const [to, setTo] = useState(() => today());
  const effectiveFrom = mode === "day" ? selectedDate : from;
  const effectiveTo = mode === "day" ? selectedDate : to;
  const query = dateQuery(effectiveFrom, effectiveTo);
  const recordsQuery = query ? `${query}&limit=160` : "?limit=160";

  const summary = useQuery({
    queryKey: ["waste-summary", effectiveFrom, effectiveTo],
    queryFn: () => api<WasteSummary>(`/api/waste/summary${query}`)
  });
  const waste = useQuery({
    queryKey: ["waste-records", effectiveFrom, effectiveTo],
    queryFn: () => api<WasteResponse>(`/api/waste/records${recordsQuery}`)
  });

  const records = waste.data?.records ?? [];
  const stats = summary.data?.summary;
  const isDayMode = mode === "day";
  const activePeriodLabel = isDayMode ? formatFullDate(selectedDate) : `${from} al ${to}`;

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Mermas</h1>
          <p>Desperdicios sincronizados desde Dulce Hora</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            disabled={!summary.data}
            onClick={() => {
              if (summary.data) void downloadWastePdf(summary.data, records, activePeriodLabel);
            }}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            PDF
          </button>
          <PeriodControls
            mode={mode}
            selectedDate={selectedDate}
            from={from}
            to={to}
            onMode={setMode}
            onDate={setSelectedDate}
            onFrom={setFrom}
            onTo={setTo}
          />
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi
          icon={Trash2}
          label={isDayMode ? "Costo de merma del dia" : "Costo de merma"}
          value={formatCurrency(stats?.totalCost ?? 0)}
          tone="red"
        />
        <Kpi icon={ReceiptText} label="Lineas" value={stats?.records ?? 0} tone="blue" />
        <Kpi icon={CalendarDays} label="Registros" value={stats?.events ?? 0} tone="green" />
        <Kpi icon={PackageSearch} label="Productos" value={stats?.products ?? 0} tone="amber" />
      </div>

      {records.length === 0 ? (
        <section className="content-band">
          <div className="empty-state">
            <Trash2 size={22} aria-hidden="true" />
            <div>
              <h2>Sin mermas cargadas</h2>
              <p>Sincroniza una fecha en Importaciones para traer los desperdicios del panel.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="split-layout">
            <section className="content-band compact-band">
              <h2>
                <PackageSearch size={18} aria-hidden="true" />
                Productos con mayor merma
              </h2>
              <BarList
                rows={(summary.data?.topProducts ?? []).map((row) => ({
                  label: row.label,
                  total: row.total,
                  detail: `${formatNumber(Number(row.quantity))} unidades - ${row.category}`
                }))}
              />
            </section>

            <section className="content-band compact-band">
              <h2>
                <CalendarDays size={18} aria-hidden="true" />
                Merma por dia
              </h2>
              <BarList rows={summary.data?.byDate ?? []} showWastePercent />
            </section>
          </div>

          <section className="content-band">
            <h2>
              <Trash2 size={18} aria-hidden="true" />
              Detalle de mermas
            </h2>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Categoria</th>
                    <th>Cantidad</th>
                    <th>Costo unitario</th>
                    <th>Total</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.product_name ?? "Sin producto"}</td>
                      <td>{record.category_name ?? "Sin categoria"}</td>
                      <td>{formatNumber(Number(record.quantity))}</td>
                      <td>{formatCurrency(Number(record.unit_cost ?? 0))}</td>
                      <td>{formatCurrency(Number(record.total_cost ?? 0))}</td>
                      <td>{record.user_name ?? "Sin dato"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

type DateFiltersProps = {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
};

type PeriodControlsProps = DateFiltersProps & {
  mode: PeriodMode;
  selectedDate: string;
  onMode: (value: PeriodMode) => void;
  onDate: (value: string) => void;
};

function PeriodControls({
  mode,
  selectedDate,
  from,
  to,
  onMode,
  onDate,
  onFrom,
  onTo
}: PeriodControlsProps) {
  return (
    <div className="period-controls">
      <div className="control-tabs" aria-label="Modo de fechas">
        <button
          className={`mode-tab ${mode === "day" ? "active" : ""}`}
          onClick={() => onMode("day")}
          type="button"
        >
          Dia
        </button>
        <button
          className={`mode-tab ${mode === "range" ? "active" : ""}`}
          onClick={() => onMode("range")}
          type="button"
        >
          Intervalo
        </button>
      </div>

      {mode === "day" ? (
        <div className="day-nav">
          <button
            className="nav-button"
            onClick={() => onDate(shiftDate(selectedDate, -1))}
            type="button"
            aria-label="Dia anterior"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{formatFullDate(selectedDate)}</strong>
            <input type="date" value={selectedDate} onChange={(event) => onDate(event.target.value)} />
          </div>
          <button
            className="nav-button"
            onClick={() => onDate(shiftDate(selectedDate, 1))}
            type="button"
            aria-label="Dia siguiente"
          >
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <DateFilters from={from} to={to} onFrom={onFrom} onTo={onTo} />
      )}
    </div>
  );
}

function DateFilters({ from, to, onFrom, onTo }: DateFiltersProps) {
  return (
    <div className="date-filter">
      <label>
        Desde
        <input type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      </label>
      <label>
        Hasta
        <input type="date" value={to} onChange={(event) => onTo(event.target.value)} />
      </label>
    </div>
  );
}

type KpiProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: "red" | "blue" | "green" | "amber";
};

function Kpi({ icon: Icon, label, value, tone }: KpiProps) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type BarListRow = {
  label: string;
  total: string;
  detail?: string;
  wastePercent?: number | null;
  sales?: string;
};

function BarList({ rows, showWastePercent = false }: { rows: BarListRow[]; showWastePercent?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total)));
  if (rows.length === 0) {
    return <p className="muted-text">Sin datos en el rango seleccionado.</p>;
  }

  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = Number(row.total);
        return (
          <div className="bar-row" key={row.label}>
            <span>
              {isIsoDate(row.label) ? formatShortDate(row.label) : row.label}
              {showWastePercent ? <WastePercentBadge value={row.wastePercent ?? null} /> : null}
              {row.detail ? <small>{row.detail}</small> : null}
            </span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <strong>{formatCurrency(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function WastePercentBadge({ value }: { value: number | null }) {
  if (value === null) return <small className="waste-percent-badge unknown">Sin venta</small>;
  return <small className={`waste-percent-badge ${wasteTone(value)}`}>{formatPercent(value)}</small>;
}

function wasteTone(value: number) {
  if (value < 2.5) return "low";
  if (value < 3) return "watch";
  if (value < 6) return "critical";
  return "grave";
}

function dateQuery(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const value = params.toString();
  return value ? `?${value}` : "";
}

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthStart() {
  return `${today().slice(0, 8)}01`;
}

function shiftDate(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + delta);
  return formatDateInput(date);
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatFullDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date).replace(".", "");
  return `${capitalize(weekday)} ${day}/${month}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}

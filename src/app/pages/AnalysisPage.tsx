import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Download,
  PackageSearch,
  ReceiptText,
  Users,
  WalletCards
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { api, type AnalysisDashboard } from "../api";
import { downloadAnalysisPdf } from "../reportPdf";

type AnalysisReport = AnalysisDashboard["filters"]["report"];
type AnalysisMetric = AnalysisDashboard["filters"]["metric"];

const weekdayOptions = [
  { value: "all", label: "Todos" },
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miercoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sabado" }
];

export function AnalysisPage() {
  const [report, setReport] = useState<AnalysisReport>("hour");
  const [metric, setMetric] = useState<AnalysisMetric>("revenue");
  const [from, setFrom] = useState(() => monthStart(today()));
  const [to, setTo] = useState(() => today());
  const [weekday, setWeekday] = useState("all");
  const [hourFrom, setHourFrom] = useState(7);
  const [hourTo, setHourTo] = useState(20);
  const [employeeId, setEmployeeId] = useState("all");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      report,
      metric,
      from,
      to,
      weekday,
      hourFrom: String(hourFrom),
      hourTo: String(hourTo),
      employeeId
    });
    return `?${params.toString()}`;
  }, [employeeId, from, hourFrom, hourTo, metric, report, to, weekday]);

  const analysis = useQuery({
    queryKey: ["analysis-sales", report, metric, from, to, weekday, hourFrom, hourTo, employeeId],
    queryFn: () => api<AnalysisDashboard>(`/api/analysis/sales${query}`)
  });

  const data = analysis.data;
  const maxValue = Math.max(1, ...(data?.segments ?? []).map((row) => metricValue(row, metric)));
  const topSegments = (data?.segments ?? []).slice(0, 12);
  const activePeriodLabel = periodLabel(from, to);

  return (
    <section className="page-section analysis-page">
      <div className="page-heading">
        <div>
          <h1>Analisis</h1>
          <p>Ventas cruzadas por horario, empleado, dia de semana, productos y cobertura.</p>
        </div>
        <button
          className="secondary-button"
          disabled={!data}
          onClick={() => {
            if (data) void downloadAnalysisPdf(data, activePeriodLabel);
          }}
          type="button"
        >
          <Download size={18} aria-hidden="true" />
          PDF
        </button>
      </div>

      <section className="content-band">
        <div className="analysis-filter-grid">
          <Field label="Informe">
            <select value={report} onChange={(event) => setReport(event.target.value as AnalysisReport)}>
              <option value="hour">Por horario</option>
              <option value="employee">Por empleado</option>
              <option value="weekday">Por dia de semana</option>
            </select>
          </Field>
          <Field label="Desde">
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Field label="Dia">
            <select value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {weekdayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hora desde">
            <input
              min={0}
              max={23}
              type="number"
              value={hourFrom}
              onChange={(event) => setHourFrom(clampHour(event.target.value))}
            />
          </Field>
          <Field label="Hora hasta">
            <input
              min={0}
              max={23}
              type="number"
              value={hourTo}
              onChange={(event) => setHourTo(clampHour(event.target.value))}
            />
          </Field>
          <Field label="Empleado">
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="all">Todos</option>
              {(data?.employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medida del grafico">
            <select value={metric} onChange={(event) => setMetric(event.target.value as AnalysisMetric)}>
              <option value="revenue">Dinero</option>
              <option value="tickets">Pedidos</option>
              <option value="items">Productos</option>
            </select>
          </Field>
        </div>
      </section>

      {analysis.isLoading ? (
        <section className="content-band">
          <p className="muted-text">Cargando analisis...</p>
        </section>
      ) : null}
      {analysis.error ? <p className="form-error">{analysis.error.message}</p> : null}

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Venta filtrada" value={formatCurrency(data.summary.revenue)} tone="red" />
            <Kpi icon={ReceiptText} label="Pedidos" value={formatInteger(data.summary.tickets)} tone="blue" />
            <Kpi icon={BarChart3} label="Ticket promedio" value={formatCurrency(data.summary.averageTicket)} tone="green" />
            <Kpi icon={PackageSearch} label="Unidades" value={formatNumber(data.summary.itemUnits)} tone="amber" />
            <Kpi icon={CalendarDays} label="Dias medidos" value={formatInteger(data.summary.activeDays)} />
          </div>

          <section className="content-band">
            <div className="table-heading">
              <h2>{reportTitle(report)}</h2>
              <span className="period-chip">{activePeriodLabel}</span>
            </div>
            {topSegments.length === 0 ? (
              <p className="muted-text">Sin ventas para los filtros seleccionados.</p>
            ) : (
              <div className="analysis-bars">
                {topSegments.map((row) => (
                  <div
                    className="analysis-bar-row"
                    key={row.key}
                    style={{ "--bar-color": row.color ?? undefined } as CSSProperties}
                  >
                    <div>
                      <strong>{row.label}</strong>
                      <span>
                        {formatCurrency(row.revenue)} - {formatInteger(row.tickets)} pedidos -{" "}
                        {formatNumber(row.itemUnits)} un.
                      </span>
                    </div>
                    <div className="analysis-bar-track">
                      <span style={{ width: `${Math.max(3, (metricValue(row, metric) / maxValue) * 100)}%` }} />
                    </div>
                    <strong>{formatMetric(metricValue(row, metric), metric)}</strong>
                  </div>
                ))}
              </div>
            )}
            {report === "employee" ? (
              <p className="muted-text small-note">
                En empleado, una venta se atribuye completa a cada persona que cubria ese horario.
              </p>
            ) : null}
          </section>

          <div className="analysis-grid">
            <section className="content-band">
              <div className="table-heading">
                <h2>Productos destacados</h2>
                <span className="period-chip">top venta</span>
              </div>
              <div className="analysis-product-list">
                {data.topProducts.length === 0 ? (
                  <p className="muted-text">Sin productos para este filtro.</p>
                ) : (
                  data.topProducts.slice(0, 8).map((product) => (
                    <div className="analysis-product-row" key={`${product.label}-${product.category}`}>
                      <div>
                        <strong>{product.label}</strong>
                        <span>{product.category}</span>
                      </div>
                      <strong>{formatCurrency(product.revenue)}</strong>
                      <span>{formatNumber(product.quantity)} un.</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="content-band">
              <div className="table-heading">
                <h2>Lectura rapida</h2>
                <span className="period-chip">{metricLabel(metric)}</span>
              </div>
              <div className="analysis-callouts">
                <Callout
                  icon={Users}
                  label="Filtro empleado"
                  value={employeeName(data, employeeId)}
                  detail="Cruza ventas contra grilla horaria."
                />
                <Callout
                  icon={CalendarDays}
                  label="Filtro dia"
                  value={weekdayName(weekday)}
                  detail={`${String(data.filters.hourFrom).padStart(2, "0")}:00 a ${String(data.filters.hourTo).padStart(2, "0")}:59`}
                />
              </div>
            </section>
          </div>

          <section className="content-band">
            <div className="table-heading">
              <h2>Detalle por segmento</h2>
              <span className="period-chip">ordenado por {metricLabel(metric).toLowerCase()}</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Segmento</th>
                    <th>Venta</th>
                    <th>Pedidos</th>
                    <th>Unidades</th>
                    <th>Ticket prom.</th>
                    <th>Unid./ticket</th>
                    <th>Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.segments.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.label}</strong>
                      </td>
                      <td>{formatCurrency(row.revenue)}</td>
                      <td>{formatInteger(row.tickets)}</td>
                      <td>{formatNumber(row.itemUnits)}</td>
                      <td>{formatCurrency(row.averageTicket)}</td>
                      <td>{formatNumber(row.unitsPerTicket)}</td>
                      <td>{formatPercent(row.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "slate"
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  tone?: "red" | "blue" | "green" | "amber" | "slate";
}) {
  return (
    <article className="kpi-card">
      <Icon className={`tone-${tone}`} size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Callout({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="analysis-callout">
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function metricValue(row: AnalysisDashboard["segments"][number], metric: AnalysisMetric) {
  if (metric === "tickets") return row.tickets;
  if (metric === "items") return row.itemUnits;
  return row.revenue;
}

function formatMetric(value: number, metric: AnalysisMetric) {
  if (metric === "revenue") return formatCurrency(value);
  if (metric === "tickets") return formatInteger(value);
  return formatNumber(value);
}

function reportTitle(report: AnalysisReport) {
  if (report === "employee") return "Venta por empleado";
  if (report === "weekday") return "Venta por dia de semana";
  return "Venta por segmento horario";
}

function metricLabel(metric: AnalysisMetric) {
  if (metric === "tickets") return "Pedidos";
  if (metric === "items") return "Productos";
  return "Dinero";
}

function employeeName(data: AnalysisDashboard, employeeId: string) {
  if (employeeId === "all") return "Todos";
  return data.employees.find((employee) => employee.id === employeeId)?.name ?? "Empleado seleccionado";
}

function weekdayName(value: string) {
  return weekdayOptions.find((option) => option.value === value)?.label ?? "Todos";
}

function clampHour(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(23, Math.trunc(parsed)));
}

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function periodLabel(from: string, to: string) {
  return from === to ? longDate(from) : `${shortDate(from)} a ${shortDate(to)}`;
}

function longDate(value: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function shortDate(value: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

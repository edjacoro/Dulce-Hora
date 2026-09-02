import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  PackageSearch,
  PackageX,
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
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [hourFrom, setHourFrom] = useState(7);
  const [hourTo, setHourTo] = useState(20);
  const [employeeId, setEmployeeId] = useState("all");
  const weekdayParam = weekdays.length === 0 ? "all" : weekdays.join(",");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      report,
      metric,
      from,
      to,
      weekdays: weekdayParam,
      hourFrom: String(hourFrom),
      hourTo: String(hourTo),
      employeeId
    });
    return `?${params.toString()}`;
  }, [employeeId, from, hourFrom, hourTo, metric, report, to, weekdayParam]);

  const analysis = useQuery({
    queryKey: ["analysis-sales", report, metric, from, to, weekdayParam, hourFrom, hourTo, employeeId],
    queryFn: () => api<AnalysisDashboard>(`/api/analysis/sales${query}`)
  });

  const data = analysis.data;
  const maxValue = Math.max(1, ...(data?.segments ?? []).map((row) => metricValue(row, metric)));
  const topSegments = (data?.segments ?? []).slice(0, 12);
  const activePeriodLabel = periodLabel(from, to);
  const filterLabel = `${activePeriodLabel} - ${weekdaysLabel(weekdays)} - ${String(hourFrom).padStart(2, "0")}:00 a ${String(hourTo).padStart(2, "0")}:59 - ${data ? employeeName(data, employeeId) : "Todos"}`;

  return (
    <section className="page-section analysis-page">
      <div className="page-heading">
        <div>
          <h1>Analisis</h1>
          <p>Ventas cruzadas por horario, empleado, dia de semana, productos y cobertura.</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            disabled={!data}
            onClick={() => {
              if (data) downloadAnalysisCsv(data, activePeriodLabel);
            }}
            type="button"
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            CSV
          </button>
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
      </div>

      <section className="content-band">
        <div className="analysis-filter-grid">
          <Field label="Informe">
            <select value={report} onChange={(event) => setReport(event.target.value as AnalysisReport)}>
              <option value="hour">Por horario</option>
              <option value="day">Por dia</option>
              <option value="weekday">Por dia de semana</option>
              <option value="product">Por producto</option>
              <option value="employee">Por empleado</option>
            </select>
          </Field>
          <Field label="Desde">
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <div className="field weekday-picker">
            <span>Dia</span>
            <div className="weekday-toggle-grid">
              <button
                className={`weekday-toggle ${weekdays.length === 0 ? "active" : ""}`}
                onClick={() => setWeekdays([])}
                type="button"
              >
                <span className="fake-check" aria-hidden="true" />
                Todos
              </button>
              {weekdayOptions.map((option) => (
                <button
                  className={`weekday-toggle ${weekdays.includes(option.value) ? "active" : ""}`}
                  key={option.value}
                  onClick={() => setWeekdays((current) => toggleWeekday(current, option.value))}
                  type="button"
                >
                  <span className="fake-check" aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
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

      <p className="analysis-filter-summary">{filterLabel}</p>

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
                <h2>
                  <PackageX size={18} aria-hidden="true" />
                  Productos sin venta
                </h2>
                <span className="period-chip">catalogo activo</span>
              </div>
              <div className="analysis-product-list">
                {(data.noSaleProducts ?? []).length === 0 ? (
                  <p className="muted-text">Todos los productos activos tuvieron venta en este filtro.</p>
                ) : (
                  data.noSaleProducts.slice(0, 10).map((product) => (
                    <div className="analysis-product-row muted-product-row" key={`${product.label}-${product.category}`}>
                      <div>
                        <strong>{product.label}</strong>
                        <span>{product.category}</span>
                      </div>
                      <span>{product.lastSaleDate ? `Ult. ${shortDate(product.lastSaleDate)}` : "Sin venta previa"}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="content-band">
              <div className="table-heading">
                <h2>Top mermas</h2>
                <span className="period-chip">top 5</span>
              </div>
              <div className="analysis-product-list">
                {(data.topWasteProducts ?? []).length === 0 ? (
                  <p className="muted-text">Sin mermas de productos para este filtro.</p>
                ) : (
                  data.topWasteProducts.map((product) => (
                    <div className="analysis-product-row" key={`${product.label}-${product.category}-waste`}>
                      <div>
                        <strong>{product.label}</strong>
                        <span>{product.category}</span>
                      </div>
                      <strong>{formatCurrency(product.totalCost)}</strong>
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
                  value={weekdaysLabel(weekdays)}
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

function toggleWeekday(current: string[], value: string) {
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  if (next.length === 0 || next.length === weekdayOptions.length) return [];
  return next.sort((a, b) => Number(a) - Number(b));
}

function weekdaysLabel(values: string[]) {
  if (values.length === 0) return "Todos los dias";
  return values.map((value) => weekdayOptions.find((option) => option.value === value)?.label ?? value).join(", ");
}

function downloadAnalysisCsv(data: AnalysisDashboard, periodLabel: string) {
  const rows = [
    ["Segmento", "Venta", "Pedidos", "Unidades", "Ticket prom.", "Unid./ticket", "Participacion"],
    ...data.segments.map((row) => [
      row.label,
      row.revenue,
      row.tickets,
      row.itemUnits,
      Math.round(row.averageTicket * 100) / 100,
      Math.round(row.unitsPerTicket * 100) / 100,
      Math.round(row.share * 10) / 10
    ]),
    [],
    ["Productos destacados"],
    ["Producto", "Categoria", "Unidades", "Venta", "Tickets"],
    ...data.topProducts.map((row) => [row.label, row.category, row.quantity, row.revenue, row.tickets]),
    [],
    ["Top 5 productos con mas merma"],
    ["Producto", "Categoria", "Unidades", "Merma", "Registros"],
    ...(data.topWasteProducts ?? []).map((row) => [row.label, row.category, row.quantity, row.totalCost, row.records]),
    [],
    ["Productos sin venta"],
    ["Producto", "Categoria", "Ultima venta"],
    ...(data.noSaleProducts ?? []).map((row) => [row.label, row.category, row.lastSaleDate ?? ""])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `analisis-${filenamePeriod(periodLabel)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function filenamePeriod(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
  if (report === "product") return "Venta por producto";
  if (report === "day") return "Venta por dia";
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

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeDollarSign,
  Download,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, type ProductPerformance } from "../api";
import { downloadProductsPdf } from "../reportPdf";

type PeriodMode = "day" | "month" | "range";
type SortDirection = "asc" | "desc";
type ProductRow = ProductPerformance["products"][number];
type ProductSortKey =
  | "label"
  | "revenue"
  | "quantitySold"
  | "tickets"
  | "share"
  | "averageUnitPrice"
  | "wasteCost"
  | "wasteRate"
  | "netAfterWaste"
  | "signal";

export function ProductsPage() {
  const [mode, setMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [selectedMonth, setSelectedMonth] = useState(() => today().slice(0, 7));
  const [from, setFrom] = useState(() => monthStart());
  const [to, setTo] = useState(() => today());
  const [sort, setSort] = useState<{ key: ProductSortKey; direction: SortDirection }>({
    key: "revenue",
    direction: "desc"
  });
  const period = useMemo(
    () => periodRange({ mode, selectedDate, selectedMonth, from, to }),
    [mode, selectedDate, selectedMonth, from, to]
  );
  const query = dateQuery(period.from, period.to);
  const performance = useQuery({
    queryKey: ["product-performance", period.from, period.to],
    queryFn: () => api<ProductPerformance>(`/api/products/performance${query}&limit=200`)
  });

  const data = performance.data;
  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const sortedProducts = useMemo(() => sortProducts(products, sort), [products, sort]);
  const stars = products
    .filter((product) => product.signalTone === "green")
    .slice(0, 5);
  const wasteRisks = [...products]
    .filter((product) => product.wasteRate >= 3 || product.signalTone === "red")
    .sort((a, b) => b.wasteRate - a.wasteRate || b.wasteCost - a.wasteCost)
    .slice(0, 5);
  const lowRotation = [...products]
    .filter((product) => product.revenue > 0 && product.share < 1.2)
    .sort((a, b) => a.share - b.share || b.wasteCost - a.wasteCost)
    .slice(0, 5);
  const activePeriodLabel = periodLabel(mode, period.from, period.to);

  return (
    <section className="page-section products-page">
      <div className="page-heading">
        <div>
          <h1>Productos</h1>
          <p>Ranking de ventas, rotacion y merma cruzada por producto</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            disabled={!data}
            onClick={() => {
              if (data) void downloadProductsPdf(data, activePeriodLabel);
            }}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            PDF
          </button>
          <ProductPeriodControls
            mode={mode}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            from={from}
            to={to}
            onMode={setMode}
            onDate={setSelectedDate}
            onMonth={setSelectedMonth}
            onFrom={setFrom}
            onTo={setTo}
          />
        </div>
      </div>

      {performance.isLoading ? (
        <section className="content-band">
          <p className="muted-text">Cargando productos...</p>
        </section>
      ) : null}
      {performance.error ? <p className="form-error">{performance.error.message}</p> : null}

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi
              icon={BadgeDollarSign}
              label="Venta productos"
              value={formatCurrency(data.summary.revenue)}
              tone="blue"
            />
            <Kpi icon={ShoppingBag} label="Unidades vendidas" value={formatNumber(data.summary.quantitySold)} />
            <Kpi icon={PackageSearch} label="Productos vendidos" value={data.summary.soldProducts} tone="green" />
            <Kpi icon={ReceiptText} label="Tickets con productos" value={formatInteger(data.summary.tickets)} />
            <Kpi icon={Trash2} label="Merma asociada" value={formatCurrency(data.summary.wasteCost)} tone="red" />
            <Kpi
              icon={TrendingUp}
              label="Merma / venta"
              value={formatPercent(data.summary.wasteRate)}
              tone={wasteKpiTone(data.summary.wasteRate)}
            />
          </div>

          <div className="product-insight-grid">
            <InsightPanel
              icon={Star}
              title="Productos estrella"
              empty="Sin productos estrella en este periodo."
              rows={stars.map((product) => ({
                label: product.label,
                value: formatCurrency(product.revenue),
                detail: `${formatPercent(product.share)} de venta - merma ${formatPercent(product.wasteRate)}`
              }))}
            />
            <InsightPanel
              icon={Trash2}
              title="Vigilar merma"
              empty="Sin alertas de merma en este periodo."
              rows={wasteRisks.map((product) => ({
                label: product.label,
                value: formatPercent(product.wasteRate),
                detail: `${formatCurrency(product.wasteCost)} sobre ${formatCurrency(product.revenue)}`
              }))}
            />
            <InsightPanel
              icon={PackageSearch}
              title="Baja rotacion"
              empty="Sin baja rotacion visible en este periodo."
              rows={lowRotation.map((product) => ({
                label: product.label,
                value: formatPercent(product.share),
                detail: `${formatCurrency(product.revenue)} - ${formatNumber(product.quantitySold)} unidades`
              }))}
            />
          </div>

          <section className="content-band">
            <div className="table-heading">
              <h2>Estado por producto</h2>
              <span className="period-chip">{activePeriodLabel}</span>
            </div>
            {products.length === 0 ? (
              <div className="dashed-empty">Sin ventas ni mermas de productos en este periodo.</div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table product-table">
                  <thead>
                    <tr>
                      <SortableTh<ProductSortKey> label="Producto" sortKey="label" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Venta" sortKey="revenue" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Unidades" sortKey="quantitySold" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Tickets" sortKey="tickets" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Part." sortKey="share" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey>
                        label="Precio prom."
                        sortKey="averageUnitPrice"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<ProductSortKey> label="Merma" sortKey="wasteCost" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Merma %" sortKey="wasteRate" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Neto" sortKey="netAfterWaste" sort={sort} onSort={setSort} />
                      <SortableTh<ProductSortKey> label="Senal" sortKey="signal" sort={sort} onSort={setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product) => (
                      <tr key={product.productKey}>
                        <td>
                          <strong>{product.label}</strong>
                          <span className="cell-muted">{product.category}</span>
                        </td>
                        <td>
                          {formatCurrency(product.revenue)}
                          <Meter value={product.share} max={100} />
                        </td>
                        <td>{formatNumber(product.quantitySold)}</td>
                        <td>{formatInteger(product.tickets)}</td>
                        <td>{formatPercent(product.share)}</td>
                        <td>{formatCurrency(product.averageUnitPrice)}</td>
                        <td>
                          {formatCurrency(product.wasteCost)}
                          <span className="cell-muted">{formatNumber(product.wasteQuantity)} un.</span>
                        </td>
                        <td>
                          <WastePercentBadge value={product.wasteRate} />
                        </td>
                        <td className={product.netAfterWaste >= 0 ? "positive-text" : "negative-text"}>
                          {formatCurrency(product.netAfterWaste)}
                        </td>
                        <td>
                          <span className={`signal-pill ${product.signalTone}`}>{product.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function SortableTh<TSortKey extends string>({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: TSortKey;
  sort: { key: TSortKey; direction: SortDirection };
  onSort: (value: { key: TSortKey; direction: SortDirection }) => void;
}) {
  const active = sort.key === sortKey;
  const direction = active ? sort.direction : "desc";
  return (
    <th>
      <button
        className={`sortable-header ${active ? "active" : ""}`}
        onClick={() => {
          onSort({
            key: sortKey,
            direction: active && sort.direction === "desc" ? "asc" : "desc"
          });
        }}
        type="button"
      >
        <span>{label}</span>
        {active ? <span className="sort-indicator">{direction === "desc" ? "↓" : "↑"}</span> : <ArrowUpDown size={13} />}
      </button>
    </th>
  );
}

function ProductPeriodControls({
  mode,
  selectedDate,
  selectedMonth,
  from,
  to,
  onMode,
  onDate,
  onMonth,
  onFrom,
  onTo
}: {
  mode: PeriodMode;
  selectedDate: string;
  selectedMonth: string;
  from: string;
  to: string;
  onMode: (value: PeriodMode) => void;
  onDate: (value: string) => void;
  onMonth: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="period-controls">
      <div className="control-tabs" aria-label="Modo de fechas">
        <button className={`mode-tab ${mode === "day" ? "active" : ""}`} onClick={() => onMode("day")} type="button">
          Dia
        </button>
        <button
          className={`mode-tab ${mode === "month" ? "active" : ""}`}
          onClick={() => onMode("month")}
          type="button"
        >
          Mes
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
          <button className="nav-button" onClick={() => onDate(shiftDate(selectedDate, -1))} type="button">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{formatFullDate(selectedDate)}</strong>
            <input type="date" value={selectedDate} onChange={(event) => onDate(event.target.value)} />
          </div>
          <button className="nav-button" onClick={() => onDate(shiftDate(selectedDate, 1))} type="button">
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {mode === "month" ? (
        <div className="day-nav">
          <button className="nav-button" onClick={() => onMonth(shiftMonth(selectedMonth, -1))} type="button">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{monthName(selectedMonth)}</strong>
            <input type="month" value={selectedMonth} onChange={(event) => onMonth(event.target.value)} />
          </div>
          <button className="nav-button" onClick={() => onMonth(shiftMonth(selectedMonth, 1))} type="button">
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {mode === "range" ? <DateFilters from={from} to={to} onFrom={onFrom} onTo={onTo} /> : null}
    </div>
  );
}

function DateFilters({
  from,
  to,
  onFrom,
  onTo
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
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

function InsightPanel({
  icon: Icon,
  title,
  rows,
  empty
}: {
  icon: React.ElementType;
  title: string;
  rows: Array<{ label: string; value: string; detail: string }>;
  empty: string;
}) {
  return (
    <section className="content-band compact-band">
      <h2>
        <Icon size={18} aria-hidden="true" />
        {title}
      </h2>
      {rows.length === 0 ? (
        <div className="dashed-empty">{empty}</div>
      ) : (
        <div className="list-stack">
          {rows.map((row) => (
            <div className="list-row horizontal-row" key={row.label}>
              <span>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "red" | "blue" | "green" | "amber" | "slate";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <span className="mini-meter">
      <span className="mini-meter-fill sales" style={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }} />
    </span>
  );
}

function WastePercentBadge({ value }: { value: number }) {
  return <span className={`waste-percent-badge ${wasteTone(value)}`}>{formatPercent(value)}</span>;
}

function wasteKpiTone(value: number): "red" | "green" | "amber" {
  if (value >= 3) return "red";
  if (value >= 2.5) return "amber";
  return "green";
}

function wasteTone(value: number) {
  if (value < 2.5) return "low";
  if (value < 3) return "watch";
  if (value < 6) return "critical";
  return "grave";
}

function periodRange(input: {
  mode: PeriodMode;
  selectedDate: string;
  selectedMonth: string;
  from: string;
  to: string;
}) {
  if (input.mode === "day") {
    return { from: input.selectedDate, to: input.selectedDate };
  }
  if (input.mode === "month") {
    return monthRange(input.selectedMonth);
  }
  return { from: input.from, to: input.to };
}

function dateQuery(from: string, to: string) {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
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

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(days).padStart(2, "0")}`
  };
}

function shiftDate(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + delta);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function periodLabel(mode: PeriodMode, from: string, to: string) {
  if (mode === "day") return formatFullDate(from);
  if (mode === "month") return monthName(from.slice(0, 7));
  return `${from} al ${to}`;
}

function sortProducts(products: ProductRow[], sort: { key: ProductSortKey; direction: SortDirection }) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...products].sort((a, b) => {
    const left = productSortValue(a, sort.key);
    const right = productSortValue(b, sort.key);
    const result =
      typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right), "es-AR")
        : left - right;

    if (result !== 0) return result * direction;
    return a.label.localeCompare(b.label, "es-AR");
  });
}

function productSortValue(product: ProductRow, key: ProductSortKey) {
  const signalWeight: Record<ProductRow["signalTone"], number> = {
    red: 4,
    amber: 3,
    green: 2,
    slate: 1
  };
  switch (key) {
    case "label":
      return product.label;
    case "revenue":
      return product.revenue;
    case "quantitySold":
      return product.quantitySold;
    case "tickets":
      return product.tickets;
    case "share":
      return product.share;
    case "averageUnitPrice":
      return product.averageUnitPrice;
    case "wasteCost":
      return product.wasteCost;
    case "wasteRate":
      return product.wasteRate;
    case "netAfterWaste":
      return product.netAfterWaste;
    case "signal":
      return signalWeight[product.signalTone];
  }
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

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}

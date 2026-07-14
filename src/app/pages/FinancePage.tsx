import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarSync,
  FileDown,
  FileSpreadsheet,
  ListChecks,
  ReceiptText,
  Trash2,
  WalletCards
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, type FinanceDailyRow, type FinanceDashboard, type FinanceMonthRow } from "../api";

type TabId =
  | "hoy"
  | "resumen"
  | "importar"
  | "gastos"
  | "mermas"
  | "diferidos"
  | "mensual"
  | "pnl"
  | "presupuesto";

type SyncResult = {
  date: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  datesSynced?: number;
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

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "resumen", label: "Resumen" },
  { id: "importar", label: "Importar ventas" },
  { id: "gastos", label: "Gastos" },
  { id: "mermas", label: "Mermas" },
  { id: "diferidos", label: "TC / Diferidos" },
  { id: "mensual", label: "Mensual" },
  { id: "pnl", label: "P&L anual" },
  { id: "presupuesto", label: "Presupuesto" }
];

export function FinancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("hoy");
  const [date, setDate] = useState(() => today());
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const updateDate = (nextDate: string) => {
    setDate(nextDate);
    setMonth(nextDate.slice(0, 7));
  };
  const dashboard = useQuery({
    queryKey: ["finance-dashboard", month, date],
    queryFn: () => api<FinanceDashboard>(`/api/finance/dashboard?month=${month}&date=${date}`)
  });

  const sync = useMutation({
    mutationFn: (targetDate: string) =>
      api<SyncResult>("/api/integration/dulce-hora/sync-date", {
        method: "POST",
        body: JSON.stringify({ date: targetDate })
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["integration-status"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-records"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-summary"] })
      ]);
    }
  });
  const syncHistory = useMutation({
    mutationFn: () =>
      api<SyncResult>("/api/integration/dulce-hora/sync-history", {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["integration-status"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-records"] }),
        queryClient.invalidateQueries({ queryKey: ["waste-summary"] })
      ]);
      setActiveTab("mensual");
    }
  });

  const data = dashboard.data;
  const monthRow = useMemo(
    () => data?.monthlyRows.find((row) => row.month === data.month),
    [data]
  );

  return (
    <section className="page-section finance-page">
      <div className="finance-header">
        <div className="finance-title">
          <span>VENTAS - GASTOS - P&L</span>
          <h1>Finanzas</h1>
        </div>

        <FinancePeriodNav
          mode={activeTab === "hoy" ? "day" : "month"}
          date={date}
          month={month}
          onDate={updateDate}
          onMonth={setMonth}
        />

        <div className="finance-projection">
          <span>Proyeccion venta mes</span>
          <strong>{formatCurrency(data?.summary.projection ?? 0)}</strong>
          <small>
            {formatCurrency(monthRow?.sales ?? 0)} acumulado - prom.{" "}
            {formatCurrency(monthRow?.salesPerDay ?? 0)}
          </small>
        </div>

        <div className="finance-tabs" role="tablist" aria-label="Vistas de finanzas">
          {tabs.map((tab) => (
            <button
              className={`finance-tab ${activeTab === tab.id ? "active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <SyncPanel
          data={data}
          pending={sync.isPending || syncHistory.isPending}
          historyPending={syncHistory.isPending}
          onOpenImport={() => setActiveTab("importar")}
          onSyncHistory={() => syncHistory.mutate()}
          onSync={() => sync.mutate(date)}
        />
      </div>

      {dashboard.isLoading ? <LoadingPanel /> : null}
      {dashboard.error ? <p className="form-error">{dashboard.error.message}</p> : null}
      {syncHistory.error ? <p className="form-error">{syncHistory.error.message}</p> : null}
      {syncHistory.data ? (
        <div className="sync-result">
          <strong>Historial sincronizado</strong>
          <span>{syncHistory.data.datesSynced ?? 0} fechas</span>
          <span>{syncHistory.data.recordsReceived} comprobantes</span>
          <span>{syncHistory.data.recordsCreated} nuevos</span>
          <span>{syncHistory.data.recordsUpdated} actualizados</span>
        </div>
      ) : null}

      {data ? (
        <>
          {activeTab === "hoy" ? <TodayView data={data} /> : null}
          {activeTab === "resumen" ? <SummaryView data={data} /> : null}
          {activeTab === "importar" ? (
            <ImportView
              date={date}
              onDate={setDate}
              sync={sync}
              credentialsConfigured={data.credentialsConfigured}
            />
          ) : null}
          {activeTab === "gastos" ? <ExpensesView data={data} /> : null}
          {activeTab === "mermas" ? <WasteFinanceView data={data} /> : null}
          {activeTab === "diferidos" ? <PlaceholderView title="TC / Diferidos" /> : null}
          {activeTab === "mensual" ? <MonthlyView data={data} /> : null}
          {activeTab === "pnl" ? <PnlView data={data} /> : null}
          {activeTab === "presupuesto" ? <PlaceholderView title="Presupuesto" /> : null}
        </>
      ) : null}
    </section>
  );
}

function FinancePeriodNav({
  mode,
  date,
  month,
  onDate,
  onMonth
}: {
  mode: "day" | "month";
  date: string;
  month: string;
  onDate: (value: string) => void;
  onMonth: (value: string) => void;
}) {
  if (mode === "day") {
    return (
      <div className="finance-month-nav day-mode">
        <button
          className="month-button"
          onClick={() => onDate(shiftDate(date, -1))}
          type="button"
          aria-label="Dia anterior"
        >
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
        <span className="finance-date-label">
          <strong>{formatFullDate(date)}</strong>
          <input type="date" value={date} onChange={(event) => onDate(event.target.value)} />
        </span>
        <button
          className="month-button"
          onClick={() => onDate(shiftDate(date, 1))}
          type="button"
          aria-label="Dia siguiente"
        >
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="finance-month-nav">
      <button
        className="month-button"
        onClick={() => onMonth(shiftMonth(month, -1))}
        type="button"
        aria-label="Mes anterior"
      >
        <ArrowLeft size={17} aria-hidden="true" />
      </button>
      <strong>{monthName(month)}</strong>
      <button
        className="month-button"
        onClick={() => onMonth(shiftMonth(month, 1))}
        type="button"
        aria-label="Mes siguiente"
      >
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function SyncPanel({
  data,
  pending,
  historyPending,
  onOpenImport,
  onSyncHistory,
  onSync
}: {
  data: FinanceDashboard | undefined;
  pending: boolean;
  historyPending: boolean;
  onOpenImport: () => void;
  onSyncHistory: () => void;
  onSync: () => void;
}) {
  const lastRun = data?.syncRuns[0];
  const connected = Boolean(data?.credentialsConfigured);
  return (
    <div className="finance-sync-panel">
      <span className={`sync-dot ${pending ? "pending" : connected ? "ok" : "off"}`} />
      <div>
        <strong>
          {pending ? "Sincronizando Dulce Hora..." : connected ? "Dulce Hora conectado" : "Credenciales faltantes"}
        </strong>
        <small>
          {lastRun
            ? `Ultima lectura: ${new Date(lastRun.started_at).toLocaleString("es-AR")}`
            : "Sin lecturas registradas"}
        </small>
      </div>
      <button
        className="secondary-button"
        disabled={!connected || pending}
        onClick={onSyncHistory}
        type="button"
      >
        {historyPending ? "Sincronizando historial..." : "Sincronizar historial"}
      </button>
      <button className="secondary-button" onClick={onOpenImport} type="button">
        Importar fecha
      </button>
      <button className="secondary-button" disabled={!connected || pending} onClick={onSync} type="button">
        Sincronizar ahora
      </button>
    </div>
  );
}

function TodayView({ data }: { data: FinanceDashboard }) {
  return (
    <>
      <div className="section-title-line">
        <h2>{formatFullDate(data.date)}</h2>
      </div>
      <div className="kpi-grid">
        <Kpi icon={BadgeDollarSign} label="Ventas del dia" value={formatCurrency(data.today.sales)} tone="blue" />
        <Kpi icon={ReceiptText} label="N tickets" value={data.today.tickets} tone="blue" />
        <Kpi
          icon={WalletCards}
          label="Ticket promedio"
          value={formatCurrency(data.today.averageTicket)}
          tone="blue"
        />
        <Kpi icon={FileSpreadsheet} label="Gastos del dia" value={formatCurrency(data.today.expenses)} tone="red" />
        <Kpi icon={Trash2} label="Mermas del dia" value={formatCurrency(data.today.waste)} tone="amber" />
        <Kpi
          icon={BadgeDollarSign}
          label="Resultado del dia"
          value={signedCurrency(data.today.result)}
          tone={data.today.result >= 0 ? "green" : "red"}
        />
      </div>

      <div className="split-layout">
        <section className="content-band compact-band">
          <h2>Top productos del dia</h2>
          <ProductTable rows={data.today.topProducts} />
        </section>
        <section className="content-band compact-band">
          <h2>Cross-selling del dia</h2>
          {data.today.crossSelling.length === 0 ? (
            <DashedEmpty text="Sin pares detectados. Se necesitan articulos por ticket." />
          ) : (
            <div className="list-stack">
              {data.today.crossSelling.map((pair) => (
                <div className="list-row" key={`${pair.product_a}-${pair.product_b}`}>
                  <strong>
                    {pair.product_a} + {pair.product_b}
                  </strong>
                  <span>{pair.tickets} tickets compartidos</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SummaryView({ data }: { data: FinanceDashboard }) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={`Ventas acumuladas hasta ${monthName(data.month)}`} value={formatCurrency(data.summary.sales)} />
        <Kpi label={`Gastos acumulados hasta ${monthName(data.month)}`} value={formatCurrency(data.summary.expenses)} />
        <Kpi label="Mermas acumuladas" value={formatCurrency(data.summary.waste)} tone="amber" />
        <Kpi
          label="Resultado acumulado"
          value={signedCurrency(data.summary.result)}
          tone={data.summary.result >= 0 ? "green" : "red"}
        />
        <Kpi label="Margen global" value={`${formatNumber(data.summary.margin)}%`} tone="green" />
        <Kpi label="Tickets acumulados" value={formatInteger(data.summary.tickets)} />
        <Kpi label="Ticket prom. global" value={formatCurrency(data.summary.averageTicket)} />
        <Kpi
          label="Mejor mes"
          value={`${monthName(data.summary.bestMonth)} - ${formatCurrency(data.summary.bestMonthSales)}`}
        />
      </div>
      <MonthlyTable rows={data.monthlyRows} />
    </>
  );
}

function MonthlyView({ data }: { data: FinanceDashboard }) {
  return (
    <section className="content-band">
      <div className="table-heading">
        <h2>{monthName(data.month)}</h2>
        <button className="secondary-button compact" onClick={() => exportDailyCsv(data.dailyRows, data.month)} type="button">
          <FileDown size={17} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>
      <DailyTable rows={data.dailyRows} />
    </section>
  );
}

function ImportView({
  date,
  onDate,
  sync,
  credentialsConfigured
}: {
  date: string;
  onDate: (value: string) => void;
  sync: UseMutationResult<SyncResult, Error, string>;
  credentialsConfigured: boolean;
}) {
  return (
    <section className="content-band">
      <h2>
        <CalendarSync size={18} aria-hidden="true" />
        Importar ventas y mermas
      </h2>
      <div className="sync-form">
        <label>
          Fecha
          <input type="date" value={date} onChange={(event) => onDate(event.target.value)} />
        </label>
        <button
          className="primary-button"
          disabled={sync.isPending || !credentialsConfigured}
          onClick={() => sync.mutate(date)}
          type="button"
        >
          <CalendarSync size={18} aria-hidden="true" />
          {sync.isPending ? "Sincronizando..." : "Tomar datos desde Dulce Hora"}
        </button>
      </div>
      {!credentialsConfigured ? (
        <p className="form-error">Faltan credenciales del panel en el backend local.</p>
      ) : null}
      {sync.error ? <p className="form-error">{sync.error.message}</p> : null}
      {sync.data ? (
        <div className="sync-result">
          <strong>Sincronizacion terminada</strong>
          <span>{sync.data.recordsReceived} comprobantes</span>
          <span>{sync.data.recordsCreated} nuevos</span>
          <span>{sync.data.recordsUpdated} actualizados</span>
          <span>{sync.data.wasteRecordsReceived} mermas</span>
        </div>
      ) : null}
    </section>
  );
}

function ExpensesView({ data }: { data: FinanceDashboard }) {
  const month = data.monthlyRows.find((row) => row.month === data.month);
  return (
    <>
      <div className="kpi-grid">
        <Kpi icon={FileSpreadsheet} label="Gastos del mes" value={formatCurrency(month?.expenses ?? 0)} tone="red" />
        <Kpi icon={Trash2} label="Mermas del mes" value={formatCurrency(month?.waste ?? 0)} tone="amber" />
        <Kpi icon={WalletCards} label="Costo total" value={formatCurrency(month?.costs ?? 0)} />
        <Kpi icon={ListChecks} label="Categorias" value={data.expenseCategories.length} tone="blue" />
      </div>
      <div className="split-layout">
        <section className="content-band compact-band">
          <h2>Gastos por categoria</h2>
          {data.expenseCategories.length === 0 ? (
            <DashedEmpty text="Sin gastos cargados para el mes seleccionado." />
          ) : (
            <SimpleRows
              rows={data.expenseCategories.map((row) => ({
                label: row.label,
                value: formatCurrency(Number(row.total)),
                detail: `${row.records} registros`
              }))}
            />
          )}
        </section>
        <section className="content-band compact-band">
          <h2>Gastos por dia</h2>
          <SimpleRows
            rows={data.dailyRows
              .filter((row) => row.expenses > 0)
              .map((row) => ({ label: row.label, value: formatCurrency(row.expenses) }))}
            empty="Sin gastos diarios en este mes."
          />
        </section>
      </div>
    </>
  );
}

function WasteFinanceView({ data }: { data: FinanceDashboard }) {
  const month = data.monthlyRows.find((row) => row.month === data.month);
  return (
    <>
      <div className="kpi-grid">
        <Kpi icon={Trash2} label="Merma del mes" value={formatCurrency(month?.waste ?? 0)} tone="red" />
        <Kpi icon={ReceiptText} label="Dias con merma" value={data.dailyRows.filter((row) => row.waste > 0).length} />
        <Kpi icon={BadgeDollarSign} label="Resultado con merma" value={signedCurrency(month?.result ?? 0)} tone="green" />
      </div>
      <div className="split-layout">
        <section className="content-band compact-band">
          <h2>Productos con mayor merma</h2>
          {data.wasteTopProducts.length === 0 ? (
            <DashedEmpty text="Sin mermas para el mes seleccionado." />
          ) : (
            <ProductTable rows={data.wasteTopProducts} />
          )}
        </section>
        <section className="content-band compact-band">
          <h2>Merma por dia</h2>
          <WasteDayRows rows={data.dailyRows.filter((row) => row.waste > 0)} />
        </section>
      </div>
    </>
  );
}

function PnlView({ data }: { data: FinanceDashboard }) {
  return (
    <section className="content-band">
      <h2>P&L anual</h2>
      <MonthlyTable rows={data.monthlyRows} />
    </section>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <section className="content-band">
      <h2>{title}</h2>
      <DashedEmpty text="Seccion preparada para activar cuando existan datos configurados." />
    </section>
  );
}

function MonthlyTable({ rows }: { rows: FinanceMonthRow[] }) {
  const maxSales = Math.max(1, ...rows.map((row) => row.sales));
  const maxCosts = Math.max(1, ...rows.map((row) => row.costs));
  return (
    <section className="content-band">
      <div className="data-table-wrap">
        <table className="data-table finance-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Ventas</th>
              <th>Tickets</th>
              <th>Ticket prom.</th>
              <th>Venta/dia</th>
              <th>Tickets/dia</th>
              <th>Gastos + mermas</th>
              <th>Resultado</th>
              <th>Margen %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.current ? "current-row" : ""} key={row.month}>
                <td>
                  <strong>{monthName(row.month)}</strong>
                  {row.current ? <span className="row-badge">Actual</span> : null}
                </td>
                <td>
                  {formatCurrency(row.sales)}
                  <Meter value={row.sales} max={maxSales} />
                </td>
                <td>{formatInteger(row.tickets)}</td>
                <td>{formatCurrency(row.averageTicket)}</td>
                <td>{formatCurrency(row.salesPerDay)}</td>
                <td>{formatNumber(row.ticketsPerDay)}</td>
                <td>
                  {formatCurrency(row.costs)}
                  <Meter value={row.costs} max={maxCosts} tone="cost" />
                </td>
                <td className={row.result >= 0 ? "positive-text" : "negative-text"}>
                  {signedCurrency(row.result)}
                </td>
                <td className={row.margin >= 0 ? "positive-text" : "negative-text"}>
                  {formatNumber(row.margin)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DailyTable({ rows }: { rows: FinanceDailyRow[] }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table finance-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ventas</th>
            <th>Tickets</th>
            <th>Ticket prom.</th>
            <th>Gastos</th>
            <th>Mermas</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.future ? "future-row" : ""} key={row.date}>
              <td>{row.label}</td>
              <td>{row.future || row.sales === 0 ? dash(row.future) : formatCurrency(row.sales)}</td>
              <td>{row.future || row.tickets === 0 ? dash(row.future) : formatInteger(row.tickets)}</td>
              <td>{row.future || row.averageTicket === 0 ? dash(row.future) : formatCurrency(row.averageTicket)}</td>
              <td>{row.future || row.expenses === 0 ? dash(row.future) : formatCurrency(row.expenses)}</td>
              <td>{row.future || row.waste === 0 ? dash(row.future) : formatCurrency(row.waste)}</td>
              <td className={row.result >= 0 ? "positive-text" : "negative-text"}>
                {row.future || row.sales === 0 ? dash(row.future) : signedCurrency(row.result)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductTable({
  rows
}: {
  rows: Array<{ label: string; quantity?: string; total: string; category?: string }>;
}) {
  if (rows.length === 0) {
    return <DashedEmpty text="Sin datos de articulos en el rango seleccionado." />;
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table compact-data-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.label}-${row.total}`}>
              <td>
                <strong>{row.label}</strong>
                {row.category ? <span className="cell-muted">{row.category}</span> : null}
              </td>
              <td>{row.quantity ? formatNumber(Number(row.quantity)) : "-"}</td>
              <td>{formatCurrency(Number(row.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleRows({
  rows,
  empty = "Sin datos en el mes seleccionado."
}: {
  rows: Array<{ label: string; value: string; detail?: string }>;
  empty?: string;
}) {
  if (rows.length === 0) return <DashedEmpty text={empty} />;
  return (
    <div className="list-stack">
      {rows.map((row) => (
        <div className="list-row horizontal-row" key={row.label}>
          <span>
            <strong>{row.label}</strong>
            {row.detail ? <small>{row.detail}</small> : null}
          </span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function WasteDayRows({ rows }: { rows: FinanceDailyRow[] }) {
  if (rows.length === 0) return <DashedEmpty text="Sin mermas diarias en este mes." />;
  return (
    <div className="list-stack">
      {rows.map((row) => {
        const percent = row.sales > 0 ? (row.waste / row.sales) * 100 : null;
        return (
          <div className="list-row horizontal-row" key={row.date}>
            <span>
              <strong>
                {row.label}
                <WastePercentBadge value={percent} />
              </strong>
              <small>Venta {formatCurrency(row.sales)}</small>
            </span>
            <strong>{formatCurrency(row.waste)}</strong>
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

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon?: React.ElementType;
  label: string;
  value: string | number;
  tone?: "red" | "blue" | "green" | "amber";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Meter({ value, max, tone = "sales" }: { value: number; max: number; tone?: "sales" | "cost" }) {
  return (
    <span className="mini-meter">
      <span
        className={`mini-meter-fill ${tone}`}
        style={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }}
      />
    </span>
  );
}

function DashedEmpty({ text }: { text: string }) {
  return <div className="dashed-empty">{text}</div>;
}

function LoadingPanel() {
  return (
    <section className="content-band">
      <p className="muted-text">Cargando finanzas...</p>
    </section>
  );
}

function exportDailyCsv(rows: FinanceDailyRow[], month: string) {
  const header = ["Fecha", "Ventas", "Tickets", "Ticket promedio", "Gastos", "Mermas", "Resultado"];
  const body = rows.map((row) => [
    row.date,
    row.sales,
    row.tickets,
    row.averageTicket,
    row.expenses,
    row.waste,
    row.result
  ]);
  const csv = [header, ...body].map((cells) => cells.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `finanzas-${month}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function signedCurrency(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function dash(future: boolean) {
  return future ? "-" : "-";
}

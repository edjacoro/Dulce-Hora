import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Banknote, Landmark, Percent, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { useState } from "react";
import { api, type CashflowDashboard } from "../api";

export function CashflowPage() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const cashflow = useQuery({
    queryKey: ["cashflow-dashboard", month],
    queryFn: () => api<CashflowDashboard>(`/api/cashflow/dashboard?month=${month}`)
  });
  const data = cashflow.data;

  return (
    <section className="page-section cashflow-page">
      <div className="page-heading">
        <div>
          <h1>Cashflow</h1>
          <p>Caja real y proyectada por fecha de cobro, gastos, comisiones y retiros</p>
        </div>
        <MonthControls month={month} onMonth={setMonth} />
      </div>

      {cashflow.isLoading ? <p className="muted-text">Calculando cashflow...</p> : null}
      {cashflow.error ? <p className="form-error">{cashflow.error.message}</p> : null}

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Caja neta mes" value={formatCurrency(data.summary.netCash)} tone={data.summary.netCash >= 0 ? "green" : "red"} />
            <Kpi icon={Banknote} label="Ventas cobradas" value={formatCurrency(data.summary.immediateSales + data.summary.portalPayouts)} tone="blue" />
            <Kpi icon={Percent} label="Comisiones" value={formatCurrency(data.summary.commissions)} tone="amber" />
            <Kpi icon={ReceiptText} label="Gastos pagados" value={formatCurrency(data.summary.expensesPaid)} tone="red" />
            <Kpi icon={Landmark} label="Retiros socios" value={formatCurrency(data.summary.withdrawals)} tone="slate" />
            <Kpi icon={TrendingUp} label="Saldo cierre" value={formatCurrency(data.summary.closingBalance)} tone={data.summary.closingBalance >= 0 ? "green" : "red"} />
          </div>

          <div className="split-layout cashflow-split">
            <section className="content-band compact-band">
              <div className="table-heading">
                <h2>Canales de cobro</h2>
                <span className="period-chip">{monthName(month)}</span>
              </div>
              <ChannelBars rows={data.channels} />
            </section>

            <section className="content-band compact-band">
              <div className="table-heading">
                <h2>Reglas activas</h2>
                <span className="period-chip">Comisiones</span>
              </div>
              <div className="cashflow-rules">
                <span>Efectivo y transferencias <strong>0%</strong></span>
                <span>Posnet <strong>{percent(data.rules.posnet)}</strong></span>
                <span>Cuenta DNI <strong>{percent(data.rules.cuentaDni)}</strong></span>
                <span>Rappi <strong>{percent(data.rules.rappi)}</strong></span>
                <span>Pedidos Ya <strong>{percent(data.rules.pedidosYa)}</strong></span>
                <small>{data.rules.pedidosYaPayout}</small>
              </div>
              {data.pendingPayouts.length ? (
                <div className="pending-payouts">
                  <strong>Queda fuera del mes</strong>
                  {data.pendingPayouts.slice(0, 5).map((row) => (
                    <span key={`${row.provider}-${row.date}-${row.gross}`}>
                      {row.date} · {row.provider} · {formatCurrency(row.net)}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <section className="content-band">
            <div className="table-heading">
              <h2>Flujo diario</h2>
              <span className="period-chip">{formatCurrency(data.summary.pendingPortalPayouts)} pendiente portal</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Venta bruta</th>
                    <th>Cobro local</th>
                    <th>Cobro portales</th>
                    <th>Comisiones</th>
                    <th>Gastos pagados</th>
                    <th>Pendientes</th>
                    <th>Retiros</th>
                    <th>Neto caja</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyRows.map((row) => (
                    <tr key={row.date} className={row.netCash < 0 ? "cashflow-negative-row" : ""}>
                      <td>
                        <strong>{row.label}</strong>
                      </td>
                      <td>{moneyOrDash(row.grossSales)}</td>
                      <td>{moneyOrDash(row.immediateSales)}</td>
                      <td>{moneyOrDash(row.portalPayouts)}</td>
                      <td>{moneyOrDash(row.commissions)}</td>
                      <td>{moneyOrDash(row.expensesPaid)}</td>
                      <td>{moneyOrDash(row.expensesPending)}</td>
                      <td>{moneyOrDash(row.withdrawals)}</td>
                      <td className={row.netCash >= 0 ? "positive-text" : "negative-text"}>{moneyOrDash(row.netCash)}</td>
                      <td className={row.closingBalance >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(row.closingBalance)}</td>
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

function MonthControls({ month, onMonth }: { month: string; onMonth: (value: string) => void }) {
  return (
    <div className="day-nav month-only-nav">
      <button className="nav-button" onClick={() => onMonth(shiftMonth(month, -1))} type="button">
        <ArrowLeft size={17} aria-hidden="true" />
      </button>
      <div className="date-display">
        <strong>{monthName(month)}</strong>
        <input type="month" value={month} onChange={(event) => onMonth(event.target.value)} />
      </div>
      <button className="nav-button" onClick={() => onMonth(shiftMonth(month, 1))} type="button">
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
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

function ChannelBars({ rows }: { rows: CashflowDashboard["channels"] }) {
  const max = Math.max(1, ...rows.map((row) => row.gross));
  if (!rows.length) return <div className="dashed-empty">Sin cobros para este mes.</div>;
  return (
    <div className="bar-list cashflow-channel-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>
            {row.label}
            <small>
              {row.documents} tickets · neto {formatCurrency(row.netCash)}
            </small>
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(4, (row.gross / max) * 100)}%` }} />
          </div>
          <strong>{formatCurrency(row.gross)}</strong>
        </div>
      ))}
    </div>
  );
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

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function moneyOrDash(value: number) {
  return Math.abs(value) > 0.004 ? formatCurrency(value) : "-";
}

function percent(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    minimumFractionDigits: value < 0.01 && value > 0 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(value);
}

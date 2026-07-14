import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  Landmark,
  Percent,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { useState } from "react";
import { api, type CashAccountKey, type CashflowDashboard } from "../api";

type TransferForm = {
  date: string;
  fromAccount: CashAccountKey;
  toAccount: CashAccountKey;
  amount: string;
  notes: string;
};

type AdjustmentForm = {
  date: string;
  account: CashAccountKey;
  amount: string;
  notes: string;
};

const defaultAccounts: CashflowDashboard["accountOptions"] = [
  { key: "cash", label: "Efectivo" },
  { key: "pedidosya", label: "Cuenta Pedidos Ya" },
  { key: "rappi", label: "Cuenta Rappi" },
  { key: "mercado_pago", label: "Mercado Pago" },
  { key: "banco_provincia", label: "Banco Provincia" }
];

const emptyTransferForm = (): TransferForm => ({
  date: today(),
  fromAccount: "cash",
  toAccount: "mercado_pago",
  amount: "",
  notes: ""
});

const emptyAdjustmentForm = (): AdjustmentForm => ({
  date: today(),
  account: "cash",
  amount: "",
  notes: ""
});

export function CashflowPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [transferForm, setTransferForm] = useState<TransferForm>(() => emptyTransferForm());
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(() => emptyAdjustmentForm());

  const cashflow = useQuery({
    queryKey: ["cashflow-dashboard", month],
    queryFn: () => api<CashflowDashboard>(`/api/cashflow/dashboard?month=${month}`)
  });
  const data = cashflow.data;
  const accountOptions = data?.accountOptions ?? defaultAccounts;

  const createTransfer = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/cashflow/transfers", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setTransferForm(emptyTransferForm());
      await queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] });
    }
  });

  const deleteTransfer = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/cashflow/transfers/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] })
  });

  const createAdjustment = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/cashflow/adjustments", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setAdjustmentForm(emptyAdjustmentForm());
      await queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] });
    }
  });

  const deleteAdjustment = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/cashflow/adjustments/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] })
  });

  return (
    <section className="page-section cashflow-page">
      <div className="page-heading">
        <div>
          <h1>Cashflow</h1>
          <p>Caja real por saldos, fecha de cobro, gastos, comisiones y retiros</p>
        </div>
        <MonthControls month={month} onMonth={setMonth} />
      </div>

      {cashflow.isLoading ? <p className="muted-text">Calculando cashflow...</p> : null}
      {cashflow.error ? <p className="form-error">{cashflow.error.message}</p> : null}

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Caja neta mes" value={formatCurrency(data.summary.netCash)} tone={data.summary.netCash >= 0 ? "green" : "red"} />
            <Kpi icon={Banknote} label="Ventas brutas" value={formatCurrency(data.summary.grossSales)} tone="blue" />
            <Kpi icon={Percent} label="Comisiones" value={formatCurrency(data.summary.commissions)} tone="amber" />
            <Kpi icon={ReceiptText} label="Gastos pagados" value={formatCurrency(data.summary.expensesPaid)} tone="red" />
            <Kpi icon={Landmark} label="Retiros socios" value={formatCurrency(data.summary.withdrawals)} tone="slate" />
            <Kpi icon={TrendingUp} label="Saldo cierre" value={formatCurrency(data.summary.closingBalance)} tone={data.summary.closingBalance >= 0 ? "green" : "red"} />
          </div>

          <section className="content-band compact-band">
            <div className="table-heading">
              <h2>Saldos de caja</h2>
              <span className="period-chip">Comisiones aplicadas</span>
            </div>
            <div className="account-balance-grid">
              {data.accounts.map((account) => (
                <article className="account-balance-card" key={account.key}>
                  <span>{account.label}</span>
                  <strong className={account.balance >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(account.balance)}</strong>
                  <small>
                    +{formatCurrency(account.monthIn)} / -{formatCurrency(account.monthOut)}
                  </small>
                </article>
              ))}
            </div>
          </section>

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
                      {row.date} - {row.provider} - {formatCurrency(row.net)}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="split-layout cashflow-split">
            <section className="content-band compact-band">
              <div className="table-heading">
                <h2>
                  <ArrowRightLeft size={18} aria-hidden="true" />
                  Pases entre cuentas
                </h2>
                <span className="period-chip">{monthName(month)}</span>
              </div>
              <form
                className="form-grid dense-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const amount = Number(transferForm.amount);
                  if (!Number.isFinite(amount) || amount <= 0 || transferForm.fromAccount === transferForm.toAccount) return;
                  createTransfer.mutate({
                    date: transferForm.date,
                    fromAccount: transferForm.fromAccount,
                    toAccount: transferForm.toAccount,
                    amount,
                    notes: transferForm.notes
                  });
                }}
              >
                <label>
                  Fecha
                  <input
                    type="date"
                    value={transferForm.date}
                    onChange={(event) => setTransferForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </label>
                <label>
                  Monto
                  <input
                    value={transferForm.amount}
                    onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>
                <label>
                  Desde
                  <select
                    value={transferForm.fromAccount}
                    onChange={(event) => setTransferForm((current) => ({ ...current, fromAccount: event.target.value as CashAccountKey }))}
                  >
                    {accountOptions.map((account) => (
                      <option value={account.key} key={account.key}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Hacia
                  <select
                    value={transferForm.toAccount}
                    onChange={(event) => setTransferForm((current) => ({ ...current, toAccount: event.target.value as CashAccountKey }))}
                  >
                    {accountOptions.map((account) => (
                      <option value={account.key} key={account.key}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Nota
                  <input
                    value={transferForm.notes}
                    onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Ej. Deposito de caja a banco"
                  />
                </label>
                {createTransfer.error ? <p className="form-error">{createTransfer.error.message}</p> : null}
                <button className="primary-button full" disabled={createTransfer.isPending} type="submit">
                  <Plus size={17} aria-hidden="true" />
                  {createTransfer.isPending ? "Guardando..." : "Registrar pase"}
                </button>
              </form>
              <MovementList
                rows={data.transfers.map((row) => ({
                  id: row.id,
                  date: row.transfer_date,
                  title: `${accountLabel(row.from_account, accountOptions)} -> ${accountLabel(row.to_account, accountOptions)}`,
                  amount: Number(row.amount),
                  notes: row.notes
                }))}
                onDelete={(id) => deleteTransfer.mutate(id)}
                deleting={deleteTransfer.isPending}
              />
            </section>

            <section className="content-band compact-band">
              <div className="table-heading">
                <h2>
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  Ajustes de saldo
                </h2>
                <span className="period-chip">Control manual</span>
              </div>
              <form
                className="form-grid dense-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const amount = Number(adjustmentForm.amount);
                  if (!Number.isFinite(amount) || amount === 0) return;
                  createAdjustment.mutate({
                    date: adjustmentForm.date,
                    account: adjustmentForm.account,
                    amount,
                    notes: adjustmentForm.notes
                  });
                }}
              >
                <label>
                  Fecha
                  <input
                    type="date"
                    value={adjustmentForm.date}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </label>
                <label>
                  Cuenta
                  <select
                    value={adjustmentForm.account}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, account: event.target.value as CashAccountKey }))}
                  >
                    {accountOptions.map((account) => (
                      <option value={account.key} key={account.key}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ajuste
                  <input
                    value={adjustmentForm.amount}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, amount: event.target.value }))}
                    inputMode="decimal"
                    placeholder="Puede ser negativo"
                  />
                </label>
                <label>
                  Nota
                  <input
                    value={adjustmentForm.notes}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Ej. Saldo inicial"
                  />
                </label>
                {createAdjustment.error ? <p className="form-error">{createAdjustment.error.message}</p> : null}
                <button className="primary-button full" disabled={createAdjustment.isPending} type="submit">
                  <Plus size={17} aria-hidden="true" />
                  {createAdjustment.isPending ? "Guardando..." : "Guardar ajuste"}
                </button>
              </form>
              <MovementList
                rows={data.adjustments.map((row) => ({
                  id: row.id,
                  date: row.adjustment_date,
                  title: accountLabel(row.account, accountOptions),
                  amount: Number(row.amount),
                  notes: row.notes
                }))}
                onDelete={(id) => deleteAdjustment.mutate(id)}
                deleting={deleteAdjustment.isPending}
              />
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
                    <th>Comisiones</th>
                    <th>Gastos pagados</th>
                    <th>Pendientes</th>
                    <th>Retiros</th>
                    <th>Pases +/-</th>
                    <th>Ajustes</th>
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
                      <td>{moneyOrDash(row.commissions)}</td>
                      <td>{moneyOrDash(row.expensesPaid)}</td>
                      <td>{moneyOrDash(row.expensesPending)}</td>
                      <td>{moneyOrDash(row.withdrawals)}</td>
                      <td>{moneyOrDash(row.transfersIn - row.transfersOut)}</td>
                      <td>{moneyOrDash(row.adjustments)}</td>
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
            <small>{row.documents} tickets</small>
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

function MovementList({
  rows,
  onDelete,
  deleting
}: {
  rows: Array<{ id: string; date: string; title: string; amount: number; notes: string | null }>;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  if (!rows.length) return <div className="dashed-empty">Sin movimientos cargados en este mes.</div>;
  return (
    <div className="movement-list">
      {rows.slice(0, 8).map((row) => (
        <div className="movement-row" key={row.id}>
          <span>
            <strong>{row.title}</strong>
            <small>
              {row.date}
              {row.notes ? ` - ${row.notes}` : ""}
            </small>
          </span>
          <strong className={row.amount >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(row.amount)}</strong>
          <button
            className="icon-only-button"
            disabled={deleting}
            onClick={() => onDelete(row.id)}
            type="button"
            aria-label="Eliminar movimiento"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function accountLabel(key: CashAccountKey, options: CashflowDashboard["accountOptions"]) {
  return options.find((account) => account.key === key)?.label ?? key;
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

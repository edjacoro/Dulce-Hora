import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  ListChecks,
  Plus,
  ReceiptText,
  Trash2
} from "lucide-react";
import { type Dispatch, type ElementType, type SetStateAction, useMemo, useState } from "react";
import {
  api,
  type ExpenseCategory,
  type ExpensePaymentType,
  type ExpensesResponse,
  type InvestorsResponse,
  type ProfitWithdrawalsResponse
} from "../api";

type CategoriesResponse = {
  categories: ExpenseCategory[];
};

type ExpenseForm = {
  expenseDate: string;
  accountingMonth: string;
  categoryId: string;
  categoryName: string;
  description: string;
  supplier: string;
  amount: string;
  paymentMethod: string;
  paymentType: ExpensePaymentType;
  status: "paid" | "pending";
  deferred: boolean;
  dueDate: string;
  paidDate: string;
};

type WithdrawalForm = {
  investorId: string;
  withdrawalDate: string;
  amount: string;
  status: "paid" | "pending";
  paymentMethod: string;
  notes: string;
};

const emptyForm = (): ExpenseForm => {
  const date = today();
  return {
    expenseDate: date,
    accountingMonth: date.slice(0, 7),
    categoryId: "",
    categoryName: "",
    description: "",
    supplier: "",
    amount: "",
    paymentMethod: "",
    paymentType: "cash",
    status: "paid",
    deferred: false,
    dueDate: "",
    paidDate: date
  };
};

const emptyWithdrawalForm = (): WithdrawalForm => ({
  investorId: "",
  withdrawalDate: today(),
  amount: "",
  status: "paid",
  paymentMethod: "",
  notes: ""
});

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [form, setForm] = useState<ExpenseForm>(() => emptyForm());
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>(() => emptyWithdrawalForm());
  const range = useMemo(() => monthRange(month), [month]);
  const query = `?from=${range.from}&to=${range.to}`;
  const todayValue = today();

  const categories = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => api<CategoriesResponse>("/api/expenses/categories")
  });
  const expenses = useQuery({
    queryKey: ["expenses", range.from, range.to],
    queryFn: () => api<ExpensesResponse>(`/api/expenses${query}`)
  });
  const investors = useQuery({
    queryKey: ["investors"],
    queryFn: () => api<InvestorsResponse>("/api/investors")
  });
  const withdrawals = useQuery({
    queryKey: ["profit-withdrawals", month],
    queryFn: () => api<ProfitWithdrawalsResponse>(`/api/profit-withdrawals?month=${month}`)
  });

  const importSheet = useMutation({
    mutationFn: () =>
      api<{ rowsReceived: number; rowsCreated: number; rowsUpdated: number }>("/api/imports/expenses-sheet", {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: async () => refreshExpenses(queryClient)
  });

  const createExpense = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/expenses", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setForm(emptyForm());
      await refreshExpenses(queryClient);
    }
  });

  const markExpensePaid = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/expenses/${id}/pay`, {
        method: "PATCH",
        body: JSON.stringify({ paidDate: today() })
      }),
    onSuccess: async () => refreshExpenses(queryClient)
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: async () => refreshExpenses(queryClient)
  });

  const createWithdrawal = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/profit-withdrawals", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setWithdrawalForm(emptyWithdrawalForm());
      await refreshWithdrawals(queryClient);
    }
  });

  const deleteWithdrawal = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/profit-withdrawals/${id}`, { method: "DELETE" }),
    onSuccess: async () => refreshWithdrawals(queryClient)
  });

  const data = expenses.data;
  const categoryOptions = categories.data?.categories ?? [];
  const investorOptions = investors.data?.investors.filter((investor) => investor.active) ?? [];

  const applyQuickMode = (mode: "paid" | "pending" | "credit_card" | "deferred") => {
    setForm((current) => {
      if (mode === "paid") {
        return {
          ...current,
          status: "paid",
          deferred: false,
          dueDate: "",
          paidDate: current.paidDate || current.expenseDate
        };
      }
      if (mode === "credit_card") {
        return {
          ...current,
          status: "pending",
          deferred: true,
          paymentType: "credit_card",
          paymentMethod: "TC",
          dueDate: nextCreditCardDueDate(current.expenseDate),
          paidDate: ""
        };
      }
      if (mode === "deferred") {
        return {
          ...current,
          status: "pending",
          deferred: true,
          paymentType: "deferred",
          paymentMethod: current.paymentMethod || "Diferido",
          paidDate: ""
        };
      }
      return {
        ...current,
        status: "pending",
        deferred: true,
        paidDate: ""
      };
    });
  };

  return (
    <section className="page-section expenses-page">
      <div className="page-heading">
        <div>
          <h1>Gastos</h1>
          <p>Gastos imputados, pagos pendientes y retiros de utilidad</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" disabled={importSheet.isPending} onClick={() => importSheet.mutate()} type="button">
            <FileSpreadsheet size={17} aria-hidden="true" />
            {importSheet.isPending ? "Importando..." : "Importar planilla"}
          </button>
          <MonthControls month={month} onMonth={setMonth} />
        </div>
      </div>

      {importSheet.data ? (
        <div className="sync-result">
          <strong>{importSheet.data.rowsReceived} filas leidas</strong>
          <span>{importSheet.data.rowsCreated} nuevas</span>
          <span>{importSheet.data.rowsUpdated} actualizadas</span>
        </div>
      ) : null}
      {importSheet.error ? <p className="form-error">{importSheet.error.message}</p> : null}

      <div className="kpi-grid">
        <Kpi icon={BadgeDollarSign} label="Gasto imputado" value={formatCurrency(data?.summary.total ?? 0)} tone="red" />
        <Kpi icon={ReceiptText} label="Registros" value={data?.summary.records ?? 0} tone="blue" />
        <Kpi icon={ListChecks} label="Pagado" value={formatCurrency(data?.summary.paid ?? 0)} tone="green" />
        <Kpi icon={ClipboardList} label="Pendiente" value={formatCurrency(data?.summary.pending ?? 0)} tone="amber" />
        <Kpi icon={Clock3} label="Vencido" value={formatCurrency(data?.summary.overdue ?? 0)} tone="red" />
      </div>

      <div className="split-layout expenses-layout">
        <section className="content-band compact-band">
          <h2>
            <Plus size={18} aria-hidden="true" />
            Cargar gasto
          </h2>
          <form
            className="form-grid dense-form"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(form.amount);
              if (!Number.isFinite(amount) || amount <= 0) return;
              createExpense.mutate(buildExpensePayload(form, amount));
            }}
          >
            <label>
              Fecha gasto
              <input
                value={form.expenseDate}
                onChange={(event) => {
                  const expenseDate = event.target.value;
                  setForm((current) => ({
                    ...current,
                    expenseDate,
                    accountingMonth: expenseDate.slice(0, 7),
                    dueDate: current.paymentType === "credit_card" ? nextCreditCardDueDate(expenseDate) : current.dueDate,
                    paidDate: current.status === "paid" ? expenseDate : current.paidDate
                  }));
                }}
                type="date"
              />
            </label>
            <label>
              Mes imputado
              <input value={form.accountingMonth} onChange={(event) => updateForm(setForm, "accountingMonth", event.target.value)} type="month" />
            </label>
            <label>
              Categoria
              <select value={form.categoryId} onChange={(event) => updateForm(setForm, "categoryId", event.target.value)}>
                <option value="">Nueva categoria</option>
                {categoryOptions.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {!form.categoryId ? (
              <label>
                Nombre categoria
                <input
                  value={form.categoryName}
                  onChange={(event) => updateForm(setForm, "categoryName", event.target.value)}
                  placeholder="Ej. Aportes sindicales"
                />
              </label>
            ) : null}
            <label>
              Monto
              <input
                value={form.amount}
                onChange={(event) => updateForm(setForm, "amount", event.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
            </label>
            <label>
              Estado
              <select
                value={form.status}
                onChange={(event) => {
                  const status = event.target.value as "paid" | "pending";
                  setForm((current) => ({
                    ...current,
                    status,
                    deferred: status === "pending" ? true : false,
                    dueDate: status === "paid" ? "" : current.dueDate,
                    paidDate: status === "paid" ? current.paidDate || current.expenseDate : ""
                  }));
                }}
              >
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
              </select>
            </label>
            <label>
              Tipo
              <select
                value={form.paymentType}
                onChange={(event) => {
                  const paymentType = event.target.value as ExpensePaymentType;
                  setForm((current) => ({
                    ...current,
                    paymentType,
                    paymentMethod: defaultPaymentMethod(paymentType),
                    status: paymentType === "credit_card" || paymentType === "deferred" ? "pending" : current.status,
                    deferred: paymentType === "credit_card" || paymentType === "deferred" || current.status === "pending",
                    dueDate: paymentType === "credit_card" ? nextCreditCardDueDate(current.expenseDate) : current.dueDate,
                    paidDate: paymentType === "credit_card" || paymentType === "deferred" ? "" : current.paidDate
                  }));
                }}
              >
                <option value="cash">Efectivo</option>
                <option value="bank">Transferencia</option>
                <option value="virtual">Billetera virtual</option>
                <option value="posnet">Posnet</option>
                <option value="credit_card">TC dia 10</option>
                <option value="deferred">Pago diferido</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <div className="payment-quick-actions full">
              <button className="secondary-button compact" onClick={() => applyQuickMode("paid")} type="button">
                <CheckCircle2 size={15} aria-hidden="true" />
                Pagado
              </button>
              <button className="secondary-button compact" onClick={() => applyQuickMode("pending")} type="button">
                <Clock3 size={15} aria-hidden="true" />
                Pendiente
              </button>
              <button className="secondary-button compact" onClick={() => applyQuickMode("credit_card")} type="button">
                <CreditCard size={15} aria-hidden="true" />
                TC 10
              </button>
              <button className="secondary-button compact" onClick={() => applyQuickMode("deferred")} type="button">
                <CalendarClock size={15} aria-hidden="true" />
                Diferido
              </button>
            </div>
            {form.status === "pending" ? (
              <label>
                Vencimiento
                <input value={form.dueDate} onChange={(event) => updateForm(setForm, "dueDate", event.target.value)} type="date" />
              </label>
            ) : (
              <label>
                Fecha pago
                <input value={form.paidDate} onChange={(event) => updateForm(setForm, "paidDate", event.target.value)} type="date" />
              </label>
            )}
            <label>
              Forma
              <input
                value={form.paymentMethod}
                onChange={(event) => updateForm(setForm, "paymentMethod", event.target.value)}
                placeholder="Efectivo, Banco, TC"
              />
            </label>
            <label>
              Proveedor
              <input value={form.supplier} onChange={(event) => updateForm(setForm, "supplier", event.target.value)} />
            </label>
            <label className="full">
              Descripcion
              <textarea value={form.description} onChange={(event) => updateForm(setForm, "description", event.target.value)} rows={3} />
            </label>
            {createExpense.error ? <p className="form-error">{createExpense.error.message}</p> : null}
            <button className="primary-button full" disabled={createExpense.isPending} type="submit">
              <Plus size={17} aria-hidden="true" />
              {createExpense.isPending ? "Guardando..." : "Guardar gasto"}
            </button>
          </form>
        </section>

        <section className="content-band compact-band">
          <h2>
            <ListChecks size={18} aria-hidden="true" />
            Gasto por categoria
          </h2>
          <BarList rows={data?.byCategory ?? []} />
        </section>
      </div>

      <section className="content-band">
        <div className="table-heading">
          <h2>Detalle de gastos</h2>
          <span className="period-chip">{monthName(month)}</span>
        </div>
        {expenses.isLoading ? <p className="muted-text">Cargando gastos...</p> : null}
        {expenses.error ? <p className="form-error">{expenses.error.message}</p> : null}
        {(data?.expenses ?? []).length === 0 ? (
          <div className="dashed-empty">Sin gastos cargados para este mes.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Imputado</th>
                  <th>Categoria</th>
                  <th>Descripcion</th>
                  <th>Pago / vence</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.expenses ?? []).map((expense) => {
                  const overdue = expense.status === "pending" && Boolean(expense.due_date) && expense.due_date! < todayValue;
                  return (
                    <tr key={expense.id}>
                      <td>{expense.expense_date}</td>
                      <td>{expense.accounting_month}</td>
                      <td>{expense.category_name}</td>
                      <td>
                        <strong>{expense.description ?? "Sin descripcion"}</strong>
                        <span className="cell-muted">{expense.source === "google-sheet-expenses" ? "Planilla" : "Manual"}</span>
                      </td>
                      <td>
                        <strong>{paymentTypeLabel(expense.payment_type)}</strong>
                        <span className="cell-muted">
                          {expense.status === "paid" ? `Pago ${expense.paid_date ?? "-"}` : `Vence ${expense.due_date ?? "sin fecha"}`}
                        </span>
                      </td>
                      <td>
                        <span className={`signal-pill ${overdue ? "red" : expense.status === "pending" ? "amber" : "green"}`}>
                          {overdue ? "Vencido" : expense.status === "pending" ? "Pendiente" : "Pagado"}
                        </span>
                      </td>
                      <td>{formatCurrency(Number(expense.amount))}</td>
                      <td>
                        <div className="row-actions">
                          {expense.status === "pending" ? (
                            <button
                              className="secondary-button compact"
                              disabled={markExpensePaid.isPending}
                              onClick={() => markExpensePaid.mutate(expense.id)}
                              type="button"
                            >
                              <CheckCircle2 size={15} aria-hidden="true" />
                              Pagar
                            </button>
                          ) : null}
                          <button
                            className="icon-only-button"
                            disabled={deleteExpense.isPending}
                            onClick={() => deleteExpense.mutate(expense.id)}
                            type="button"
                            aria-label="Eliminar gasto"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-band">
        <div className="table-heading">
          <h2>
            <HandCoins size={18} aria-hidden="true" />
            Retiros de utilidades
          </h2>
          <span className="period-chip">{monthName(month)}</span>
        </div>
        <div className="kpi-grid utility-kpis">
          <Kpi icon={HandCoins} label="Retirado" value={formatCurrency(withdrawals.data?.summary.total ?? 0)} tone="amber" />
          <Kpi icon={CheckCircle2} label="Pagado" value={formatCurrency(withdrawals.data?.summary.paid ?? 0)} tone="green" />
          <Kpi icon={Clock3} label="Pendiente" value={formatCurrency(withdrawals.data?.summary.pending ?? 0)} tone="blue" />
        </div>
        <form
          className="form-grid dense-form withdrawal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(withdrawalForm.amount);
            const investorId = withdrawalForm.investorId || investorOptions[0]?.id;
            if (!investorId || !Number.isFinite(amount) || amount <= 0) return;
            createWithdrawal.mutate({
              investorId,
              withdrawalMonth: month,
              withdrawalDate: withdrawalForm.withdrawalDate,
              amount,
              status: withdrawalForm.status,
              paymentMethod: withdrawalForm.paymentMethod,
              notes: withdrawalForm.notes
            });
          }}
        >
          <label>
            Socio
            <select
              value={withdrawalForm.investorId}
              onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "investorId", event.target.value)}
            >
              <option value="">Seleccionar</option>
              {investorOptions.map((investor) => (
                <option value={investor.id} key={investor.id}>
                  {investor.name} ({Number(investor.ownership_percent).toFixed(0)}%)
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              value={withdrawalForm.withdrawalDate}
              onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "withdrawalDate", event.target.value)}
              type="date"
            />
          </label>
          <label>
            Monto
            <input
              value={withdrawalForm.amount}
              onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "amount", event.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <label>
            Estado
            <select
              value={withdrawalForm.status}
              onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "status", event.target.value as "paid" | "pending")}
            >
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
            </select>
          </label>
          <label>
            Forma
            <input
              value={withdrawalForm.paymentMethod}
              onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "paymentMethod", event.target.value)}
              placeholder="Transferencia, efectivo"
            />
          </label>
          <label>
            Observacion
            <input value={withdrawalForm.notes} onChange={(event) => updateWithdrawalForm(setWithdrawalForm, "notes", event.target.value)} />
          </label>
          {createWithdrawal.error ? <p className="form-error">{createWithdrawal.error.message}</p> : null}
          <button className="primary-button" disabled={createWithdrawal.isPending || investorOptions.length === 0} type="submit">
            <Plus size={17} aria-hidden="true" />
            {createWithdrawal.isPending ? "Guardando..." : "Guardar retiro"}
          </button>
        </form>
        {withdrawals.isLoading ? <p className="muted-text">Cargando retiros...</p> : null}
        {withdrawals.error ? <p className="form-error">{withdrawals.error.message}</p> : null}
        {(withdrawals.data?.withdrawals ?? []).length === 0 ? (
          <div className="dashed-empty">Sin retiros cargados para este mes.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Socio</th>
                  <th>Participacion</th>
                  <th>Estado</th>
                  <th>Forma</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(withdrawals.data?.withdrawals ?? []).map((withdrawal) => (
                  <tr key={withdrawal.id}>
                    <td>{withdrawal.withdrawal_date}</td>
                    <td>
                      <strong>{withdrawal.investor_name}</strong>
                      <span className="cell-muted">{withdrawal.notes ?? "Retiro de utilidad"}</span>
                    </td>
                    <td>{Number(withdrawal.ownership_percent).toFixed(0)}%</td>
                    <td>
                      <span className={`signal-pill ${withdrawal.status === "pending" ? "amber" : "green"}`}>
                        {withdrawal.status === "pending" ? "Pendiente" : "Pagado"}
                      </span>
                    </td>
                    <td>{withdrawal.payment_method ?? "-"}</td>
                    <td>{formatCurrency(Number(withdrawal.amount))}</td>
                    <td>
                      <button
                        className="icon-only-button"
                        disabled={deleteWithdrawal.isPending}
                        onClick={() => deleteWithdrawal.mutate(withdrawal.id)}
                        type="button"
                        aria-label="Eliminar retiro"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
  tone
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  tone: "red" | "blue" | "green" | "amber";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; total: string; records: string }> }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total)));
  if (rows.length === 0) return <div className="dashed-empty">Sin categorias para mostrar.</div>;
  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = Number(row.total);
        return (
          <div className="bar-row" key={row.label}>
            <span>
              {row.label}
              <small>{row.records} registros</small>
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

function buildExpensePayload(form: ExpenseForm, amount: number) {
  return {
    expenseDate: form.expenseDate,
    accountingMonth: form.accountingMonth || form.expenseDate.slice(0, 7),
    categoryId: form.categoryId || null,
    categoryName: form.categoryId ? "" : form.categoryName,
    supplier: form.supplier,
    description: form.description,
    amount,
    paymentMethod: form.paymentMethod,
    paymentType: form.paymentType,
    status: form.status,
    deferred: form.deferred,
    dueDate: form.status === "pending" ? form.dueDate || null : null,
    paidDate: form.status === "paid" ? form.paidDate || form.expenseDate : null
  };
}

function updateForm<T extends keyof ExpenseForm>(
  setForm: Dispatch<SetStateAction<ExpenseForm>>,
  key: T,
  value: ExpenseForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateWithdrawalForm<T extends keyof WithdrawalForm>(
  setForm: Dispatch<SetStateAction<WithdrawalForm>>,
  key: T,
  value: WithdrawalForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

async function refreshExpenses(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    queryClient.invalidateQueries({ queryKey: ["expense-categories"] }),
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] })
  ]);
}

async function refreshWithdrawals(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["profit-withdrawals"] }),
    queryClient.invalidateQueries({ queryKey: ["investors"] })
  ]);
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

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(days).padStart(2, "0")}`
  };
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextCreditCardDueDate(expenseDate: string) {
  const [year, month, day] = expenseDate.split("-").map(Number);
  const date = day <= 10 ? new Date(year, month - 1, 10) : new Date(year, month, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function paymentTypeLabel(value: ExpensePaymentType) {
  return defaultPaymentMethod(value);
}

function defaultPaymentMethod(value: ExpensePaymentType) {
  const labels: Record<ExpensePaymentType, string> = {
    cash: "Efectivo",
    bank: "Transferencia",
    virtual: "Billetera virtual",
    posnet: "Posnet",
    credit_card: "TC",
    deferred: "Diferido",
    other: "Otro"
  };
  return labels[value];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

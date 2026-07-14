import type { Express, Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { db } from "./db.js";
import { getDefaultBranch } from "./dulceHoraSync.js";

type DateRange = {
  from: string;
  to: string;
};

type CashAccountKey = "cash" | "pedidosya" | "rappi" | "mercado_pago" | "banco_provincia";

type SalesCashRow = {
  sale_date: string;
  payment_method: string | null;
  source: string;
  provider: string | null;
  payment_kind: string | null;
  notes: string | null;
  gross: string;
  documents: string;
};

type ExpenseCashRow = {
  cash_date: string;
  amount: string;
  status: "paid" | "pending";
  payment_type: string;
  payment_method: string | null;
  cash_account: CashAccountKey | null;
  category_name: string;
};

type WithdrawalCashRow = {
  withdrawal_date: string;
  amount: string;
  status: "paid" | "pending";
  payment_method: string | null;
  cash_account: CashAccountKey | null;
  investor_name: string;
};

type TransferRow = {
  id: string;
  transfer_date: string;
  from_account: CashAccountKey;
  to_account: CashAccountKey;
  amount: string;
  notes: string | null;
};

type AdjustmentRow = {
  id: string;
  adjustment_date: string;
  account: CashAccountKey;
  amount: string;
  notes: string | null;
};

type CashflowDay = {
  date: string;
  label: string;
  grossSales: number;
  commissions: number;
  expensesPaid: number;
  expensesPending: number;
  withdrawals: number;
  transfersIn: number;
  transfersOut: number;
  adjustments: number;
  netCash: number;
  closingBalance: number;
};

type LedgerMovement = {
  date: string;
  account: CashAccountKey;
  amount: number;
  kind: "sale" | "commission" | "expense" | "withdrawal" | "transfer" | "adjustment";
  label: string;
};

const netTotal = "case when sd.status = 'credit_note' then -abs(sd.total) else sd.total end";

const cashAccounts: Array<{ key: CashAccountKey; label: string }> = [
  { key: "cash", label: "Efectivo" },
  { key: "pedidosya", label: "Cuenta Pedidos Ya" },
  { key: "rappi", label: "Cuenta Rappi" },
  { key: "mercado_pago", label: "Mercado Pago" },
  { key: "banco_provincia", label: "Banco Provincia" }
];

const commissionRates = {
  efectivo: 0,
  transferencias: 0,
  posnet: 0.04,
  cuentaDni: 0.0085,
  rappi: 0.45,
  pedidosYa: 0.49,
  otro: 0
};

const cashAccountSchema = z.enum(["cash", "pedidosya", "rappi", "mercado_pago", "banco_provincia"]);

const transferInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromAccount: cashAccountSchema,
  toAccount: cashAccountSchema,
  amount: z.number().positive(),
  notes: z.string().trim().max(500).optional().default("")
});

const adjustmentInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  account: cashAccountSchema,
  amount: z.number(),
  notes: z.string().trim().max(500).optional().default("")
});

export function registerCashflowRoutes(app: Express) {
  app.get("/api/cashflow/dashboard", requireAuth, async (req, res) => {
    const organizationId = req.user!.organization_id;
    const month = readMonth(req) ?? todayArgentina().slice(0, 7);
    const range = monthRange(month);
    const salesReadRange = {
      from: "2000-01-01",
      to: range.to
    };

    const [sales, expenses, withdrawals, transfers, adjustments] = await Promise.all([
      db.query<SalesCashRow>(
        `select sd.sale_date::text as sale_date,
                sd.payment_method,
                sd.source,
                coalesce(sd.raw_data->>'provider', sd.raw_data->>'providerLabel') as provider,
                sd.raw_data->>'paymentKind' as payment_kind,
                sd.raw_data->>'notes' as notes,
                coalesce(sum(${netTotal}), 0)::text as gross,
                count(sd.id)::text as documents
         from sales_documents sd
         join branches b on b.id = sd.branch_id
         where b.organization_id = $1
           and sd.sale_date >= $2
           and sd.sale_date <= $3
           and sd.status <> 'credited'
         group by sd.sale_date, sd.payment_method, sd.source,
                  coalesce(sd.raw_data->>'provider', sd.raw_data->>'providerLabel'),
                  sd.raw_data->>'paymentKind',
                  sd.raw_data->>'notes'
         order by sd.sale_date`,
        [organizationId, salesReadRange.from, salesReadRange.to]
      ),
      db.query<ExpenseCashRow>(
        `select coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date)::text as cash_date,
                coalesce(sum(e.amount), 0)::text as amount,
                e.status,
                e.payment_type,
                e.payment_method,
                e.cash_account,
                coalesce(ec.name, 'Sin categoria') as category_name
         from expenses e
         join branches b on b.id = e.branch_id
         left join expense_categories ec on ec.id = e.category_id
         where b.organization_id = $1
           and coalesce(ec.pnl_group, 'operating') <> 'capex'
           and coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date) <= $2
         group by coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date),
                  e.status, e.payment_type, e.payment_method, e.cash_account, coalesce(ec.name, 'Sin categoria')
         order by cash_date`,
        [organizationId, range.to]
      ),
      db.query<WithdrawalCashRow>(
        `select pw.withdrawal_date::text as withdrawal_date,
                coalesce(sum(pw.amount), 0)::text as amount,
                pw.status,
                pw.payment_method,
                pw.cash_account,
                i.name as investor_name
         from profit_withdrawals pw
         join branches b on b.id = pw.branch_id
         join investors i on i.id = pw.investor_id
         where b.organization_id = $1
           and pw.withdrawal_date <= $2
         group by pw.withdrawal_date, pw.status, pw.payment_method, pw.cash_account, i.name
         order by pw.withdrawal_date`,
        [organizationId, range.to]
      ),
      db.query<TransferRow>(
        `select ct.id,
                ct.transfer_date::text as transfer_date,
                ct.from_account,
                ct.to_account,
                ct.amount::text,
                ct.notes
         from cashflow_transfers ct
         join branches b on b.id = ct.branch_id
         where b.organization_id = $1
           and ct.transfer_date <= $2
         order by ct.transfer_date desc, ct.created_at desc`,
        [organizationId, range.to]
      ),
      db.query<AdjustmentRow>(
        `select ca.id,
                ca.adjustment_date::text as adjustment_date,
                ca.account,
                ca.amount::text,
                ca.notes
         from cashflow_account_adjustments ca
         join branches b on b.id = ca.branch_id
         where b.organization_id = $1
           and ca.adjustment_date <= $2
         order by ca.adjustment_date desc, ca.created_at desc`,
        [organizationId, range.to]
      )
    ]);

    const days = new Map(daysBetween(range).map((date) => [date, emptyDay(date)]));
    const channels = new Map<string, { label: string; gross: number; documents: number; commissions: number; netCash: number }>();
    const movements: LedgerMovement[] = [];
    const pendingPayouts: Array<{ date: string; provider: string; gross: number; net: number; commissions: number }> = [];

    for (const row of sales.rows) {
      const gross = toNumber(row.gross);
      const documents = Number(row.documents ?? 0);
      const channel = classifySale(row);
      const inSelectedMonth = row.sale_date >= range.from && row.sale_date <= range.to;
      const saleDay = days.get(row.sale_date);

      if (inSelectedMonth) {
        addChannel(channels, channel.channelLabel, gross, documents, gross * channel.commissionRate, gross - gross * channel.commissionRate);
        if (saleDay) saleDay.grossSales += gross;
      }

      if (channel.kind === "pedidosYaOnline") {
        const payoutDate = pedidosYaPayoutDate(row.sale_date);
        const commission = roundMoney(gross * commissionRates.pedidosYa);
        const net = roundMoney(gross - commission);
        if (payoutDate <= range.to) {
          movements.push({ date: payoutDate, account: "pedidosya", amount: net, kind: "sale", label: "Liquidacion Pedidos Ya online" });
          addDaily(days, payoutDate, "commissions", commission);
        } else if (inSelectedMonth) {
          pendingPayouts.push({ date: payoutDate, provider: "Pedidos Ya", gross, net, commissions: commission });
        }
        continue;
      }

      if (channel.kind === "pedidosYaCash") {
        const payoutDate = pedidosYaPayoutDate(row.sale_date);
        const commission = roundMoney(gross * commissionRates.pedidosYa);
        movements.push({ date: row.sale_date, account: "cash", amount: gross, kind: "sale", label: "Pedidos Ya efectivo" });
        if (payoutDate <= range.to) {
          movements.push({ date: payoutDate, account: "pedidosya", amount: -commission, kind: "commission", label: "Comision Pedidos Ya efectivo" });
          addDaily(days, payoutDate, "commissions", commission);
        } else if (inSelectedMonth) {
          pendingPayouts.push({ date: payoutDate, provider: "Comision Pedidos Ya efectivo", gross, net: -commission, commissions: commission });
        }
        continue;
      }

      const commission = roundMoney(gross * channel.commissionRate);
      const net = roundMoney(gross - commission);
      movements.push({ date: row.sale_date, account: channel.account, amount: net, kind: "sale", label: channel.channelLabel });
      if (commission > 0) addDaily(days, row.sale_date, "commissions", commission);
    }

    for (const row of expenses.rows) {
      const amount = toNumber(row.amount);
      const day = days.get(row.cash_date);
      if (row.status === "paid") {
        const account = row.cash_account ?? defaultCashAccountForPayment(row.payment_method, row.payment_type);
        movements.push({ date: row.cash_date, account, amount: -amount, kind: "expense", label: row.category_name });
        if (day) day.expensesPaid += amount;
      } else if (day) {
        day.expensesPending += amount;
      }
    }

    for (const row of withdrawals.rows) {
      if (row.status !== "paid") continue;
      const amount = toNumber(row.amount);
      const account = row.cash_account ?? defaultCashAccountForPayment(row.payment_method, "bank");
      movements.push({ date: row.withdrawal_date, account, amount: -amount, kind: "withdrawal", label: row.investor_name });
      addDaily(days, row.withdrawal_date, "withdrawals", amount);
    }

    for (const row of transfers.rows) {
      const amount = toNumber(row.amount);
      movements.push({ date: row.transfer_date, account: row.from_account, amount: -amount, kind: "transfer", label: `Pase a ${accountLabel(row.to_account)}` });
      movements.push({ date: row.transfer_date, account: row.to_account, amount, kind: "transfer", label: `Pase desde ${accountLabel(row.from_account)}` });
      addDaily(days, row.transfer_date, "transfersOut", amount);
      addDaily(days, row.transfer_date, "transfersIn", amount);
    }

    for (const row of adjustments.rows) {
      const amount = toNumber(row.amount);
      movements.push({ date: row.adjustment_date, account: row.account, amount, kind: "adjustment", label: row.notes ?? "Ajuste de saldo" });
      addDaily(days, row.adjustment_date, "adjustments", amount);
    }

    const accounts = cashAccounts.map((account) => {
      const accountMovements = movements.filter((movement) => movement.account === account.key);
      const monthMovements = accountMovements.filter((movement) => movement.date >= range.from && movement.date <= range.to);
      return {
        key: account.key,
        label: account.label,
        balance: roundMoney(sum(accountMovements.map((movement) => movement.amount))),
        monthIn: roundMoney(sum(monthMovements.filter((movement) => movement.amount > 0).map((movement) => movement.amount))),
        monthOut: roundMoney(Math.abs(sum(monthMovements.filter((movement) => movement.amount < 0).map((movement) => movement.amount))))
      };
    });

    let closingBalance = sum(movements.filter((movement) => movement.date < range.from).map((movement) => movement.amount));
    const dailyRows: CashflowDay[] = [...days.values()].map((day) => {
      const dayExternalMovements = movements.filter(
        (movement) => movement.date === day.date && movement.kind !== "transfer"
      );
      day.netCash = roundMoney(sum(dayExternalMovements.map((movement) => movement.amount)));
      closingBalance = roundMoney(closingBalance + day.netCash);
      day.closingBalance = closingBalance;
      return day;
    });

    const summary = {
      grossSales: roundMoney(sum(dailyRows.map((day) => day.grossSales))),
      commissions: roundMoney(sum(dailyRows.map((day) => day.commissions))),
      expensesPaid: roundMoney(sum(dailyRows.map((day) => day.expensesPaid))),
      expensesPending: roundMoney(sum(dailyRows.map((day) => day.expensesPending))),
      withdrawals: roundMoney(sum(dailyRows.map((day) => day.withdrawals))),
      transfersIn: roundMoney(sum(dailyRows.map((day) => day.transfersIn))),
      transfersOut: roundMoney(sum(dailyRows.map((day) => day.transfersOut))),
      adjustments: roundMoney(sum(dailyRows.map((day) => day.adjustments))),
      netCash: roundMoney(sum(dailyRows.map((day) => day.netCash))),
      closingBalance: roundMoney(sum(accounts.map((account) => account.balance))),
      pendingPortalPayouts: roundMoney(sum(pendingPayouts.map((row) => row.net)))
    };

    res.json({
      month,
      range,
      accounts,
      accountOptions: cashAccounts,
      rules: {
        efectivo: 0,
        transferencias: 0,
        posnet: commissionRates.posnet,
        cuentaDni: commissionRates.cuentaDni,
        rappi: commissionRates.rappi,
        pedidosYa: commissionRates.pedidosYa,
        pedidosYaPayout: "Semana lunes-domingo; pago el lunes de la semana subsiguiente"
      },
      summary,
      dailyRows,
      channels: [...channels.values()].sort((left, right) => right.gross - left.gross),
      pendingPayouts,
      transfers: transfers.rows.filter((row) => row.transfer_date >= range.from && row.transfer_date <= range.to),
      adjustments: adjustments.rows.filter((row) => row.adjustment_date >= range.from && row.adjustment_date <= range.to)
    });
  });

  app.post("/api/cashflow/transfers", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = transferInputSchema.parse(req.body ?? {});
    if (input.fromAccount === input.toAccount) {
      res.status(400).json({ error: "Las cuentas del pase deben ser distintas" });
      return;
    }
    const branch = await getDefaultBranch(req.user!.organization_id);
    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para cargar pases" });
      return;
    }

    const id = randomUUID();
    await db.query(
      `insert into cashflow_transfers
        (id, branch_id, transfer_date, from_account, to_account, amount, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, branch.id, input.date, input.fromAccount, input.toAccount, input.amount, input.notes || null, req.user!.id]
    );
    res.status(201).json({ id });
  });

  app.delete("/api/cashflow/transfers/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const result = await db.query<{ id: string }>(
      `delete from cashflow_transfers ct
       using branches b
       where b.id = ct.branch_id
         and ct.id = $1
         and b.organization_id = $2
       returning ct.id`,
      [req.params.id, req.user!.organization_id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Pase no encontrado" });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/api/cashflow/adjustments", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = adjustmentInputSchema.parse(req.body ?? {});
    const branch = await getDefaultBranch(req.user!.organization_id);
    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para ajustar saldos" });
      return;
    }

    const id = randomUUID();
    await db.query(
      `insert into cashflow_account_adjustments
        (id, branch_id, adjustment_date, account, amount, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, branch.id, input.date, input.account, input.amount, input.notes || null, req.user!.id]
    );
    res.status(201).json({ id });
  });

  app.delete("/api/cashflow/adjustments/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const result = await db.query<{ id: string }>(
      `delete from cashflow_account_adjustments ca
       using branches b
       where b.id = ca.branch_id
         and ca.id = $1
         and b.organization_id = $2
       returning ca.id`,
      [req.params.id, req.user!.organization_id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Ajuste no encontrado" });
      return;
    }
    res.json({ ok: true });
  });
}

function classifySale(row: SalesCashRow):
  | { kind: "sameDay"; channelLabel: string; account: CashAccountKey; commissionRate: number }
  | { kind: "pedidosYaOnline"; channelLabel: string; account: "pedidosya"; commissionRate: number }
  | { kind: "pedidosYaCash"; channelLabel: string; account: "cash"; commissionRate: number } {
  const paymentMethod = normalize(row.payment_method ?? "");
  const provider = normalize([row.source, row.provider].filter(Boolean).join(" "));
  const notes = normalize(row.notes ?? "");
  const text = `${paymentMethod} ${provider} ${notes}`;
  if (text.includes("rappi")) return { kind: "sameDay", channelLabel: "Rappi", account: "rappi", commissionRate: commissionRates.rappi };
  if (text.includes("pedidosya") || text.includes("pedidos ya")) {
    if (row.payment_kind === "cash" || paymentMethod.includes("efectivo") || notes.includes("efectivo")) {
      return { kind: "pedidosYaCash", channelLabel: "Pedidos Ya", account: "cash", commissionRate: commissionRates.pedidosYa };
    }
    return { kind: "pedidosYaOnline", channelLabel: "Pedidos Ya", account: "pedidosya", commissionRate: commissionRates.pedidosYa };
  }
  if (paymentMethod.includes("credito") || paymentMethod.includes("posnet") || paymentMethod.includes("tarjeta")) {
    return { kind: "sameDay", channelLabel: "Posnet", account: "banco_provincia", commissionRate: commissionRates.posnet };
  }
  if (paymentMethod.includes("debito") || paymentMethod.includes("cuenta dni")) {
    return { kind: "sameDay", channelLabel: "Cuenta DNI", account: "banco_provincia", commissionRate: commissionRates.cuentaDni };
  }
  if (paymentMethod.includes("virtual") || paymentMethod.includes("transfer")) {
    return { kind: "sameDay", channelLabel: "Transferencias", account: "mercado_pago", commissionRate: commissionRates.transferencias };
  }
  if (paymentMethod.includes("efectivo")) {
    return { kind: "sameDay", channelLabel: "Efectivo", account: "cash", commissionRate: commissionRates.efectivo };
  }
  if (paymentMethod.includes("multiple")) {
    return { kind: "sameDay", channelLabel: "Mixto Dulce Hora", account: "cash", commissionRate: commissionRates.otro };
  }
  return { kind: "sameDay", channelLabel: row.payment_method || "Sin dato", account: "cash", commissionRate: commissionRates.otro };
}

function addChannel(
  channels: Map<string, { label: string; gross: number; documents: number; commissions: number; netCash: number }>,
  label: string,
  gross: number,
  documents: number,
  commissions: number,
  netCash: number
) {
  const current = channels.get(label) ?? { label, gross: 0, documents: 0, commissions: 0, netCash: 0 };
  current.gross = roundMoney(current.gross + gross);
  current.documents += documents;
  current.commissions = roundMoney(current.commissions + commissions);
  current.netCash = roundMoney(current.netCash + netCash);
  channels.set(label, current);
}

function emptyDay(date: string): CashflowDay {
  return {
    date,
    label: shortDate(date),
    grossSales: 0,
    commissions: 0,
    expensesPaid: 0,
    expensesPending: 0,
    withdrawals: 0,
    transfersIn: 0,
    transfersOut: 0,
    adjustments: 0,
    netCash: 0,
    closingBalance: 0
  };
}

function addDaily(days: Map<string, CashflowDay>, date: string, key: keyof Omit<CashflowDay, "date" | "label" | "netCash" | "closingBalance">, amount: number) {
  const day = days.get(date);
  if (!day) return;
  day[key] = roundMoney(Number(day[key]) + amount);
}

function pedidosYaPayoutDate(date: string) {
  const weekStart = mondayStart(date);
  return addDays(weekStart, 14);
}

function mondayStart(value: string) {
  const date = parseLocalDate(value);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return formatDate(date);
}

function readMonth(req: Request) {
  const value = typeof req.query.month === "string" ? req.query.month : "";
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function monthRange(month: string): DateRange {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const toDate = new Date(year, monthNumber, 0);
  return { from, to: formatDate(toDate) };
}

function daysBetween(range: DateRange) {
  const dates: string[] = [];
  let cursor = parseLocalDate(range.from);
  const end = parseLocalDate(range.to);
  while (cursor <= end) {
    dates.push(formatDate(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return dates;
}

function addDays(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
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

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date).replace(".", "");
  return `${weekday} ${day}/${month}`;
}

function accountLabel(key: CashAccountKey) {
  return cashAccounts.find((account) => account.key === key)?.label ?? key;
}

function defaultCashAccountForPayment(paymentMethod: string | null | undefined, paymentType: string): CashAccountKey {
  const value = normalize(`${paymentMethod ?? ""} ${paymentType}`);
  if (value.includes("efectivo") || value.includes("cash")) return "cash";
  if (value.includes("mercado") || value.includes("mp") || value.includes("virtual")) return "mercado_pago";
  if (value.includes("rappi")) return "rappi";
  if (value.includes("pedido")) return "pedidosya";
  return "banco_provincia";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

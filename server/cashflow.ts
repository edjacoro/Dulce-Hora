import type { Express, Request } from "express";
import { requireAuth } from "./auth.js";
import { db } from "./db.js";

type DateRange = {
  from: string;
  to: string;
};

type SalesCashRow = {
  sale_date: string;
  payment_method: string | null;
  source: string;
  provider: string | null;
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
  category_name: string;
};

type WithdrawalCashRow = {
  withdrawal_date: string;
  amount: string;
  status: "paid" | "pending";
  investor_name: string;
};

type CashflowDay = {
  date: string;
  label: string;
  grossSales: number;
  immediateSales: number;
  portalPayouts: number;
  commissions: number;
  expensesPaid: number;
  expensesPending: number;
  withdrawals: number;
  netCash: number;
  closingBalance: number;
};

const netTotal = "case when sd.status = 'credit_note' then -abs(sd.total) else sd.total end";

const commissionRates = {
  efectivo: 0,
  transferencias: 0,
  posnet: 0.04,
  cuentaDni: 0.0085,
  rappi: 0.45,
  pedidosYa: 0.49,
  otro: 0
};

export function registerCashflowRoutes(app: Express) {
  app.get("/api/cashflow/dashboard", requireAuth, async (req, res) => {
    const organizationId = req.user!.organization_id;
    const month = readMonth(req) ?? todayArgentina().slice(0, 7);
    const range = monthRange(month);
    const salesReadRange = {
      from: addDays(range.from, -21),
      to: range.to
    };

    const [sales, expenses, withdrawals] = await Promise.all([
      db.query<SalesCashRow>(
        `select sd.sale_date::text as sale_date,
                sd.payment_method,
                sd.source,
                coalesce(sd.raw_data->>'provider', sd.raw_data->>'providerLabel') as provider,
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
                coalesce(ec.name, 'Sin categoria') as category_name
         from expenses e
         join branches b on b.id = e.branch_id
         left join expense_categories ec on ec.id = e.category_id
         where b.organization_id = $1
           and coalesce(ec.pnl_group, 'operating') <> 'capex'
           and coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date) >= $2
           and coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date) <= $3
         group by coalesce(case when e.status = 'paid' then e.paid_date else e.due_date end, e.expense_date),
                  e.status, e.payment_type, e.payment_method, coalesce(ec.name, 'Sin categoria')
         order by cash_date`,
        [organizationId, range.from, range.to]
      ),
      db.query<WithdrawalCashRow>(
        `select pw.withdrawal_date::text as withdrawal_date,
                coalesce(sum(pw.amount), 0)::text as amount,
                pw.status,
                i.name as investor_name
         from profit_withdrawals pw
         join branches b on b.id = pw.branch_id
         join investors i on i.id = pw.investor_id
         where b.organization_id = $1
           and pw.withdrawal_date >= $2
           and pw.withdrawal_date <= $3
         group by pw.withdrawal_date, pw.status, i.name
         order by pw.withdrawal_date`,
        [organizationId, range.from, range.to]
      )
    ]);

    const days = new Map(daysBetween(range).map((date) => [date, emptyDay(date)]));
    const channels = new Map<string, { label: string; gross: number; commissions: number; netCash: number; documents: number }>();
    const pendingPayouts: Array<{ date: string; provider: string; gross: number; net: number; commissions: number }> = [];

    for (const row of sales.rows) {
      const gross = toNumber(row.gross);
      const documents = Number(row.documents ?? 0);
      const channel = classifyPayment(row);
      const inSelectedMonth = row.sale_date >= range.from && row.sale_date <= range.to;
      const saleDay = days.get(row.sale_date);
      if (saleDay && inSelectedMonth) {
        saleDay.grossSales += gross;
      }

      if (channel.kind === "pedidosYaOnline") {
        const payoutDate = pedidosYaPayoutDate(row.sale_date);
        const commission = roundMoney(gross * commissionRates.pedidosYa);
        const net = roundMoney(gross - commission);
        addChannel(channels, "Pedidos Ya", gross, commission, net, documents);
        const payoutDay = days.get(payoutDate);
        if (payoutDay) {
          payoutDay.portalPayouts += net;
          payoutDay.commissions += commission;
        } else if (payoutDate > range.to && inSelectedMonth) {
          pendingPayouts.push({ date: payoutDate, provider: "Pedidos Ya", gross, net, commissions: commission });
        }
        continue;
      }

      if (channel.kind === "pedidosYaCash") {
        const commission = roundMoney(gross * commissionRates.pedidosYa);
        const payoutDate = pedidosYaPayoutDate(row.sale_date);
        addChannel(channels, "Pedidos Ya efectivo", gross, commission, gross - commission, documents);
        if (saleDay && inSelectedMonth) {
          saleDay.immediateSales += gross;
        }
        const payoutDay = days.get(payoutDate);
        if (payoutDay) {
          payoutDay.commissions += commission;
        } else if (payoutDate > range.to && inSelectedMonth) {
          pendingPayouts.push({ date: payoutDate, provider: "Comision Pedidos Ya efectivo", gross, net: -commission, commissions: commission });
        }
        continue;
      }

      const commission = roundMoney(gross * channel.rate);
      const net = roundMoney(gross - commission);
      addChannel(channels, channel.label, gross, commission, net, documents);
      if (saleDay && inSelectedMonth) {
        saleDay.immediateSales += net;
        saleDay.commissions += commission;
      }
    }

    for (const row of expenses.rows) {
      const day = days.get(row.cash_date);
      if (!day) continue;
      const amount = toNumber(row.amount);
      if (row.status === "paid") {
        day.expensesPaid += amount;
      } else {
        day.expensesPending += amount;
      }
    }

    for (const row of withdrawals.rows) {
      const day = days.get(row.withdrawal_date);
      if (!day) continue;
      day.withdrawals += toNumber(row.amount);
    }

    let closingBalance = 0;
    const dailyRows: CashflowDay[] = [...days.values()].map((day) => {
      const outflows = day.expensesPaid + day.expensesPending + day.withdrawals + day.commissions;
      day.netCash = roundMoney(day.immediateSales + day.portalPayouts - outflows);
      closingBalance = roundMoney(closingBalance + day.netCash);
      day.closingBalance = closingBalance;
      return day;
    });

    const summary = {
      grossSales: roundMoney(sum(dailyRows.map((day) => day.grossSales))),
      immediateSales: roundMoney(sum(dailyRows.map((day) => day.immediateSales))),
      portalPayouts: roundMoney(sum(dailyRows.map((day) => day.portalPayouts))),
      commissions: roundMoney(sum(dailyRows.map((day) => day.commissions))),
      expensesPaid: roundMoney(sum(dailyRows.map((day) => day.expensesPaid))),
      expensesPending: roundMoney(sum(dailyRows.map((day) => day.expensesPending))),
      withdrawals: roundMoney(sum(dailyRows.map((day) => day.withdrawals))),
      netCash: roundMoney(sum(dailyRows.map((day) => day.netCash))),
      closingBalance,
      pendingPortalPayouts: roundMoney(sum(pendingPayouts.map((row) => row.net)))
    };

    res.json({
      month,
      range,
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
      pendingPayouts
    });
  });
}

function classifyPayment(row: SalesCashRow):
  | { kind: "sameDay"; label: string; rate: number }
  | { kind: "pedidosYaOnline"; label: string; rate: number }
  | { kind: "pedidosYaCash"; label: string; rate: number } {
  const text = normalize([row.payment_method, row.source, row.provider, row.notes].filter(Boolean).join(" "));
  if (text.includes("rappi")) return { kind: "sameDay", label: "Rappi", rate: commissionRates.rappi };
  if (text.includes("pedidosya") || text.includes("pedidos ya")) {
    if (text.includes("efectivo") || text.includes("cash")) {
      return { kind: "pedidosYaCash", label: "Pedidos Ya efectivo", rate: commissionRates.pedidosYa };
    }
    return { kind: "pedidosYaOnline", label: "Pedidos Ya", rate: commissionRates.pedidosYa };
  }
  if (text.includes("credito") || text.includes("posnet") || text.includes("tarjeta")) {
    return { kind: "sameDay", label: "Posnet", rate: commissionRates.posnet };
  }
  if (text.includes("debito") || text.includes("cuenta dni")) {
    return { kind: "sameDay", label: "Cuenta DNI", rate: commissionRates.cuentaDni };
  }
  if (text.includes("virtual") || text.includes("transfer")) {
    return { kind: "sameDay", label: "Transferencias", rate: commissionRates.transferencias };
  }
  if (text.includes("efectivo")) {
    return { kind: "sameDay", label: "Efectivo", rate: commissionRates.efectivo };
  }
  return { kind: "sameDay", label: row.payment_method || "Sin dato", rate: commissionRates.otro };
}

function addChannel(
  channels: Map<string, { label: string; gross: number; commissions: number; netCash: number; documents: number }>,
  label: string,
  gross: number,
  commissions: number,
  netCash: number,
  documents: number
) {
  const current = channels.get(label) ?? { label, gross: 0, commissions: 0, netCash: 0, documents: 0 };
  current.gross = roundMoney(current.gross + gross);
  current.commissions = roundMoney(current.commissions + commissions);
  current.netCash = roundMoney(current.netCash + netCash);
  current.documents += documents;
  channels.set(label, current);
}

function emptyDay(date: string): CashflowDay {
  return {
    date,
    label: shortDate(date),
    grossSales: 0,
    immediateSales: 0,
    portalPayouts: 0,
    commissions: 0,
    expensesPaid: 0,
    expensesPending: 0,
    withdrawals: 0,
    netCash: 0,
    closingBalance: 0
  };
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

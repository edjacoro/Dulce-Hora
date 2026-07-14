import type { Express, Request } from "express";
import { requireAuth } from "./auth.js";
import { db, queryOne } from "./db.js";
import { dulceHoraCredentialsConfigured } from "./dulceHoraClient.js";

type DateRange = {
  from: string;
  to: string;
};

type AmountRow = {
  date?: string;
  month?: string;
  total: string;
  count?: string;
};

type SalesAggregate = {
  sales: string;
  documents: string;
  tickets: string;
  item_units: string;
  days_with_sales?: string;
};

type FinanceMonthRow = {
  month: string;
  sales: number;
  tickets: number;
  averageTicket: number;
  salesPerDay: number;
  ticketsPerDay: number;
  expenses: number;
  waste: number;
  costs: number;
  result: number;
  margin: number;
  daysWithSales: number;
  current: boolean;
};

type FinanceDailyRow = {
  date: string;
  label: string;
  sales: number;
  tickets: number;
  averageTicket: number;
  expenses: number;
  waste: number;
  costs: number;
  result: number;
  future: boolean;
};

const netTotal = "case when sd.status = 'credit_note' then -abs(sd.total) else sd.total end";

export function registerFinanceRoutes(app: Express) {
  app.get("/api/finance/dashboard", requireAuth, async (req, res) => {
    const organizationId = req.user!.organization_id;
    const selectedDate = readDate(req) ?? todayArgentina();
    const selectedMonth = readMonth(req) ?? selectedDate.slice(0, 7);
    const range = monthRange(selectedMonth);

    const [
      todaySales,
      todayExpenses,
      todayWaste,
      todayTopProducts,
      todayCrossSelling,
      dailySales,
      dailyExpenses,
      dailyWaste,
      monthlySales,
      monthlyExpenses,
      monthlyWaste,
      wasteTopProducts,
      expenseCategories,
      syncRuns
    ] = await Promise.all([
      salesAggregateByDate(organizationId, selectedDate),
      amountByDate("expenses", organizationId, selectedDate),
      amountByDate("waste_records", organizationId, selectedDate),
      topProducts(organizationId, selectedDate),
      crossSelling(organizationId, selectedDate),
      salesByDay(organizationId, range),
      amountsByDay("expenses", organizationId, range),
      amountsByDay("waste_records", organizationId, range),
      salesByMonth(organizationId),
      amountsByMonth("expenses", organizationId),
      amountsByMonth("waste_records", organizationId),
      topWasteProducts(organizationId, range),
      expensesByCategory(organizationId, range),
      latestSyncRuns(organizationId)
    ]);

    const dailyRows = buildDailyRows({
      range,
      selectedDate,
      sales: dailySales,
      expenses: dailyExpenses,
      waste: dailyWaste
    });
    const monthlyRows = buildMonthlyRows({
      selectedMonth,
      sales: monthlySales,
      expenses: monthlyExpenses,
      waste: monthlyWaste
    });
    const summary = buildSummary(selectedMonth, monthlyRows);
    const todayCosts = todayExpenses + todayWaste;
    const todayNetSales = toNumber(todaySales?.sales);
    const todayTickets = toNumber(todaySales?.tickets);

    res.json({
      month: selectedMonth,
      date: selectedDate,
      credentialsConfigured: dulceHoraCredentialsConfigured(),
      today: {
        sales: todayNetSales,
        tickets: todayTickets,
        averageTicket: todayTickets > 0 ? todayNetSales / todayTickets : 0,
        expenses: todayExpenses,
        waste: todayWaste,
        costs: todayCosts,
        result: todayNetSales - todayCosts,
        topProducts: todayTopProducts.rows,
        crossSelling: todayCrossSelling.rows
      },
      summary,
      monthlyRows,
      dailyRows,
      wasteTopProducts: wasteTopProducts.rows,
      expenseCategories: expenseCategories.rows,
      syncRuns: syncRuns.rows
    });
  });
}

function readMonth(req: Request) {
  const value = typeof req.query.month === "string" ? req.query.month : "";
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function readDate(req: Request) {
  const value = typeof req.query.date === "string" ? req.query.date : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function salesAggregateByDate(organizationId: string, date: string) {
  return queryOne<SalesAggregate>(
    `select
       coalesce(sum(${netTotal}), 0)::text as sales,
       count(sd.id)::text as documents,
       sum(case when sd.status = 'active' then 1 else 0 end)::text as tickets,
       coalesce(sum((select coalesce(sum(si.quantity), 0) from sale_items si where si.sales_document_id = sd.id)), 0)::text as item_units
     from sales_documents sd
     join branches b on b.id = sd.branch_id
     where b.organization_id = $1
       and sd.sale_date = $2
       and sd.status <> 'credited'`,
    [organizationId, date]
  );
}

async function salesByDay(organizationId: string, range: DateRange) {
  return db.query<SalesAggregate & { date: string }>(
    `select sd.sale_date::text as date,
            coalesce(sum(${netTotal}), 0)::text as sales,
            count(sd.id)::text as documents,
            sum(case when sd.status = 'active' then 1 else 0 end)::text as tickets,
            coalesce(sum((select coalesce(sum(si.quantity), 0) from sale_items si where si.sales_document_id = sd.id)), 0)::text as item_units
     from sales_documents sd
     join branches b on b.id = sd.branch_id
     where b.organization_id = $1
       and sd.sale_date >= $2
       and sd.sale_date <= $3
       and sd.status <> 'credited'
     group by sd.sale_date
     order by sd.sale_date`,
    [organizationId, range.from, range.to]
  );
}

async function salesByMonth(organizationId: string) {
  return db.query<SalesAggregate & { month: string }>(
    `select substring(sd.sale_date::text from 1 for 7) as month,
            coalesce(sum(${netTotal}), 0)::text as sales,
            count(sd.id)::text as documents,
            sum(case when sd.status = 'active' then 1 else 0 end)::text as tickets,
            coalesce(sum((select coalesce(sum(si.quantity), 0) from sale_items si where si.sales_document_id = sd.id)), 0)::text as item_units,
            count(distinct sd.sale_date)::text as days_with_sales
     from sales_documents sd
     join branches b on b.id = sd.branch_id
     where b.organization_id = $1
       and sd.status <> 'credited'
     group by substring(sd.sale_date::text from 1 for 7)
     order by month`,
    [organizationId]
  );
}

async function amountByDate(source: "expenses" | "waste_records", organizationId: string, date: string) {
  const table = source === "expenses" ? "expenses" : "waste_records";
  const dateColumn = source === "expenses" ? "expense_date" : "date";
  const amountColumn = source === "expenses" ? "amount" : "total_cost";
  const categoryJoin =
    source === "expenses" ? "left join expense_categories ec on ec.id = source.category_id" : "";
  const categoryFilter = source === "expenses" ? "and coalesce(ec.pnl_group, 'operating') <> 'capex'" : "";
  const row = await queryOne<{ total: string }>(
    `select coalesce(sum(${amountColumn}), 0)::text as total
     from ${table} source
     join branches b on b.id = source.branch_id
     ${categoryJoin}
     where b.organization_id = $1
       and source.${dateColumn} = $2
       ${categoryFilter}`,
    [organizationId, date]
  );
  return toNumber(row?.total);
}

async function amountsByDay(source: "expenses" | "waste_records", organizationId: string, range: DateRange) {
  const table = source === "expenses" ? "expenses" : "waste_records";
  const dateColumn = source === "expenses" ? "expense_date" : "date";
  const amountColumn = source === "expenses" ? "amount" : "total_cost";
  const categoryJoin =
    source === "expenses" ? "left join expense_categories ec on ec.id = source.category_id" : "";
  const categoryFilter = source === "expenses" ? "and coalesce(ec.pnl_group, 'operating') <> 'capex'" : "";
  return db.query<AmountRow>(
    `select source.${dateColumn}::text as date,
            coalesce(sum(${amountColumn}), 0)::text as total,
            count(source.id)::text as count
     from ${table} source
     join branches b on b.id = source.branch_id
     ${categoryJoin}
     where b.organization_id = $1
       and source.${dateColumn} >= $2
       and source.${dateColumn} <= $3
       ${categoryFilter}
     group by source.${dateColumn}
     order by source.${dateColumn}`,
    [organizationId, range.from, range.to]
  );
}

async function amountsByMonth(source: "expenses" | "waste_records", organizationId: string) {
  const table = source === "expenses" ? "expenses" : "waste_records";
  const dateColumn =
    source === "expenses" ? "coalesce(source.accounting_month, substring(source.expense_date::text from 1 for 7))" : "substring(source.date::text from 1 for 7)";
  const amountColumn = source === "expenses" ? "amount" : "total_cost";
  const categoryJoin =
    source === "expenses" ? "left join expense_categories ec on ec.id = source.category_id" : "";
  const categoryFilter = source === "expenses" ? "and coalesce(ec.pnl_group, 'operating') <> 'capex'" : "";
  return db.query<AmountRow>(
    `select ${dateColumn} as month,
            coalesce(sum(${amountColumn}), 0)::text as total,
            count(source.id)::text as count
     from ${table} source
     join branches b on b.id = source.branch_id
     ${categoryJoin}
     where b.organization_id = $1
       ${categoryFilter}
     group by ${dateColumn}
     order by month`,
    [organizationId]
  );
}

async function topProducts(organizationId: string, date: string) {
  return db.query(
    `select coalesce(p.canonical_name, si.original_name) as label,
            coalesce(sum(si.quantity), 0)::text as quantity,
            coalesce(sum(si.line_total), 0)::text as total
     from sale_items si
     join sales_documents sd on sd.id = si.sales_document_id
     join branches b on b.id = sd.branch_id
     left join products p on p.id = si.normalized_product_id
     where b.organization_id = $1
       and sd.sale_date = $2
       and sd.status = 'active'
     group by coalesce(p.canonical_name, si.original_name)
     order by coalesce(sum(si.line_total), 0) desc
     limit 8`,
    [organizationId, date]
  );
}

async function crossSelling(organizationId: string, date: string) {
  return db.query(
    `with item_docs as (
       select distinct sd.id as document_id,
              coalesce(p.canonical_name, si.original_name) as product
       from sale_items si
       join sales_documents sd on sd.id = si.sales_document_id
       join branches b on b.id = sd.branch_id
       left join products p on p.id = si.normalized_product_id
       where b.organization_id = $1
         and sd.sale_date = $2
         and sd.status = 'active'
     )
     select a.product as product_a,
            b.product as product_b,
            count(*)::text as tickets
     from item_docs a
     join item_docs b on b.document_id = a.document_id and a.product < b.product
     group by a.product, b.product
     order by count(*) desc, a.product
     limit 8`,
    [organizationId, date]
  );
}

async function topWasteProducts(organizationId: string, range: DateRange) {
  return db.query(
    `select coalesce(p.canonical_name, 'Producto sin nombre') as label,
            coalesce(c.name, 'Sin categoria') as category,
            coalesce(sum(wr.quantity), 0)::text as quantity,
            coalesce(sum(wr.total_cost), 0)::text as total
     from waste_records wr
     join branches b on b.id = wr.branch_id
     left join products p on p.id = wr.product_id
     left join categories c on c.id = p.category_id
     where b.organization_id = $1
       and wr.date >= $2
       and wr.date <= $3
     group by coalesce(p.canonical_name, 'Producto sin nombre'), coalesce(c.name, 'Sin categoria')
     order by coalesce(sum(wr.total_cost), 0) desc
     limit 8`,
    [organizationId, range.from, range.to]
  );
}

async function expensesByCategory(organizationId: string, range: DateRange) {
  return db.query(
    `select coalesce(ec.name, 'Sin categoria') as label,
            coalesce(sum(e.amount), 0)::text as total,
            count(e.id)::text as records
     from expenses e
     join branches b on b.id = e.branch_id
     left join expense_categories ec on ec.id = e.category_id
     where b.organization_id = $1
       and coalesce(e.accounting_month, substring(e.expense_date::text from 1 for 7)) >= $2
       and coalesce(e.accounting_month, substring(e.expense_date::text from 1 for 7)) <= $3
       and coalesce(ec.pnl_group, 'operating') <> 'capex'
     group by coalesce(ec.name, 'Sin categoria')
     order by coalesce(sum(e.amount), 0) desc`,
    [organizationId, range.from.slice(0, 7), range.to.slice(0, 7)]
  );
}

async function latestSyncRuns(organizationId: string) {
  return db.query(
    `select sr.id, sr.integration, sr.started_at, sr.finished_at, sr.status,
            sr.records_received, sr.records_created, sr.records_updated, sr.error_message,
            b.name as branch_name
     from sync_runs sr
     join branches b on b.id = sr.branch_id
     where b.organization_id = $1
     order by sr.started_at desc
     limit 5`,
    [organizationId]
  );
}

function buildDailyRows(input: {
  range: DateRange;
  selectedDate: string;
  sales: { rows: Array<SalesAggregate & { date: string }> };
  expenses: { rows: AmountRow[] };
  waste: { rows: AmountRow[] };
}): FinanceDailyRow[] {
  const sales = new Map(input.sales.rows.map((row) => [row.date, row]));
  const expenses = new Map(input.expenses.rows.map((row) => [row.date ?? "", toNumber(row.total)]));
  const waste = new Map(input.waste.rows.map((row) => [row.date ?? "", toNumber(row.total)]));

  return daysBetween(input.range).map((date) => {
    const sale = sales.get(date);
    const salesTotal = toNumber(sale?.sales);
    const tickets = toNumber(sale?.tickets);
    const expenseTotal = expenses.get(date) ?? 0;
    const wasteTotal = waste.get(date) ?? 0;
    const costs = expenseTotal + wasteTotal;

    return {
      date,
      label: dayLabel(date),
      sales: salesTotal,
      tickets,
      averageTicket: tickets > 0 ? salesTotal / tickets : 0,
      expenses: expenseTotal,
      waste: wasteTotal,
      costs,
      result: salesTotal - costs,
      future: date > todayArgentina()
    };
  });
}

function buildMonthlyRows(input: {
  selectedMonth: string;
  sales: { rows: Array<SalesAggregate & { month: string }> };
  expenses: { rows: AmountRow[] };
  waste: { rows: AmountRow[] };
}): FinanceMonthRow[] {
  const sales = new Map(input.sales.rows.map((row) => [row.month, row]));
  const expenses = new Map(input.expenses.rows.map((row) => [row.month ?? "", toNumber(row.total)]));
  const waste = new Map(input.waste.rows.map((row) => [row.month ?? "", toNumber(row.total)]));
  const months = new Set<string>([input.selectedMonth]);
  for (const row of input.sales.rows) months.add(row.month);
  for (const row of input.expenses.rows) if (row.month) months.add(row.month);
  for (const row of input.waste.rows) if (row.month) months.add(row.month);

  return [...months].sort().map((month) => {
    const sale = sales.get(month);
    const salesTotal = toNumber(sale?.sales);
    const tickets = toNumber(sale?.tickets);
    const daysWithSales = toNumber(sale?.days_with_sales);
    const expenseTotal = expenses.get(month) ?? 0;
    const wasteTotal = waste.get(month) ?? 0;
    const costs = expenseTotal + wasteTotal;
    const result = salesTotal - costs;

    return {
      month,
      sales: salesTotal,
      tickets,
      averageTicket: tickets > 0 ? salesTotal / tickets : 0,
      salesPerDay: daysWithSales > 0 ? salesTotal / daysWithSales : 0,
      ticketsPerDay: daysWithSales > 0 ? tickets / daysWithSales : 0,
      expenses: expenseTotal,
      waste: wasteTotal,
      costs,
      result,
      margin: salesTotal > 0 ? (result / salesTotal) * 100 : 0,
      daysWithSales,
      current: month === input.selectedMonth
    };
  });
}

function buildSummary(selectedMonth: string, rows: FinanceMonthRow[]) {
  const untilSelected = rows.filter((row) => row.month <= selectedMonth);
  const source = untilSelected.length > 0 ? untilSelected : rows;
  const sales = sum(source.map((row) => row.sales));
  const expenses = sum(source.map((row) => row.expenses));
  const waste = sum(source.map((row) => row.waste));
  const costs = expenses + waste;
  const result = sales - costs;
  const tickets = sum(source.map((row) => row.tickets));
  const selected = rows.find((row) => row.month === selectedMonth);
  const bestMonth = source.reduce<FinanceMonthRow | null>(
    (best, row) => (!best || row.sales > best.sales ? row : best),
    null
  );
  const daysInSelectedMonth = monthRange(selectedMonth).days;
  const projection =
    selected && selected.daysWithSales > 0 ? (selected.sales / selected.daysWithSales) * daysInSelectedMonth : 0;

  return {
    sales,
    expenses,
    waste,
    costs,
    result,
    margin: sales > 0 ? (result / sales) * 100 : 0,
    tickets,
    averageTicket: tickets > 0 ? sales / tickets : 0,
    projection,
    bestMonth: bestMonth?.month ?? selectedMonth,
    bestMonthSales: bestMonth?.sales ?? 0,
    monthCount: source.length
  };
}

function monthRange(month: string): DateRange & { days: number } {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
    days
  };
}

function daysBetween(range: DateRange) {
  const [year, month] = range.from.split("-").map(Number);
  const days = monthRange(`${year}-${String(month).padStart(2, "0")}`).days;
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  });
}

function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(value);
  return `${capitalize(weekday)} ${day}/${month}`;
}

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

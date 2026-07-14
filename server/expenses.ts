import type { Express, Request } from "express";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { db } from "./db.js";
import { getDefaultBranch } from "./dulceHoraSync.js";

type DateRange = {
  from: string | null;
  to: string | null;
};

type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type ParsedExpense = {
  expenseDate: string;
  categoryName: string;
  status: "paid" | "pending";
  amount: number;
  description: string;
  paymentMethod: string | null;
  paymentType: PaymentType;
  externalId: string;
};

type PaymentType = "cash" | "bank" | "virtual" | "posnet" | "credit_card" | "deferred" | "other";

const DEFAULT_EXPENSES_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1mYOoGvqmee5CT1XF6xllwK-4FFp74iFU/export?format=xlsx";

const expenseInputSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().trim().max(120).optional().default(""),
  supplier: z.string().trim().max(180).optional().default(""),
  description: z.string().trim().max(500).optional().default(""),
  amount: z.number().positive(),
  paymentMethod: z.string().trim().max(80).optional().default(""),
  status: z.enum(["paid", "pending"]).optional().default("paid"),
  deferred: z.boolean().optional().default(false),
  paymentType: z
    .enum(["cash", "bank", "virtual", "posnet", "credit_card", "deferred", "other"])
    .optional()
    .default("cash"),
  accountingMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .nullable(),
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
});

const markPaidSchema = z.object({
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(() => todayArgentina())
});

const investorInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ownershipPercent: z.number().min(0).max(100).optional().default(0)
});

const withdrawalInputSchema = z.object({
  investorId: z.string().min(1),
  withdrawalMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .nullable(),
  withdrawalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  status: z.enum(["paid", "pending"]).optional().default("paid"),
  paymentMethod: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(500).optional().default("")
});

const expenseImportSchema = z.object({
  url: z.string().url().optional().default(DEFAULT_EXPENSES_SHEET_URL)
});

export function registerExpenseRoutes(app: Express) {
  app.get("/api/expenses/categories", requireAuth, async (req, res) => {
    const rows = await db.query(
      `select id, name, pnl_group
       from expense_categories
       where organization_id = $1
         and coalesce(active, true) = true
         and pnl_group <> 'capex'
       order by name`,
      [req.user!.organization_id]
    );

    res.json({ categories: rows.rows });
  });

  app.get("/api/expenses", requireAuth, async (req, res) => {
    const range = readDateRange(req);
    const params: unknown[] = [req.user!.organization_id];
    const filters = ["b.organization_id = $1", "coalesce(ec.pnl_group, 'operating') <> 'capex'"];
    addAccountingRangeFilter(filters, params, range);

    const rows = await db.query(
      `select e.id,
              e.expense_date::text as expense_date,
              coalesce(e.accounting_month, substring(e.expense_date::text from 1 for 7)) as accounting_month,
              e.supplier,
              e.description,
              e.amount::text as amount,
              e.payment_method,
              e.payment_type,
              e.status,
              e.deferred,
              e.paid_date::text as paid_date,
              e.due_date::text as due_date,
              e.source,
              e.external_id,
              e.created_at,
              ec.id as category_id,
              coalesce(ec.name, 'Sin categoria') as category_name,
              b.name as branch_name
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where ${filters.join(" and ")}
       order by case when e.status = 'pending' then 0 else 1 end,
                case when e.status = 'pending' then coalesce(e.due_date, e.expense_date) end asc,
                e.expense_date desc,
                e.created_at desc`,
      params
    );

    const summary = await db.query<{ total: string; records: string }>(
      `select coalesce(sum(e.amount), 0)::text as total,
              count(e.id)::text as records
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where ${filters.join(" and ")}`,
      params
    );

    const byCategory = await db.query(
      `select coalesce(ec.name, 'Sin categoria') as label,
              coalesce(sum(e.amount), 0)::text as total,
              count(e.id)::text as records
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where ${filters.join(" and ")}
       group by coalesce(ec.name, 'Sin categoria')
       order by coalesce(sum(e.amount), 0) desc`,
      params
    );

    const paid = await db.query<{ status: string; total: string; records: string }>(
      `select e.status,
              coalesce(sum(e.amount), 0)::text as total,
              count(e.id)::text as records
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where ${filters.join(" and ")}
       group by e.status`,
      params
    );

    const overdue = await db.query<{ total: string; records: string }>(
      `select coalesce(sum(e.amount), 0)::text as total,
              count(e.id)::text as records
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where ${filters.join(" and ")}
         and e.status = 'pending'
         and e.due_date is not null
         and e.due_date < $${params.length + 1}`,
      [...params, todayArgentina()]
    );

    res.json({
      range,
      summary: {
        total: Number(summary.rows[0]?.total ?? 0),
        records: Number(summary.rows[0]?.records ?? 0),
        pending: Number(paid.rows.find((row) => row.status === "pending")?.total ?? 0),
        paid: Number(paid.rows.find((row) => row.status === "paid")?.total ?? 0),
        overdue: Number(overdue.rows[0]?.total ?? 0),
        overdueRecords: Number(overdue.rows[0]?.records ?? 0)
      },
      byCategory: byCategory.rows,
      expenses: rows.rows
    });
  });

  app.post("/api/expenses", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = expenseInputSchema.parse(req.body);
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para cargar gastos" });
      return;
    }

    const categoryId = await resolveExpenseCategory(db, req.user!.organization_id, input.categoryId, input.categoryName);
    const id = randomUUID();
    const prepared = prepareExpenseInput(input);

    await db.query(
      `insert into expenses
        (id, branch_id, expense_date, category_id, supplier, description, amount,
         payment_method, deferred, due_date, source, external_id, created_by, status,
         accounting_month, paid_date, payment_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', null, $11, $12, $13, $14, $15)`,
      [
        id,
        branch.id,
        input.expenseDate,
        categoryId,
        input.supplier || null,
        input.description || null,
        input.amount,
        prepared.paymentMethod,
        prepared.deferred,
        prepared.dueDate,
        req.user!.id,
        input.status,
        prepared.accountingMonth,
        prepared.paidDate,
        prepared.paymentType
      ]
    );

    res.status(201).json({ id });
  });

  app.put("/api/expenses/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = expenseInputSchema.parse(req.body);
    const existing = await db.query<{ id: string }>(
      `select e.id
       from expenses e
       join branches b on b.id = e.branch_id
       where e.id = $1 and b.organization_id = $2`,
      [req.params.id, req.user!.organization_id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }

    const categoryId = await resolveExpenseCategory(db, req.user!.organization_id, input.categoryId, input.categoryName);
    const prepared = prepareExpenseInput(input);
    await db.query(
      `update expenses
       set expense_date = $1,
           category_id = $2,
           supplier = $3,
           description = $4,
           amount = $5,
           payment_method = $6,
           deferred = $7,
           due_date = $8,
           status = $9,
           accounting_month = $10,
           paid_date = $11,
           payment_type = $12
       where id = $13`,
      [
        input.expenseDate,
        categoryId,
        input.supplier || null,
        input.description || null,
        input.amount,
        prepared.paymentMethod,
        prepared.deferred,
        prepared.dueDate,
        input.status,
        prepared.accountingMonth,
        prepared.paidDate,
        prepared.paymentType,
        req.params.id
      ]
    );

    res.json({ ok: true });
  });

  app.patch("/api/expenses/:id/pay", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = markPaidSchema.parse(req.body ?? {});
    const result = await db.query<{ id: string }>(
      `update expenses e
       set status = 'paid',
           paid_date = $1,
           deferred = false
       from branches b
       where b.id = e.branch_id
         and e.id = $2
         and b.organization_id = $3
       returning e.id`,
      [input.paidDate, req.params.id, req.user!.organization_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }

    res.json({ ok: true });
  });

  app.get("/api/investors", requireAuth, async (req, res) => {
    await ensureDefaultInvestors(req.user!.organization_id);
    const rows = await db.query(
      `select id,
              name,
              ownership_percent::text as ownership_percent,
              active
       from investors
       where organization_id = $1
       order by active desc, name`,
      [req.user!.organization_id]
    );

    res.json({ investors: rows.rows });
  });

  app.post("/api/investors", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = investorInputSchema.parse(req.body ?? {});
    const id = randomUUID();

    await db.query(
      `insert into investors (id, organization_id, name, ownership_percent, active)
       values ($1, $2, $3, $4, true)
       on conflict (organization_id, name)
       do update set ownership_percent = excluded.ownership_percent,
                     active = true,
                     updated_at = now()
       returning id`,
      [id, req.user!.organization_id, input.name, input.ownershipPercent]
    );

    res.status(201).json({ id });
  });

  app.get("/api/profit-withdrawals", requireAuth, async (req, res) => {
    const month = readMonth(req) ?? todayArgentina().slice(0, 7);
    const rows = await db.query(
      `select pw.id,
              pw.withdrawal_month,
              pw.withdrawal_date::text as withdrawal_date,
              pw.amount::text as amount,
              pw.status,
              pw.payment_method,
              pw.notes,
              i.id as investor_id,
              i.name as investor_name,
              i.ownership_percent::text as ownership_percent
       from profit_withdrawals pw
       join branches b on b.id = pw.branch_id
       join investors i on i.id = pw.investor_id
       where b.organization_id = $1
         and pw.withdrawal_month = $2
       order by pw.withdrawal_date desc, i.name`,
      [req.user!.organization_id, month]
    );

    const summary = await db.query<{ status: string; total: string; records: string }>(
      `select pw.status,
              coalesce(sum(pw.amount), 0)::text as total,
              count(pw.id)::text as records
       from profit_withdrawals pw
       join branches b on b.id = pw.branch_id
       where b.organization_id = $1
         and pw.withdrawal_month = $2
       group by pw.status`,
      [req.user!.organization_id, month]
    );

    res.json({
      month,
      summary: {
        total: sumRows(summary.rows.map((row) => Number(row.total))),
        paid: Number(summary.rows.find((row) => row.status === "paid")?.total ?? 0),
        pending: Number(summary.rows.find((row) => row.status === "pending")?.total ?? 0),
        records: sumRows(summary.rows.map((row) => Number(row.records)))
      },
      withdrawals: rows.rows
    });
  });

  app.post("/api/profit-withdrawals", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = withdrawalInputSchema.parse(req.body ?? {});
    const branch = await getDefaultBranch(req.user!.organization_id);
    await ensureDefaultInvestors(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para cargar retiros" });
      return;
    }

    const investor = await db.query<{ id: string }>(
      `select id
       from investors
       where id = $1
         and organization_id = $2
         and active = true`,
      [input.investorId, req.user!.organization_id]
    );

    if (investor.rows.length === 0) {
      res.status(400).json({ error: "Socio/inversor invalido" });
      return;
    }

    const id = randomUUID();
    await db.query(
      `insert into profit_withdrawals
        (id, branch_id, investor_id, withdrawal_month, withdrawal_date, amount, status, payment_method, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        branch.id,
        input.investorId,
        input.withdrawalMonth || input.withdrawalDate.slice(0, 7),
        input.withdrawalDate,
        input.amount,
        input.status,
        input.paymentMethod || null,
        input.notes || null
      ]
    );

    res.status(201).json({ id });
  });

  app.delete("/api/profit-withdrawals/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const result = await db.query<{ id: string }>(
      `delete from profit_withdrawals pw
       using branches b
       where b.id = pw.branch_id
         and pw.id = $1
         and b.organization_id = $2
       returning pw.id`,
      [req.params.id, req.user!.organization_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Retiro no encontrado" });
      return;
    }

    res.json({ ok: true });
  });

  app.delete("/api/expenses/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const result = await db.query<{ id: string }>(
      `delete from expenses e
       using branches b
       where b.id = e.branch_id
         and e.id = $1
         and b.organization_id = $2
       returning e.id`,
      [req.params.id, req.user!.organization_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }

    res.json({ ok: true });
  });

  app.post("/api/imports/expenses-sheet", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = expenseImportSchema.parse(req.body ?? {});
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para importar gastos" });
      return;
    }

    const workbook = await downloadWorkbook(input.url);
    const parsed = parseExpenseRows(workbook);

    if (parsed.length === 0) {
      res.status(400).json({ error: "No encontre filas validas en CONTROL DE GASTOS" });
      return;
    }

    let created = 0;
    let updated = 0;
    const categories = new Set<string>();

    await db.transaction(async (tx) => {
      for (const row of parsed) {
        const categoryId = await ensureExpenseCategory(tx, req.user!.organization_id, row.categoryName);
        categories.add(row.categoryName);
        const existing = await tx.query<{ id: string }>(
          `select id
           from expenses
           where branch_id = $1
             and source = 'google-sheet-expenses'
             and external_id = $2`,
          [branch.id, row.externalId]
        );

        if (existing.rows[0]) {
          updated += 1;
          const prepared = prepareImportedExpense(row);
          await tx.query(
            `update expenses
             set expense_date = $1,
                 category_id = $2,
                 supplier = null,
                 description = $3,
                 amount = $4,
                 payment_method = $5,
                 status = $6,
                 deferred = $7,
                 due_date = $8,
                 accounting_month = $9,
                 paid_date = $10,
                 payment_type = $11
             where id = $12`,
            [
              row.expenseDate,
              categoryId,
              row.description || null,
              row.amount,
              prepared.paymentMethod,
              row.status,
              prepared.deferred,
              prepared.dueDate,
              prepared.accountingMonth,
              prepared.paidDate,
              prepared.paymentType,
              existing.rows[0].id
            ]
          );
          continue;
        }

        created += 1;
        const prepared = prepareImportedExpense(row);
        await tx.query(
          `insert into expenses
            (id, branch_id, expense_date, category_id, supplier, description, amount,
             payment_method, deferred, due_date, source, external_id, created_by, status,
             accounting_month, paid_date, payment_type)
           values ($1, $2, $3, $4, null, $5, $6, $7, $8, $9,
             'google-sheet-expenses', $10, $11, $12, $13, $14, $15)`,
          [
            randomUUID(),
            branch.id,
            row.expenseDate,
            categoryId,
            row.description || null,
            row.amount,
            prepared.paymentMethod,
            prepared.deferred,
            prepared.dueDate,
            row.externalId,
            req.user!.id,
            row.status,
            prepared.accountingMonth,
            prepared.paidDate,
            prepared.paymentType
          ]
        );
      }

      await tx.query(
        `insert into imports
          (id, branch_id, source, filename, date_from, date_to, rows_processed,
           rows_created, rows_updated, rows_rejected, status, error_log)
         values ($1, $2, 'google-sheet-expenses', $3, $4, $5, $6, $7, $8, 0, 'success', null)`,
        [
          randomUUID(),
          branch.id,
          workbook.Workbook?.Names?.[0]?.Name ?? "Planilla Dulce Hora",
          parsed.map((row) => row.expenseDate).sort()[0],
          parsed.map((row) => row.expenseDate).sort().at(-1),
          parsed.length,
          created,
          updated
        ]
      );
    });

    res.status(201).json({
      rowsReceived: parsed.length,
      rowsCreated: created,
      rowsUpdated: updated,
      categories: [...categories].sort((a, b) => a.localeCompare(b, "es-AR"))
    });
  });
}

function readDateRange(req: Request): DateRange {
  const from = typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
    ? req.query.from
    : null;
  const to = typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : null;
  return { from, to };
}

function addDateRangeFilter(filters: string[], params: unknown[], column: string, range: DateRange) {
  if (range.from) {
    params.push(range.from);
    filters.push(`${column} >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    filters.push(`${column} <= $${params.length}`);
  }
}

function addAccountingRangeFilter(filters: string[], params: unknown[], range: DateRange) {
  if (range.from) {
    params.push(range.from.slice(0, 7));
    filters.push(`coalesce(e.accounting_month, substring(e.expense_date::text from 1 for 7)) >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to.slice(0, 7));
    filters.push(`coalesce(e.accounting_month, substring(e.expense_date::text from 1 for 7)) <= $${params.length}`);
  }
}

function readMonth(req: Request) {
  const value = typeof req.query.month === "string" ? req.query.month : "";
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function prepareExpenseInput(input: z.infer<typeof expenseInputSchema>) {
  const paymentType = input.paymentType;
  const isCreditCard = paymentType === "credit_card";
  const isDeferred = paymentType === "deferred";
  const status = input.status;
  const dueDate = status === "pending" ? input.dueDate || (isCreditCard ? nextCreditCardPaymentDate(input.expenseDate) : null) : null;

  return {
    accountingMonth: input.accountingMonth || input.expenseDate.slice(0, 7),
    paidDate: status === "paid" ? input.paidDate || input.expenseDate : null,
    paymentType,
    paymentMethod: input.paymentMethod || defaultPaymentMethod(paymentType),
    deferred: status === "pending" || input.deferred || isCreditCard || isDeferred,
    dueDate
  };
}

function prepareImportedExpense(input: ParsedExpense) {
  const dueDate =
    input.status === "pending" && input.paymentType === "credit_card" ? nextCreditCardPaymentDate(input.expenseDate) : null;

  return {
    accountingMonth: input.expenseDate.slice(0, 7),
    paidDate: input.status === "paid" ? input.expenseDate : null,
    paymentType: input.paymentType,
    paymentMethod: input.paymentMethod || defaultPaymentMethod(input.paymentType),
    deferred: input.status === "pending" || input.paymentType === "credit_card" || input.paymentType === "deferred",
    dueDate
  };
}

async function resolveExpenseCategory(
  queryable: Queryable,
  organizationId: string,
  categoryId?: string | null,
  categoryName?: string
) {
  if (categoryId) {
    const existing = await queryable.query<{ id: string }>(
      `select id
       from expense_categories
       where id = $1
         and organization_id = $2
         and coalesce(active, true) = true
         and pnl_group <> 'capex'`,
      [categoryId, organizationId]
    );
    if (existing.rows[0]) return existing.rows[0].id;
  }

  if (categoryName?.trim()) {
    return ensureExpenseCategory(queryable, organizationId, categoryName.trim());
  }

  return null;
}

async function ensureDefaultInvestors(organizationId: string) {
  const existing = await db.query<{ records: string }>(
    `select count(id)::text as records
     from investors
     where organization_id = $1`,
    [organizationId]
  );

  if (Number(existing.rows[0]?.records ?? 0) > 0) return;

  await db.query(
    `insert into investors (id, organization_id, name, ownership_percent, active)
     values ($1, $2, 'Diego', 50, true),
            ($3, $2, 'Eduardo', 50, true)
     on conflict (organization_id, name) do nothing`,
    [randomUUID(), organizationId, randomUUID()]
  );
}

async function ensureExpenseCategory(queryable: Queryable, organizationId: string, name: string) {
  const normalizedName = name.trim();
  const existing = await queryable.query<{ id: string }>(
    `select id
     from expense_categories
     where organization_id = $1 and lower(name) = lower($2)`,
    [organizationId, normalizedName]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  const pnlGroup = pnlGroupForCategory(normalizedName);
  await queryable.query(
    `insert into expense_categories (id, organization_id, name, pnl_group, active)
     values ($1, $2, $3, $4, $5)`,
    [id, organizationId, normalizedName, pnlGroup, pnlGroup !== "capex"]
  );
  return id;
}

async function downloadWorkbook(url: string) {
  const response = await fetch(spreadsheetDownloadUrl(url));
  if (!response.ok) {
    throw new Error(`No se pudo descargar la planilla (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

function spreadsheetDownloadUrl(url: string) {
  const match = url.match(/\/d\/([^/?#]+)/);
  if (match?.[1]) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  return url;
}

function parseExpenseRows(workbook: XLSX.WorkBook): ParsedExpense[] {
  const sheetName =
    workbook.SheetNames.find((name) => normalize(name).includes("control de gastos")) ??
    workbook.SheetNames.find((name) => normalize(name).includes("gasto"));

  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false
  });
  const headerIndex = rows.findIndex((row) => {
    const cells = row.map((cell) => normalize(cell));
    return cells.includes("categoria") && cells.includes("monto") && cells.includes("descripcion");
  });

  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((cell) => normalize(cell));
  const index = (label: string) => headers.findIndex((header) => header === label);
  const yearIndex = index("ano");
  const monthIndex = index("mes");
  const dateIndex = index("fecha");
  const categoryIndex = index("categoria");
  const statusIndex = index("pagado");
  const amountIndex = index("monto");
  const descriptionIndex = index("descripcion");
  const paymentIndex = index("forma");
  const parsed: ParsedExpense[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const categoryName = toText(row[categoryIndex]);
    const amount = toNumber(row[amountIndex]);
    if (!categoryName || amount <= 0) continue;

    const year = toNumber(row[yearIndex]);
    const monthName = toText(row[monthIndex]);
    const expenseDate = parseDate(row[dateIndex], year, monthName);
    if (!expenseDate) continue;

    const description = toText(row[descriptionIndex]);
    parsed.push({
      expenseDate,
      categoryName,
      status: normalize(row[statusIndex]).includes("pendiente") ? "pending" : "paid",
      amount,
      description,
      paymentMethod: toText(row[paymentIndex]) || null,
      paymentType: inferPaymentType(toText(row[paymentIndex])),
      externalId: stableExternalId(rowIndex, expenseDate, categoryName, amount, description)
    });
  }

  return parsed;
}

function parseDate(value: unknown, year: number, monthName: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);

  if (typeof value === "number" && value > 1) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  const text = toText(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dayMonth = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = Number(dayMonth[2]);
    const parsedYear = Number(dayMonth[3] ?? year);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && parsedYear > 2000) {
      return `${parsedYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const month = monthNumber(monthName);
  if (year > 2000 && month) return `${year}-${String(month).padStart(2, "0")}-01`;
  return null;
}

function stableExternalId(rowIndex: number, date: string, category: string, amount: number, description: string) {
  return [
    "expense-sheet",
    rowIndex,
    date,
    normalize(category).replaceAll(" ", "-"),
    amount.toFixed(2),
    normalize(description).slice(0, 44).replaceAll(" ", "-")
  ].join(":");
}

function monthNumber(value: string) {
  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12
  };
  return months[normalize(value)];
}

function pnlGroupForCategory(value: string) {
  const normalized = normalize(value);
  if (normalized.includes("proveedor") || normalized.includes("compra")) return "cogs";
  if (normalized.includes("inversion")) return "capex";
  return "operating";
}

function inferPaymentType(value: string): PaymentType {
  const normalized = normalize(value);
  if (normalized.includes("tc") || normalized.includes("tarjeta credito") || normalized.includes("credito")) return "credit_card";
  if (normalized.includes("debito") || normalized.includes("posnet")) return "posnet";
  if (normalized.includes("transfer") || normalized.includes("banco")) return "bank";
  if (normalized.includes("virtual") || normalized.includes("mercado pago") || normalized.includes("mp")) return "virtual";
  if (normalized.includes("pendiente") || normalized.includes("difer")) return "deferred";
  if (normalized.includes("efectivo")) return "cash";
  return "other";
}

function defaultPaymentMethod(paymentType: PaymentType) {
  const labels: Record<PaymentType, string> = {
    cash: "Efectivo",
    bank: "Transferencia",
    virtual: "Billetera virtual",
    posnet: "Posnet",
    credit_card: "TC",
    deferred: "Diferido",
    other: "Otro"
  };
  return labels[paymentType];
}

function nextCreditCardPaymentDate(expenseDate: string) {
  const [year, month, day] = expenseDate.split("-").map(Number);
  const paymentMonthDate = day <= 10 ? new Date(year, month - 1, 10) : new Date(year, month, 10);
  return formatDate(paymentMonthDate);
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

function sumRows(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function normalize(value: unknown) {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = toText(value)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0")
  ].join("-");
}

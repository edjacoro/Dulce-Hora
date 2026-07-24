import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  attachUser,
  clearSession,
  createSession,
  hashPassword,
  requireAuth,
  requireRole,
  verifyPassword
} from "./auth.js";
import { db, migrate, queryOne } from "./db.js";
import { dulceHoraCredentialsConfigured } from "./dulceHoraClient.js";
import {
  getDefaultBranch,
  syncDulceHoraDate,
  syncDulceHoraHistory,
  syncDulceHoraWasteHistory
} from "./dulceHoraSync.js";
import { registerCashflowRoutes } from "./cashflow.js";
import { registerExpenseRoutes } from "./expenses.js";
import { registerFinanceRoutes } from "./finance.js";
import { registerScheduleRoutes } from "./schedule.js";

export const app = express();
const port = Number(process.env.PORT ?? 8787);
let migrationPromise: Promise<void> | null = null;
const dulceHoraOwnerEmail = "dulcehoraurquiza@gmail.com";
const diegoSeedPasswordHash = "$2b$12$SfJRpDgCVuJt9DnJGBqd5.lzy1DBTQkrUtBQSlJO6Keoesf0fti0a";
const defaultEmployeeSeeds = [
  {
    name: "Diego",
    role: "Dueno",
    weeklyHours: 56,
    color: "#2f66b3",
    scheduleTemplate:
      '{"mode":"fixed","label":"Horario fijo Diego","rotation":"diego","fixedShifts":[{"days":"Lunes a sabados","startTime":"06:30","endTime":"11:30"},{"days":"Lunes a sabados","startTime":"16:30","endTime":"20:00"},{"days":"Domingos","startTime":"06:30","endTime":"11:30"}],"notes":"Dueno. Horario base del local."}'
  },
  {
    name: "Vicky",
    role: "Equipo",
    weeklyHours: 42,
    color: "#c05a9e",
    scheduleTemplate:
      '{"mode":"rotating","label":"Rotacion Vicky","rotation":"vicky","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Lunes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Martes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Domingos","startTime":"11:30","endTime":"19:30"}],"notes":"Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."}'
  },
  {
    name: "Mica",
    role: "Equipo",
    weeklyHours: 42,
    color: "#1f9d55",
    scheduleTemplate:
      '{"mode":"rotating","label":"Rotacion Mica","rotation":"mica","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Martes a sabados","startTime":"06:30","endTime":"13:30"},{"weeks":"Semanas 1 y 3","days":"Domingos","startTime":"11:30","endTime":"19:30"},{"weeks":"Semanas 2 y 4","days":"Lunes a sabados","startTime":"06:30","endTime":"13:30"}],"notes":"Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."}'
  },
  {
    name: "Romi",
    role: "Equipo",
    weeklyHours: 35,
    color: "#f59e0b",
    scheduleTemplate:
      '{"mode":"fixed","label":"Horario fijo Romi","rotation":"romi","fixedShifts":[{"days":"Miercoles a sabados","startTime":"13:00","endTime":"20:00"},{"days":"Domingos","startTime":"07:30","endTime":"14:30"}],"notes":"Horario base cargado desde grilla."}'
  }
] as const;

app.use(express.json({ limit: "5mb" }));
app.use(attachUser);
registerExpenseRoutes(app);
registerFinanceRoutes(app);
registerScheduleRoutes(app);
registerCashflowRoutes(app);

const setupSchema = z.object({
  organizationName: z.string().trim().min(2),
  taxId: z.string().trim().optional().default(""),
  branchName: z.string().trim().min(2),
  branchAddress: z.string().trim().optional().default(""),
  ownerName: z.string().trim().min(2),
  ownerEmail: z.string().trim().email(),
  ownerPassword: z.string().min(10)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const syncDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branchId: z.string().optional(),
  includeWaste: z.boolean().optional(),
  includeStatistics: z.boolean().optional()
});
const syncHistorySchema = z.object({
  branchId: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
});
const portalSalesImportSchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        provider: z.enum(["pedidosya", "rappi", "otro"]),
        paymentKind: z.enum(["online", "cash"]).optional().default("online"),
        total: z.number().positive(),
        orders: z.number().int().positive().max(1000),
        hour: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional()
          .nullable(),
        notes: z.string().trim().max(500).optional().default("")
      })
    )
    .min(1)
    .max(200)
});
const corporateSaleSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  saleTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  customerName: z.string().trim().max(180).optional().default(""),
  total: z.number().positive(),
  paymentMethod: z.enum(["efectivo", "virtual", "credito", "debito", "otro"]).optional().default("virtual"),
  notes: z.string().trim().max(500).optional().default("")
});

type DateRange = {
  from: string | null;
  to: string | null;
};

const netTotal = "case when sd.status = 'credit_note' then -abs(sd.total) else sd.total end";

async function usersCount() {
  const row = await queryOne<{ count: string }>("select count(*)::text as count from users");
  return Number(row?.count ?? 0);
}

async function audit(
  organizationId: string,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string,
  previousValue: unknown = null,
  newValue: unknown = null
) {
  await db.query(
    `insert into audit_logs
      (id, organization_id, user_id, action, entity, entity_id, previous_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      organizationId,
      userId,
      action,
      entity,
      entityId,
      JSON.stringify(previousValue),
      JSON.stringify(newValue)
    ]
  );
}

function readDateRange(req: express.Request): DateRange {
  const from = typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
    ? req.query.from
    : null;
  const to = typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
    ? req.query.to
    : null;
  return { from, to };
}

function addDateRangeFilter(
  filters: string[],
  params: unknown[],
  column: string,
  range: DateRange
) {
  if (range.from) {
    params.push(range.from);
    filters.push(`${column} >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    filters.push(`${column} <= $${params.length}`);
  }
}

app.get("/api/health", async (_req, res) => {
  const migrations = await db.query("select id, applied_at from schema_migrations order by id");
  res.json({ ok: true, service: "dulce-hora-control-api", migrations: migrations.rows });
});

app.get("/api/setup/status", async (_req, res) => {
  res.json({ required: (await usersCount()) === 0 });
});

app.post("/api/setup", async (req, res) => {
  if ((await usersCount()) > 0) {
    res.status(409).json({ error: "La configuracion inicial ya fue realizada" });
    return;
  }

  const input = setupSchema.parse(req.body);
  const organizationId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.ownerPassword);

  await db.transaction(async (tx) => {
    await tx.query(
      `insert into organizations (id, name, tax_id, currency, timezone)
       values ($1, $2, $3, 'ARS', 'America/Argentina/Buenos_Aires')`,
      [organizationId, input.organizationName, input.taxId || null]
    );
    await tx.query(
      `insert into branches (id, organization_id, name, address, external_code, active)
       values ($1, $2, $3, $4, $5, true)`,
      [branchId, organizationId, input.branchName, input.branchAddress || null, "villa-urquiza"]
    );
    await tx.query(
      `insert into users (id, organization_id, name, email, password_hash, role, active)
       values ($1, $2, $3, lower($4), $5, 'owner', true)`,
      [userId, organizationId, input.ownerName, input.ownerEmail, passwordHash]
    );

    if (input.ownerEmail.toLowerCase() === dulceHoraOwnerEmail && input.ownerName.toLowerCase() !== "diego") {
      await tx.query(
        `insert into users (id, organization_id, name, email, password_hash, role, active, avatar_url)
         values ($1, $2, 'Diego', $3, $4, 'owner', true, '/users/diego.png')
         on conflict (organization_id, email, name)
         do update set password_hash = excluded.password_hash,
                       role = excluded.role,
                       active = excluded.active,
                       avatar_url = excluded.avatar_url`,
        [randomUUID(), organizationId, dulceHoraOwnerEmail, diegoSeedPasswordHash]
      );
    }

    for (const employee of defaultEmployeeSeeds) {
      await tx.query(
        `insert into employees
          (id, organization_id, name, role, weekly_hours, monthly_net_salary,
           monthly_gross_salary, employer_cost, active, source, schedule_template, color, photo_url, on_payroll)
         values ($1, $2, $3, $4, $5, 0, null, null, true, 'default-schedule-v6', $6, $7, null, false)
         on conflict (organization_id, name)
         do update set weekly_hours = case
                         when employees.weekly_hours <= 0 then excluded.weekly_hours
                         else employees.weekly_hours
                       end,
                       role = case
                         when employees.role is null or employees.role = '' then excluded.role
                         else employees.role
                       end,
                       schedule_template = case
                         when coalesce(nullif(employees.schedule_template, ''), '{}') = '{}' then excluded.schedule_template
                         else employees.schedule_template
                       end,
                       color = coalesce(employees.color, excluded.color),
                       active = true,
                       updated_at = now()`,
        [
          randomUUID(),
          organizationId,
          employee.name,
          employee.role,
          employee.weeklyHours,
          employee.scheduleTemplate,
          employee.color
        ]
      );
    }

    const expenseCategories = [
      ["Materia prima", "cogs"],
      ["Personal", "operating"],
      ["Cargas sociales", "operating"],
      ["Alquiler", "operating"],
      ["Servicios", "operating"],
      ["Mantenimiento", "operating"],
      ["Comisiones", "operating"],
      ["Impuestos", "operating"],
      ["Franquicia y regalias", "operating"],
      ["Marketing", "operating"],
      ["Logistica", "operating"],
      ["Otros", "operating"]
    ];

    for (const [name, pnlGroup] of expenseCategories) {
      await tx.query(
        `insert into expense_categories (id, organization_id, name, pnl_group)
         values ($1, $2, $3, $4)`,
        [randomUUID(), organizationId, name, pnlGroup]
      );
    }

    const categories = ["Panificados", "Cafeteria", "Tortas y postres", "Almuerzos", "Bebidas"];
    for (const name of categories) {
      await tx.query(
        `insert into categories (id, organization_id, name, target_margin, active)
         values ($1, $2, $3, null, true)`,
        [randomUUID(), organizationId, name]
      );
    }
  });

  await audit(organizationId, userId, "setup.completed", "organization", organizationId, null, {
    organizationName: input.organizationName,
    branchName: input.branchName
  });
  await createSession(res, userId);
  res.status(201).json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const candidates = await db.query<{
    id: string;
    organization_id: string;
    email: string;
    password_hash: string;
    active: boolean;
  }>(
    `select id, organization_id, email, password_hash, active
     from users
     where email = lower($1)
     order by created_at`,
    [input.email]
  );

  let user: (typeof candidates.rows)[number] | null = null;
  for (const candidate of candidates.rows) {
    if (candidate.active && (await verifyPassword(input.password, candidate.password_hash))) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  await createSession(res, user.id);
  await audit(user.organization_id, user.id, "auth.login", "user", user.id);
  res.json({ ok: true });
});

app.post("/api/auth/logout", async (req, res) => {
  await clearSession(req, res);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const organization = await queryOne(
    "select id, name, tax_id, currency, timezone, created_at from organizations where id = $1",
    [req.user!.organization_id]
  );
  const branches = await db.query(
    `select id, name, address, external_code, active, created_at
     from branches
     where organization_id = $1
     order by created_at`,
    [req.user!.organization_id]
  );

  res.json({ user: req.user, organization, branches: branches.rows });
});

app.get("/api/dashboard/overview", requireAuth, async (req, res) => {
  const organizationId = req.user!.organization_id;
  const counts = await queryOne<{
    branches: string;
    users: string;
    sales_documents: string;
    sale_items: string;
    imports: string;
    sync_runs: string;
    products: string;
    waste_records: string;
    expenses: string;
  }>(
    `select
      (select count(*)::text from branches where organization_id = $1) as branches,
      (select count(*)::text from users where organization_id = $1) as users,
      (select count(*)::text from sales_documents sd join branches b on b.id = sd.branch_id where b.organization_id = $1) as sales_documents,
      (select count(*)::text from sale_items si join sales_documents sd on sd.id = si.sales_document_id join branches b on b.id = sd.branch_id where b.organization_id = $1) as sale_items,
      (select count(*)::text from imports i join branches b on b.id = i.branch_id where b.organization_id = $1) as imports,
      (select count(*)::text from sync_runs sr join branches b on b.id = sr.branch_id where b.organization_id = $1) as sync_runs,
      (select count(*)::text from products where organization_id = $1) as products,
      (select count(*)::text from waste_records wr join branches b on b.id = wr.branch_id where b.organization_id = $1) as waste_records,
      (select count(*)::text
       from expenses e
       join branches b on b.id = e.branch_id
       left join expense_categories ec on ec.id = e.category_id
       where b.organization_id = $1
         and coalesce(ec.pnl_group, 'operating') <> 'capex') as expenses`,
    [organizationId]
  );

  res.json({
    counts: {
      branches: Number(counts?.branches ?? 0),
      users: Number(counts?.users ?? 0),
      salesDocuments: Number(counts?.sales_documents ?? 0),
      saleItems: Number(counts?.sale_items ?? 0),
      imports: Number(counts?.imports ?? 0),
      syncRuns: Number(counts?.sync_runs ?? 0),
      products: Number(counts?.products ?? 0),
      wasteRecords: Number(counts?.waste_records ?? 0),
      expenses: Number(counts?.expenses ?? 0)
    },
    dataStatus:
      Number(counts?.sales_documents ?? 0) === 0
        ? "Sin ventas importadas"
        : "Datos de ventas disponibles"
  });
});

app.get("/api/settings", requireAuth, async (req, res) => {
  const organizationId = req.user!.organization_id;
  const [users, branches, categories, expenseCategories, auditLogs] = await Promise.all([
    db.query(
      `select id, name, email, role, active, avatar_url, created_at
       from users
       where organization_id = $1
       order by created_at`,
      [organizationId]
    ),
    db.query(
      `select id, name, address, external_code, active, created_at
       from branches
       where organization_id = $1
       order by created_at`,
      [organizationId]
    ),
    db.query(
      `select id, name, target_margin, active
       from categories
       where organization_id = $1
       order by name`,
      [organizationId]
    ),
    db.query(
      `select id, name, pnl_group
       from expense_categories
       where organization_id = $1
         and coalesce(active, true) = true
         and pnl_group <> 'capex'
       order by name`,
      [organizationId]
    ),
    db.query(
      `select action, entity, entity_id, created_at
       from audit_logs
       where organization_id = $1
       order by created_at desc
       limit 20`,
      [organizationId]
    )
  ]);

  res.json({
    users: users.rows,
    branches: branches.rows,
    categories: categories.rows,
    expenseCategories: expenseCategories.rows,
    auditLogs: auditLogs.rows
  });
});

app.get("/api/sales/documents", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 80), 200);
  const range = readDateRange(req);
  const params: unknown[] = [req.user!.organization_id];
  const filters = ["b.organization_id = $1"];
  addDateRangeFilter(filters, params, "sd.sale_date", range);
  params.push(limit);

  const rows = await db.query(
    `select sd.id,
            sd.external_id,
            sd.document_number,
            sd.document_type,
            sd.sale_date::text as sale_date,
            sd.sale_time,
            sd.total,
            sd.payment_method,
            sd.status,
            sd.source,
            sd.imported_at,
            b.name as branch_name,
            count(si.id)::text as item_count
     from sales_documents sd
     join branches b on b.id = sd.branch_id
     left join sale_items si on si.sales_document_id = sd.id
     where ${filters.join(" and ")}
     group by sd.id, b.name
     order by sd.sale_date desc, sd.sale_time desc nulls last, sd.imported_at desc
     limit $${params.length}`,
    params
  );

  res.json({ documents: rows.rows });
});

app.get("/api/sales/summary", requireAuth, async (req, res) => {
  const range = readDateRange(req);
  const params: unknown[] = [req.user!.organization_id];
  const filters = ["b.organization_id = $1"];
  addDateRangeFilter(filters, params, "sd.sale_date", range);
  const where = filters.join(" and ");
  const netTotal = "case when sd.status = 'credit_note' then -abs(sd.total) else sd.total end";
  const paymentLabel = `case
        when lower(coalesce(sd.raw_data->>'provider', '')) = 'rappi'
          or lower(coalesce(sd.raw_data->>'providerLabel', '')) like '%rappi%'
          or lower(coalesce(sd.payment_method, '')) like '%rappi%' then 'Rappi'
        when lower(coalesce(sd.raw_data->>'provider', '')) in ('pedidosya', 'pedidos ya')
          or lower(coalesce(sd.raw_data->>'providerLabel', '')) like '%pedido%'
          or lower(coalesce(sd.payment_method, '')) like '%pedido%' then 'Pedidos Ya'
        when lower(coalesce(nullif(sd.payment_method, ''), 'Sin dato')) = 'virtual' then 'Transferencias'
        when lower(coalesce(nullif(sd.payment_method, ''), 'Sin dato')) = 'credito' then 'Posnet'
        when lower(coalesce(nullif(sd.payment_method, ''), 'Sin dato')) = 'debito' then 'Cuenta DNI'
        when lower(coalesce(nullif(sd.payment_method, ''), 'Sin dato')) = 'efectivo' then 'efectivo'
        when lower(coalesce(nullif(sd.payment_method, ''), 'Sin dato')) = 'multiple' then 'Mixto Dulce Hora'
        else coalesce(nullif(sd.payment_method, ''), 'Sin dato')
      end`;

  const [summary, byDate, byPayment, byHour, topProducts] = await Promise.all([
    queryOne<{
      net_sales: string;
      gross_sales: string;
      documents: string;
      tickets: string;
      item_units: string;
      coffee_units: string;
    }>(
      `select
         coalesce(sum(${netTotal}), 0)::text as net_sales,
         coalesce(sum(sd.total), 0)::text as gross_sales,
         count(sd.id)::text as documents,
         sum(case when sd.status = 'active' then 1 else 0 end)::text as tickets,
         coalesce(sum((select count(si.id) from sale_items si where si.sales_document_id = sd.id)), 0)::text as item_units,
         coalesce(sum((
           select coalesce(sum(
             case
               when lower(coalesce(p.canonical_name, si.original_name)) like '%cafe%'
                 or lower(coalesce(p.canonical_name, si.original_name)) like '%café%'
               then si.quantity
               else 0
             end
           ), 0)
           from sale_items si
           left join products p on p.id = si.normalized_product_id
           where si.sales_document_id = sd.id
         )), 0)::text as coffee_units
       from sales_documents sd
       join branches b on b.id = sd.branch_id
       where ${where} and sd.status <> 'credited'`,
      params
    ),
    db.query(
      `select sd.sale_date::text as label,
              coalesce(sum(${netTotal}), 0)::text as total,
              count(sd.id)::text as documents
       from sales_documents sd
       join branches b on b.id = sd.branch_id
       where ${where} and sd.status <> 'credited'
       group by sd.sale_date
       order by sd.sale_date`,
      params
    ),
    db.query(
      `select ${paymentLabel} as label,
              coalesce(sum(${netTotal}), 0)::text as total,
              count(sd.id)::text as documents
       from sales_documents sd
       join branches b on b.id = sd.branch_id
       where ${where} and sd.status <> 'credited'
       group by ${paymentLabel}
       order by coalesce(sum(${netTotal}), 0) desc`,
      params
    ),
    db.query(
      `select coalesce(substring(sd.sale_time::text from 1 for 2), 'Sin hora') as label,
              coalesce(sum(${netTotal}), 0)::text as total,
              count(sd.id)::text as documents
       from sales_documents sd
       join branches b on b.id = sd.branch_id
       where ${where} and sd.status <> 'credited'
       group by coalesce(substring(sd.sale_time::text from 1 for 2), 'Sin hora')
       order by label`,
      params
    ),
    db.query(
      `select coalesce(p.canonical_name, si.original_name) as label,
              coalesce(sum(si.quantity), 0)::text as quantity,
              coalesce(sum(si.line_total), 0)::text as total
       from sale_items si
       join sales_documents sd on sd.id = si.sales_document_id
       join branches b on b.id = sd.branch_id
       left join products p on p.id = si.normalized_product_id
       where ${where} and sd.status = 'active'
       group by coalesce(p.canonical_name, si.original_name)
       order by coalesce(sum(si.line_total), 0) desc
       limit 10`,
      params
    )
  ]);

  const netSales = Number(summary?.net_sales ?? 0);
  const tickets = Number(summary?.tickets ?? 0);
  const itemUnits = Number(summary?.item_units ?? 0);
  const coffeeUnits = Number(summary?.coffee_units ?? 0);

  res.json({
    range,
    summary: {
      netSales,
      grossSales: Number(summary?.gross_sales ?? 0),
      documents: Number(summary?.documents ?? 0),
      tickets,
      averageTicket: tickets > 0 ? netSales / tickets : 0,
      unitsPerTicket: tickets > 0 ? itemUnits / tickets : 0,
      coffeeCount: coffeeUnits
    },
    byDate: byDate.rows,
    byPayment: byPayment.rows,
    byHour: byHour.rows,
    topProducts: topProducts.rows
  });
});

app.post("/api/sales/corporate", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
  const input = corporateSaleSchema.parse(req.body ?? {});
  const branch = await getDefaultBranch(req.user!.organization_id);

  if (!branch) {
    res.status(400).json({ error: "No hay una sucursal activa para cargar ventas corporativas" });
    return;
  }

  const id = randomUUID();
  const externalId = `corporate:${input.saleDate}:${id}`;
  const documentNumber = `CORP-${input.saleDate.replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;

  await db.query(
    `insert into sales_documents
      (id, branch_id, external_id, dedupe_key, document_number, document_type,
       sale_date, sale_time, customer_name, subtotal, discount, total, payment_method,
       status, source, raw_data)
     values ($1, $2, $3, $3, $4, 'Venta corporativa',
       $5, $6, $7, $8, 0, $8, $9,
       'active', 'corporate-manual', $10)`,
    [
      id,
      branch.id,
      externalId,
      documentNumber,
      input.saleDate,
      input.saleTime || null,
      input.customerName || null,
      input.total,
      input.paymentMethod,
      JSON.stringify({
        entryType: "corporate-sale",
        notes: input.notes || null,
        customerName: input.customerName || null
      })
    ]
  );

  await audit(req.user!.organization_id, req.user!.id, "sales.corporate.created", "sales_documents", id, null, {
    saleDate: input.saleDate,
    total: input.total,
    paymentMethod: input.paymentMethod
  });

  res.status(201).json({ id });
});

app.get("/api/products/performance", requireAuth, async (req, res) => {
  const range = readDateRange(req);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 120), 20), 300);
  const organizationId = req.user!.organization_id;

  const salesParams: unknown[] = [organizationId];
  const salesFilters = ["b.organization_id = $1", "sd.status = 'active'"];
  addDateRangeFilter(salesFilters, salesParams, "sd.sale_date", range);

  const wasteParams: unknown[] = [organizationId];
  const wasteFilters = ["b.organization_id = $1"];
  addDateRangeFilter(wasteFilters, wasteParams, "wr.date", range);

  const productKey = "coalesce(si.normalized_product_id, 'raw:' || lower(si.original_name))";
  const wasteKey = "coalesce(wr.product_id, 'waste:' || coalesce(p.canonical_name, 'Producto sin nombre'))";

  const [salesRows, salesTotals, wasteRows] = await Promise.all([
    db.query<{
      product_key: string;
      label: string;
      category: string;
      quantity_sold: string;
      revenue: string;
      tickets: string;
    }>(
      `select ${productKey} as product_key,
              coalesce(p.canonical_name, si.original_name) as label,
              coalesce(c.name, 'Sin categoria') as category,
              coalesce(sum(si.quantity), 0)::text as quantity_sold,
              coalesce(sum(si.line_total), 0)::text as revenue,
              count(distinct sd.id)::text as tickets
       from sale_items si
       join sales_documents sd on sd.id = si.sales_document_id
       join branches b on b.id = sd.branch_id
       left join products p on p.id = si.normalized_product_id
       left join categories c on c.id = p.category_id
       where ${salesFilters.join(" and ")}
       group by ${productKey}, coalesce(p.canonical_name, si.original_name), coalesce(c.name, 'Sin categoria')`,
      salesParams
    ),
    queryOne<{
      revenue: string;
      quantity_sold: string;
      tickets: string;
      products: string;
    }>(
      `select coalesce(sum(si.line_total), 0)::text as revenue,
              coalesce(sum(si.quantity), 0)::text as quantity_sold,
              count(distinct sd.id)::text as tickets,
              count(distinct ${productKey})::text as products
       from sale_items si
       join sales_documents sd on sd.id = si.sales_document_id
       join branches b on b.id = sd.branch_id
       left join products p on p.id = si.normalized_product_id
       where ${salesFilters.join(" and ")}`,
      salesParams
    ),
    db.query<{
      product_key: string;
      label: string;
      category: string;
      waste_quantity: string;
      waste_cost: string;
      waste_records: string;
    }>(
      `select ${wasteKey} as product_key,
              coalesce(p.canonical_name, 'Producto sin nombre') as label,
              coalesce(c.name, 'Sin categoria') as category,
              coalesce(sum(wr.quantity), 0)::text as waste_quantity,
              coalesce(sum(wr.total_cost), 0)::text as waste_cost,
              count(wr.id)::text as waste_records
       from waste_records wr
       join branches b on b.id = wr.branch_id
       left join products p on p.id = wr.product_id
       left join categories c on c.id = p.category_id
       where ${wasteFilters.join(" and ")}
       group by ${wasteKey}, coalesce(p.canonical_name, 'Producto sin nombre'), coalesce(c.name, 'Sin categoria')`,
      wasteParams
    )
  ]);

  const rowsByKey = new Map<
    string,
    {
      productKey: string;
      label: string;
      category: string;
      quantitySold: number;
      revenue: number;
      tickets: number;
      wasteQuantity: number;
      wasteCost: number;
      wasteRecords: number;
    }
  >();

  for (const row of salesRows.rows) {
    rowsByKey.set(row.product_key, {
      productKey: row.product_key,
      label: row.label,
      category: row.category,
      quantitySold: toNumber(row.quantity_sold),
      revenue: toNumber(row.revenue),
      tickets: toNumber(row.tickets),
      wasteQuantity: 0,
      wasteCost: 0,
      wasteRecords: 0
    });
  }

  for (const row of wasteRows.rows) {
    const existing = rowsByKey.get(row.product_key);
    if (existing) {
      existing.wasteQuantity = toNumber(row.waste_quantity);
      existing.wasteCost = toNumber(row.waste_cost);
      existing.wasteRecords = toNumber(row.waste_records);
    } else {
      rowsByKey.set(row.product_key, {
        productKey: row.product_key,
        label: row.label,
        category: row.category,
        quantitySold: 0,
        revenue: 0,
        tickets: 0,
        wasteQuantity: toNumber(row.waste_quantity),
        wasteCost: toNumber(row.waste_cost),
        wasteRecords: toNumber(row.waste_records)
      });
    }
  }

  const totalRevenue = toNumber(salesTotals?.revenue);
  const wasteCost = sum([...rowsByKey.values()].map((row) => row.wasteCost));
  const products = [...rowsByKey.values()]
    .map((row) => {
      const share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
      const wasteRate = row.revenue > 0 ? (row.wasteCost / row.revenue) * 100 : row.wasteCost > 0 ? 100 : 0;
      const wasteUnitRate =
        row.quantitySold > 0 ? (row.wasteQuantity / row.quantitySold) * 100 : row.wasteQuantity > 0 ? 100 : 0;
      const averageUnitPrice = row.quantitySold > 0 ? row.revenue / row.quantitySold : 0;
      const signal = productSignal({ share, wasteRate, revenue: row.revenue, wasteCost: row.wasteCost });

      return {
        ...row,
        averageUnitPrice,
        share,
        wasteRate,
        wasteUnitRate,
        netAfterWaste: row.revenue - row.wasteCost,
        signal: signal.label,
        signalTone: signal.tone
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.wasteCost - a.wasteCost || a.label.localeCompare(b.label));

  res.json({
    range,
    summary: {
      revenue: totalRevenue,
      quantitySold: toNumber(salesTotals?.quantity_sold),
      tickets: toNumber(salesTotals?.tickets),
      soldProducts: toNumber(salesTotals?.products),
      totalProducts: products.length,
      wasteCost,
      wasteQuantity: sum(products.map((row) => row.wasteQuantity)),
      wasteRate: totalRevenue > 0 ? (wasteCost / totalRevenue) * 100 : 0,
      topProduct: products.find((row) => row.revenue > 0)?.label ?? null
    },
    products: products.slice(0, limit)
  });
});

app.get("/api/hours/performance", requireAuth, async (req, res) => {
  const range = readDateRange(req);
  const organizationId = req.user!.organization_id;
  const params: unknown[] = [organizationId];
  const filters = ["b.organization_id = $1", "sd.status <> 'credited'"];
  addDateRangeFilter(filters, params, "sd.sale_date", range);
  const where = filters.join(" and ");

  const [hourRows, weekdayRows, weekdayHourRows, totals] = await Promise.all([
    db.query<{
      hour_key: string;
      revenue: string;
      documents: string;
      tickets: string;
      item_units: string;
      days_with_sales: string;
    }>(
      `with documents as (
         select sd.id,
                coalesce(substring(sd.sale_time::text from 1 for 2), 'Sin hora') as hour_key,
                ${netTotal} as revenue,
                case when sd.status = 'active' then 1 else 0 end as ticket_count,
                sd.sale_date,
                coalesce((
                  select sum(si.quantity)
                  from sale_items si
                  where si.sales_document_id = sd.id
                ), 0) as item_units
         from sales_documents sd
         join branches b on b.id = sd.branch_id
         where ${where}
       )
       select hour_key,
              coalesce(sum(revenue), 0)::text as revenue,
              count(id)::text as documents,
              coalesce(sum(ticket_count), 0)::text as tickets,
              coalesce(sum(item_units), 0)::text as item_units,
              count(distinct sale_date)::text as days_with_sales
       from documents
       group by hour_key
       order by hour_key`,
      params
    ),
    db.query<{
      weekday: string;
      revenue: string;
      documents: string;
      tickets: string;
      item_units: string;
      observed_days: string;
    }>(
      `with documents as (
         select sd.id,
                extract(dow from sd.sale_date)::int as weekday,
                ${netTotal} as revenue,
                case when sd.status = 'active' then 1 else 0 end as ticket_count,
                sd.sale_date,
                coalesce((
                  select sum(si.quantity)
                  from sale_items si
                  where si.sales_document_id = sd.id
                ), 0) as item_units
         from sales_documents sd
         join branches b on b.id = sd.branch_id
         where ${where}
       )
       select weekday::text,
              coalesce(sum(revenue), 0)::text as revenue,
              count(id)::text as documents,
              coalesce(sum(ticket_count), 0)::text as tickets,
              coalesce(sum(item_units), 0)::text as item_units,
              count(distinct sale_date)::text as observed_days
       from documents
       group by weekday
       order by weekday`,
      params
    ),
    db.query<{
      weekday: string;
      hour_key: string;
      revenue: string;
      tickets: string;
    }>(
      `with documents as (
         select sd.id,
                extract(dow from sd.sale_date)::int as weekday,
                coalesce(substring(sd.sale_time::text from 1 for 2), 'Sin hora') as hour_key,
                ${netTotal} as revenue,
                case when sd.status = 'active' then 1 else 0 end as ticket_count
         from sales_documents sd
         join branches b on b.id = sd.branch_id
         where ${where}
       )
       select weekday::text,
              hour_key,
              coalesce(sum(revenue), 0)::text as revenue,
              coalesce(sum(ticket_count), 0)::text as tickets
       from documents
       group by weekday, hour_key
       order by weekday, hour_key`,
      params
    ),
    queryOne<{
      revenue: string;
      documents: string;
      tickets: string;
      item_units: string;
      active_days: string;
    }>(
      `with documents as (
         select sd.id,
                ${netTotal} as revenue,
                case when sd.status = 'active' then 1 else 0 end as ticket_count,
                sd.sale_date,
                coalesce((
                  select sum(si.quantity)
                  from sale_items si
                  where si.sales_document_id = sd.id
                ), 0) as item_units
         from sales_documents sd
         join branches b on b.id = sd.branch_id
         where ${where}
       )
       select coalesce(sum(revenue), 0)::text as revenue,
              count(id)::text as documents,
              coalesce(sum(ticket_count), 0)::text as tickets,
              coalesce(sum(item_units), 0)::text as item_units,
              count(distinct sale_date)::text as active_days
       from documents`,
      params
    )
  ]);

  const totalRevenue = toNumber(totals?.revenue);
  const totalTickets = toNumber(totals?.tickets);
  const activeDays = toNumber(totals?.active_days);
  const rawHours = hourRows.rows.map((row) => {
    const revenue = toNumber(row.revenue);
    const tickets = toNumber(row.tickets);
    const itemUnits = toNumber(row.item_units);
    const daysWithSales = toNumber(row.days_with_sales);

    return {
      hourKey: row.hour_key,
      label: hourLabel(row.hour_key),
      revenue,
      documents: toNumber(row.documents),
      tickets,
      averageTicket: tickets > 0 ? revenue / tickets : 0,
      itemUnits,
      unitsPerTicket: tickets > 0 ? itemUnits / tickets : 0,
      share: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      ticketShare: totalTickets > 0 ? (tickets / totalTickets) * 100 : 0,
      daysWithSales,
      revenuePerDay: daysWithSales > 0 ? revenue / daysWithSales : 0,
      ticketsPerDay: daysWithSales > 0 ? tickets / daysWithSales : 0
    };
  });
  const maxRevenue = Math.max(0, ...rawHours.map((row) => row.revenue));
  const maxTickets = Math.max(0, ...rawHours.map((row) => row.tickets));
  const hours = rawHours
    .map((row) => {
      const signal = hourSignal({
        revenue: row.revenue,
        tickets: row.tickets,
        share: row.share,
        ticketShare: row.ticketShare,
        maxRevenue,
        maxTickets
      });
      return {
        ...row,
        signal: signal.label,
        signalTone: signal.tone
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.tickets - a.tickets || a.hourKey.localeCompare(b.hourKey));
  const bestByRevenue = hours.reduce<typeof hours[number] | null>(
    (best, row) => (!best || row.revenue > best.revenue ? row : best),
    null
  );
  const bestByTickets = hours.reduce<typeof hours[number] | null>(
    (best, row) => (!best || row.tickets > best.tickets ? row : best),
    null
  );
  const rawWeekdays = weekdayRows.rows.map((row) => {
    const revenue = toNumber(row.revenue);
    const tickets = toNumber(row.tickets);
    const itemUnits = toNumber(row.item_units);
    const observedDays = toNumber(row.observed_days);

    return {
      weekday: toNumber(row.weekday),
      label: weekdayLabel(toNumber(row.weekday)),
      shortLabel: weekdayShortLabel(toNumber(row.weekday)),
      revenue,
      documents: toNumber(row.documents),
      tickets,
      averageTicket: tickets > 0 ? revenue / tickets : 0,
      itemUnits,
      unitsPerTicket: tickets > 0 ? itemUnits / tickets : 0,
      share: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      ticketShare: totalTickets > 0 ? (tickets / totalTickets) * 100 : 0,
      observedDays,
      revenuePerDay: observedDays > 0 ? revenue / observedDays : 0,
      ticketsPerDay: observedDays > 0 ? tickets / observedDays : 0
    };
  });
  const maxWeekdayRevenuePerDay = Math.max(0, ...rawWeekdays.map((row) => row.revenuePerDay));
  const maxWeekdayTicketsPerDay = Math.max(0, ...rawWeekdays.map((row) => row.ticketsPerDay));
  const weekdays = rawWeekdays
    .map((row) => {
      const signal = weekdaySignal({
        revenuePerDay: row.revenuePerDay,
        ticketsPerDay: row.ticketsPerDay,
        maxRevenuePerDay: maxWeekdayRevenuePerDay,
        maxTicketsPerDay: maxWeekdayTicketsPerDay
      });
      return {
        ...row,
        signal: signal.label,
        signalTone: signal.tone
      };
    })
    .sort((a, b) => b.revenuePerDay - a.revenuePerDay || b.ticketsPerDay - a.ticketsPerDay || a.weekday - b.weekday);
  const bestWeekdayByRevenue = weekdays.reduce<typeof weekdays[number] | null>(
    (best, row) => (!best || row.revenuePerDay > best.revenuePerDay ? row : best),
    null
  );
  const bestWeekdayByTickets = weekdays.reduce<typeof weekdays[number] | null>(
    (best, row) => (!best || row.ticketsPerDay > best.ticketsPerDay ? row : best),
    null
  );
  const weekdayHours = weekdayHourRows.rows.map((row) => ({
    weekday: toNumber(row.weekday),
    label: weekdayLabel(toNumber(row.weekday)),
    shortLabel: weekdayShortLabel(toNumber(row.weekday)),
    hourKey: row.hour_key,
    hourLabel: hourLabel(row.hour_key),
    revenue: toNumber(row.revenue),
    tickets: toNumber(row.tickets)
  }));

  res.json({
    range,
    summary: {
      revenue: totalRevenue,
      documents: toNumber(totals?.documents),
      tickets: totalTickets,
      averageTicket: totalTickets > 0 ? totalRevenue / totalTickets : 0,
      itemUnits: toNumber(totals?.item_units),
      unitsPerTicket: totalTickets > 0 ? toNumber(totals?.item_units) / totalTickets : 0,
      activeDays,
      activeHours: hours.length,
      bestHourByRevenue: bestByRevenue?.label ?? null,
      bestHourByRevenueAmount: bestByRevenue?.revenue ?? 0,
      bestHourByTickets: bestByTickets?.label ?? null,
      bestHourByTicketsCount: bestByTickets?.tickets ?? 0,
      bestWeekdayByRevenue: bestWeekdayByRevenue?.label ?? null,
      bestWeekdayByRevenueAmount: bestWeekdayByRevenue?.revenuePerDay ?? 0,
      bestWeekdayByTickets: bestWeekdayByTickets?.label ?? null,
      bestWeekdayByTicketsCount: bestWeekdayByTickets?.ticketsPerDay ?? 0
    },
    hours,
    weekdays,
    weekdayHours
  });
});

app.get("/api/products/aliases", requireAuth, async (req, res) => {
  const rows = await db.query(
    `select p.id,
            p.canonical_name,
            c.name as category_name,
            p.cost,
            p.active,
            count(pa.id)::text as alias_count
     from products p
     left join categories c on c.id = p.category_id
     left join product_aliases pa on pa.product_id = p.id
     where p.organization_id = $1
     group by p.id, c.name
     order by p.canonical_name
     limit 200`,
    [req.user!.organization_id]
  );

  res.json({ products: rows.rows });
});

app.get("/api/waste/records", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 120), 300);
  const range = readDateRange(req);
  const params: unknown[] = [req.user!.organization_id];
  const filters = ["b.organization_id = $1"];
  addDateRangeFilter(filters, params, "wr.date", range);
  params.push(limit);

  const rows = await db.query(
    `select wr.id,
            wr.date::text as date,
            wr.quantity,
            wr.unit_cost,
            wr.total_cost,
            wr.notes,
            wr.source,
            wr.external_id,
            wr.external_event_id,
            wr.user_name,
            p.canonical_name as product_name,
            c.name as category_name,
            b.name as branch_name
     from waste_records wr
     join branches b on b.id = wr.branch_id
     left join products p on p.id = wr.product_id
     left join categories c on c.id = p.category_id
     where ${filters.join(" and ")}
     order by wr.date desc, wr.created_at desc
     limit $${params.length}`,
    params
  );

  res.json({ records: rows.rows });
});

app.get("/api/waste/summary", requireAuth, async (req, res) => {
  const range = readDateRange(req);
  const params: unknown[] = [req.user!.organization_id];
  const filters = ["b.organization_id = $1"];
  addDateRangeFilter(filters, params, "wr.date", range);
  const where = filters.join(" and ");
  const salesParams: unknown[] = [req.user!.organization_id];
  const salesFilters = ["b.organization_id = $1", "sd.status <> 'credited'"];
  addDateRangeFilter(salesFilters, salesParams, "sd.sale_date", range);
  const salesWhere = salesFilters.join(" and ");

  const [summary, byDate, salesByDate, topProducts] = await Promise.all([
    queryOne<{
      total_cost: string;
      quantity: string;
      records: string;
      events: string;
      products: string;
    }>(
      `select
         coalesce(sum(wr.total_cost), 0)::text as total_cost,
         coalesce(sum(wr.quantity), 0)::text as quantity,
         count(wr.id)::text as records,
         count(distinct coalesce(wr.external_event_id, wr.id))::text as events,
         count(distinct wr.product_id)::text as products
       from waste_records wr
       join branches b on b.id = wr.branch_id
       where ${where}`,
      params
    ),
    db.query<{ label: string; total: string; records: string }>(
      `select wr.date::text as label,
              coalesce(sum(wr.total_cost), 0)::text as total,
              count(wr.id)::text as records
       from waste_records wr
       join branches b on b.id = wr.branch_id
       where ${where}
       group by wr.date
       order by wr.date`,
      params
    ),
    db.query<{ label: string; total: string }>(
      `select sd.sale_date::text as label,
              coalesce(sum(${netTotal}), 0)::text as total
       from sales_documents sd
       join branches b on b.id = sd.branch_id
       where ${salesWhere}
       group by sd.sale_date
       order by sd.sale_date`,
      salesParams
    ),
    db.query(
      `select coalesce(p.canonical_name, 'Producto sin nombre') as label,
              coalesce(c.name, 'Sin categoria') as category,
              coalesce(sum(wr.quantity), 0)::text as quantity,
              coalesce(sum(wr.total_cost), 0)::text as total
       from waste_records wr
       join branches b on b.id = wr.branch_id
       left join products p on p.id = wr.product_id
       left join categories c on c.id = p.category_id
       where ${where}
       group by coalesce(p.canonical_name, 'Producto sin nombre'), coalesce(c.name, 'Sin categoria')
       order by coalesce(sum(wr.total_cost), 0) desc
       limit 10`,
      params
    )
  ]);
  const salesByDateMap = new Map(salesByDate.rows.map((row) => [row.label, toNumber(row.total)]));
  const byDateWithSales = byDate.rows.map((row) => {
    const total = toNumber(row.total);
    const sales = salesByDateMap.get(row.label) ?? 0;
    return {
      ...row,
      sales: String(sales),
      wastePercent: sales > 0 ? (total / sales) * 100 : null
    };
  });

  res.json({
    range,
    summary: {
      totalCost: Number(summary?.total_cost ?? 0),
      quantity: Number(summary?.quantity ?? 0),
      records: Number(summary?.records ?? 0),
      events: Number(summary?.events ?? 0),
      products: Number(summary?.products ?? 0)
    },
    byDate: byDateWithSales,
    topProducts: topProducts.rows
  });
});

app.get("/api/integration/status", requireAuth, async (req, res) => {
  const organizationId = req.user!.organization_id;
  const syncRuns = await db.query(
    `select sr.id, sr.integration, sr.started_at, sr.finished_at, sr.status,
            sr.records_received, sr.records_created, sr.records_updated, sr.error_message,
            b.name as branch_name
     from sync_runs sr
     join branches b on b.id = sr.branch_id
     where b.organization_id = $1
     order by sr.started_at desc
     limit 8`,
    [organizationId]
  );

  res.json({
    phase: "Fase 3",
    credentialsConfigured: dulceHoraCredentialsConfigured(),
    readOnlyAllowlist: [
      "GET /panel/facturacion/registros?fecha=YYYYMMDD",
      "GET /panel/facturacion/comprobante?id=<id>",
      "GET /panel/facturacion/comprobante/fiscal?id=<id>",
      "GET /panel/facturacion/comprobante/parcial?id=<id>",
      "GET /panel/desperdicios/local",
      "GET /panel/estadisticas/local/exportar"
    ],
    discoveredCapabilities: {
      statisticsXlsx: true,
      documentHtmlListing: true,
      documentJsonDetail: true,
      ticketItems: true,
      wasteRecords: true,
      mutatingRoutesBlocked: true
    },
    nextPhase: "Sincronizar facturacion y mermas por fecha desde el panel de Dulce Hora.",
    syncRuns: syncRuns.rows
  });
});

app.post(
  "/api/imports/portal-sales",
  requireRole(["owner", "administrator", "manager"]),
  async (req, res) => {
    const input = portalSalesImportSchema.parse(req.body);
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para importar ventas" });
      return;
    }

    const importId = randomUUID();
    const runId = randomUUID();
    let documentsCreated = 0;
    let documentsReplaced = 0;
    const totalImported = input.rows.reduce((total, row) => total + row.total, 0);
    const documentsReceived = input.rows.reduce((total, row) => total + row.orders, 0);
    const dates = input.rows.map((row) => row.date).sort();
    const providers = [...new Set(input.rows.map((row) => row.provider))];

    await db.transaction(async (tx) => {
      for (const row of input.rows) {
        const prefix = portalExternalPrefix(row.provider, row.date, row.paymentKind);
        const legacyPrefix = portalLegacyExternalPrefix(row.provider, row.date);
        const existing = await tx.query<{ count: string }>(
          `select count(*)::text as count
           from sales_documents
           where branch_id = $1
             and sale_date = $2
             and source = 'portal-manual'
             and (external_id like $3 or ($4::boolean and external_id like $5))`,
          [branch.id, row.date, `${prefix}%`, row.paymentKind === "online", `${legacyPrefix}%`]
        );
        documentsReplaced += Number(existing.rows[0]?.count ?? 0);

        await tx.query(
          `delete from sales_documents
           where branch_id = $1
             and sale_date = $2
             and source = 'portal-manual'
             and (external_id like $3 or ($4::boolean and external_id like $5))`,
          [branch.id, row.date, `${prefix}%`, row.paymentKind === "online", `${legacyPrefix}%`]
        );

        const splitAmounts = splitMoney(row.total, row.orders);
        for (const [index, amount] of splitAmounts.entries()) {
          const documentId = randomUUID();
          const externalId = `${prefix}${String(index + 1).padStart(4, "0")}`;
          const displayProvider = portalProviderLabel(row.provider, row.paymentKind);
          await tx.query(
            `insert into sales_documents
              (id, branch_id, external_id, dedupe_key, document_number, document_type,
               sale_date, sale_time, customer_name, subtotal, discount, total, payment_method,
               status, source, raw_data)
             values ($1, $2, $3, $3, $4, 'Venta portal',
               $5, $6, $7, $8, 0, $8, $7,
               'active', 'portal-manual', $9)`,
            [
              documentId,
              branch.id,
              externalId,
              `${displayProvider.toUpperCase().replace(/\s+/g, "-")}-${row.date.replaceAll("-", "")}-${String(index + 1).padStart(4, "0")}`,
              row.date,
              row.hour || null,
              displayProvider,
              amount,
              JSON.stringify({
                importId,
                provider: row.provider,
                paymentKind: row.paymentKind,
                providerLabel: displayProvider,
                orderIndex: index + 1,
                orders: row.orders,
                rowTotal: row.total,
                notes: row.notes || null,
                entryType: "daily-total"
              })
            ]
          );
          documentsCreated += 1;
        }
      }

      await tx.query(
        `insert into imports
          (id, branch_id, source, filename, date_from, date_to, rows_processed,
           rows_created, rows_updated, rows_rejected, status, error_log)
         values ($1, $2, 'portal-manual', null, $3, $4, $5, $6, $7, 0, 'success', null)`,
        [
          importId,
          branch.id,
          dates[0],
          dates[dates.length - 1],
          documentsReceived,
          documentsCreated,
          documentsReplaced
        ]
      );

      await tx.query(
        `insert into sync_runs
          (id, branch_id, integration, finished_at, status, records_received, records_created, records_updated)
         values ($1, $2, 'portal-manual', now(), 'success', $3, $4, $5)`,
        [runId, branch.id, documentsReceived, documentsCreated, documentsReplaced]
      );
    });

    await audit(req.user!.organization_id, req.user!.id, "portal_sales.imported", "imports", importId, null, {
      providers,
      rows: input.rows.length,
      documentsCreated,
      documentsReplaced,
      totalImported
    });

    res.status(201).json({
      importId,
      runId,
      branch,
      rowsReceived: input.rows.length,
      documentsReceived,
      documentsCreated,
      documentsReplaced,
      totalImported,
      providers
    });
  }
);

app.post(
  "/api/integration/dulce-hora/sync-date",
  requireRole(["owner", "administrator", "manager"]),
  async (req, res) => {
    const input = syncDateSchema.parse(req.body);
    const branch = input.branchId
      ? await queryOne<{ id: string; name: string }>(
          `select id, name
           from branches
           where id = $1 and organization_id = $2 and active = true`,
          [input.branchId, req.user!.organization_id]
        )
      : await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para sincronizar" });
      return;
    }

    try {
      const result = await syncDulceHoraDate({
        branchId: branch.id,
        organizationId: req.user!.organization_id,
        userId: req.user!.id,
        date: input.date,
        includeWaste: input.includeWaste,
        includeStatistics: input.includeStatistics
      });

      res.status(201).json({ ...result, branch });
    } catch (error) {
      const message = readableSyncError(error);
      console.error("[dulce-hora:sync-date]", message, error);
      res.status(syncErrorStatus(error)).json({ error: message });
    }
  }
);

app.post(
  "/api/integration/dulce-hora/sync-history",
  requireRole(["owner", "administrator", "manager"]),
  async (req, res) => {
    const input = syncHistorySchema.parse(req.body);
    const branch = input.branchId
      ? await queryOne<{ id: string; name: string }>(
          `select id, name
           from branches
           where id = $1 and organization_id = $2 and active = true`,
          [input.branchId, req.user!.organization_id]
        )
      : await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para sincronizar" });
      return;
    }

    try {
      const result = await syncDulceHoraHistory({
        branchId: branch.id,
        organizationId: req.user!.organization_id,
        userId: req.user!.id,
        dateFrom: input.from ?? null,
        dateTo: input.to ?? null
      });

      res.status(201).json({ ...result, branch });
    } catch (error) {
      const message = readableSyncError(error);
      console.error("[dulce-hora:sync-history]", message, error);
      res.status(syncErrorStatus(error)).json({ error: message });
    }
  }
);

app.post(
  "/api/integration/dulce-hora/sync-waste-history",
  requireRole(["owner", "administrator", "manager"]),
  async (req, res) => {
    const input = syncHistorySchema.parse(req.body);
    const branch = input.branchId
      ? await queryOne<{ id: string; name: string }>(
          `select id, name
           from branches
           where id = $1 and organization_id = $2 and active = true`,
          [input.branchId, req.user!.organization_id]
        )
      : await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para sincronizar" });
      return;
    }

    try {
      const result = await syncDulceHoraWasteHistory({
        branchId: branch.id,
        organizationId: req.user!.organization_id,
        userId: req.user!.id,
        dateFrom: input.from ?? null,
        dateTo: input.to ?? null
      });

      res.status(201).json({ ...result, branch });
    } catch (error) {
      const message = readableSyncError(error);
      console.error("[dulce-hora:sync-waste-history]", message, error);
      res.status(syncErrorStatus(error)).json({ error: message });
    }
  }
);

function portalExternalPrefix(provider: "pedidosya" | "rappi" | "otro", date: string, paymentKind: "online" | "cash") {
  return `portal-manual:${provider}:${paymentKind}:${date}:`;
}

function portalLegacyExternalPrefix(provider: "pedidosya" | "rappi" | "otro", date: string) {
  return `portal-manual:${provider}:${date}:`;
}

function portalProviderLabel(provider: "pedidosya" | "rappi" | "otro", paymentKind: "online" | "cash") {
  if (provider === "pedidosya" && paymentKind === "cash") {
    return "Pedidos Ya efectivo";
  }
  const labels = {
    pedidosya: "Pedidos Ya",
    rappi: "Rappi",
    otro: "Otro portal"
  };
  return labels[provider];
}

function splitMoney(total: number, parts: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const remainder = cents - base * parts;
  return Array.from({ length: parts }, (_value, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

function productSignal(input: {
  share: number;
  wasteRate: number;
  revenue: number;
  wasteCost: number;
}): { label: string; tone: "green" | "amber" | "red" | "slate" } {
  if (input.revenue === 0 && input.wasteCost > 0) {
    return { label: "Merma sin venta", tone: "red" };
  }
  if (input.wasteRate >= 6) {
    return { label: "Merma grave", tone: "red" };
  }
  if (input.wasteRate >= 3) {
    return { label: "Merma critica", tone: "red" };
  }
  if (input.share >= 7 && input.wasteRate < 2.5) {
    return { label: "Producto estrella", tone: "green" };
  }
  if (input.share >= 4 && input.wasteRate >= 2.5) {
    return { label: "Ajustar produccion", tone: "amber" };
  }
  if (input.share < 1 && input.wasteCost > 0) {
    return { label: "Baja rotacion con merma", tone: "amber" };
  }
  if (input.share < 1) {
    return { label: "Promocionar o revisar", tone: "slate" };
  }
  return { label: "Monitorear", tone: "slate" };
}

function hourSignal(input: {
  revenue: number;
  tickets: number;
  share: number;
  ticketShare: number;
  maxRevenue: number;
  maxTickets: number;
}): { label: string; tone: "green" | "amber" | "red" | "slate" } {
  if (input.revenue === 0 && input.tickets === 0) {
    return { label: "Sin movimiento", tone: "slate" };
  }
  if (input.maxRevenue > 0 && input.revenue >= input.maxRevenue * 0.85) {
    return { label: "Hora fuerte en venta", tone: "green" };
  }
  if (input.maxTickets > 0 && input.tickets >= input.maxTickets * 0.85) {
    return { label: "Hora fuerte en tickets", tone: "green" };
  }
  if (input.share >= 10 || input.ticketShare >= 10) {
    return { label: "Alta actividad", tone: "green" };
  }
  if (input.share < 3 && input.ticketShare < 3) {
    return { label: "Hora debil", tone: "red" };
  }
  if (input.share < 5 || input.ticketShare < 5) {
    return { label: "Baja actividad", tone: "amber" };
  }
  return { label: "Monitorear", tone: "slate" };
}

function weekdaySignal(input: {
  revenuePerDay: number;
  ticketsPerDay: number;
  maxRevenuePerDay: number;
  maxTicketsPerDay: number;
}): { label: string; tone: "green" | "amber" | "red" | "slate" } {
  if (input.revenuePerDay === 0 && input.ticketsPerDay === 0) {
    return { label: "Sin movimiento", tone: "slate" };
  }
  if (input.maxRevenuePerDay > 0 && input.revenuePerDay >= input.maxRevenuePerDay * 0.9) {
    return { label: "Dia fuerte en venta", tone: "green" };
  }
  if (input.maxTicketsPerDay > 0 && input.ticketsPerDay >= input.maxTicketsPerDay * 0.9) {
    return { label: "Dia fuerte en tickets", tone: "green" };
  }
  if (input.maxRevenuePerDay > 0 && input.revenuePerDay <= input.maxRevenuePerDay * 0.55) {
    return { label: "Dia debil", tone: "red" };
  }
  if (input.maxTicketsPerDay > 0 && input.ticketsPerDay <= input.maxTicketsPerDay * 0.65) {
    return { label: "Baja actividad", tone: "amber" };
  }
  return { label: "Monitorear", tone: "slate" };
}

function hourLabel(value: string) {
  return value === "Sin hora" ? value : `${value}:00`;
}

function weekdayLabel(value: number) {
  const labels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  return labels[value] ?? "Sin dia";
}

function weekdayShortLabel(value: number) {
  const labels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return labels[value] ?? "S/D";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readableSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido al sincronizar Dulce Hora";
  const backendEnv = process.env.NETLIFY === "true" ? "Netlify" : "el entorno del backend local";
  if (message.includes("fetch failed")) {
    return `No se pudo conectar desde ${backendEnv} con Dulce Hora. Puede ser un bloqueo temporal del panel o un problema de red.`;
  }
  if (/timeout|aborted/i.test(message)) {
    return `Dulce Hora tardo demasiado en responder desde ${backendEnv}. Se puede reintentar la importacion; si persiste, conviene sincronizar por fecha o esperar unos minutos.`;
  }
  if (message.includes("Faltan DULCE_HORA_USERNAME") || message.includes("DULCE_HORA_PASSWORD")) {
    return message;
  }
  if (message.includes("sesion de Dulce Hora") || message.includes("iniciar sesion")) {
    return `${message}. Revisar DULCE_HORA_USERNAME y DULCE_HORA_PASSWORD en ${backendEnv}.`;
  }
  if (message.includes("Dulce Hora limito")) {
    return message;
  }
  return message;
}

function syncErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("fetch failed") ||
    /timeout|aborted/i.test(message) ||
    message.includes("Dulce Hora") ||
    message.includes("DULCE_HORA_USERNAME") ||
    message.includes("DULCE_HORA_PASSWORD") ||
    message.includes("sesion")
  ) {
    return 502;
  }
  return 500;
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Datos invalidos", details: error.issues });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Error interno" });
});

export async function initializeServer() {
  migrationPromise ??= migrate();
  await migrationPromise;
}

export async function startServer() {
  await initializeServer();
  return app.listen(port, "127.0.0.1", () => {
    console.log(`Dulce Hora Control API escuchando en http://127.0.0.1:${port}`);
  });
}

if (process.env.NETLIFY !== "true" && process.env.DULCE_HORA_SERVERLESS !== "true") {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

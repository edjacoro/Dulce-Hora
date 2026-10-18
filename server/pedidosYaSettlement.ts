import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { readBranchScope, readWriteBranch } from "./branchScope.js";
import { db } from "./db.js";

type Queryable = { query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };

export type PedidosYaSettlement = {
  from: string; to: string; sales: number; services: number; operations: number;
  advertising: number; refunds: number; adjustments: number; taxes: number;
  cashCollected: number; netSettlement: number; payoutDate: string | null;
};

const columns = ["from", "to", "sales", "services", "operations", "advertising",
  "refunds", "adjustments", "taxes", "cash_collected", "net_settlement"];
const inputSchema = z.object({ csv: z.string().min(50).max(1_000_000), filename: z.string().trim().max(150).optional() });

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function parsePedidosYaSettlements(csv: string): PedidosYaSettlement[] {
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const header = lines.shift()?.split(";").map((value) => value.trim()) ?? [];
  if (header.length !== columns.length && header.length !== columns.length + 1) {
    throw new Error("Columnas de liquidacion invalidas");
  }
  if (columns.some((column, index) => header[index] !== column) ||
      (header.length === columns.length + 1 && header.at(-1) !== "payout_date")) {
    throw new Error("Columnas de liquidacion invalidas");
  }
  const result: PedidosYaSettlement[] = [];
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const cells = line.split(";").map((value) => value.trim());
    if (cells.length !== header.length) throw new Error(`Cantidad de columnas invalida en fila ${index + 2}`);
    const [from, to] = cells;
    if (!validDate(from) || !validDate(to) || from > to ||
        (new Date(`${to}T00:00:00Z`).valueOf() - new Date(`${from}T00:00:00Z`).valueOf()) / 86_400_000 !== 6) {
      throw new Error(`Semana invalida en fila ${index + 2}`);
    }
    if (seen.has(from)) throw new Error(`Semana duplicada: ${from}`);
    seen.add(from);
    const values = cells.slice(2, 11).map((value) => {
      if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Importe invalido en fila ${index + 2}`);
      return Number(value);
    });
    const [sales, services, operations, advertising, refunds, adjustments, taxes, cashCollected, netSettlement] = values;
    const payoutDate = cells[11] || null;
    if (payoutDate && (!validDate(payoutDate) || payoutDate < to)) throw new Error(`Fecha de pago invalida en fila ${index + 2}`);
    const calculated = Math.round((sales + services + operations + advertising + refunds + adjustments + taxes + cashCollected) * 100) / 100;
    if (Math.abs(calculated - netSettlement) > 0.02) throw new Error(`El neto no coincide con los cargos en fila ${index + 2}`);
    result.push({ from, to, sales, services, operations, advertising, refunds, adjustments,
      taxes, cashCollected, netSettlement, payoutDate });
  }
  if (!result.length) throw new Error("No hay liquidaciones para importar");
  const ordered = [...result].sort((a, b) => a.from.localeCompare(b.from));
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index].from <= ordered[index - 1].to) throw new Error("Hay semanas superpuestas");
  }
  return ordered;
}

export async function reconcilePedidosYaSettlements(
  tx: Queryable, branchId: string, organizationId: string, userId: string, from: string, to: string
) {
  const settlements = await tx.query<{ period_start: string; period_end: string; net_settlement: string; cash_collected: string }>(
    `select period_start::text, period_end::text, net_settlement::text, cash_collected::text
     from pedidosya_settlements where branch_id = $1 and period_start <= $3 and period_end >= $2`,
    [branchId, from, to]
  );
  if (!settlements.rows.length) return 0;
  const category = await tx.query<{ id: string }>(
    `select id from expense_categories where organization_id = $1 and name = 'Ajuste de liquidacion PedidosYa'`,
    [organizationId]
  );
  let categoryId = category.rows[0]?.id;
  if (!categoryId) {
    categoryId = randomUUID();
    await tx.query(
      `insert into expense_categories (id, organization_id, name, pnl_group, active)
       values ($1, $2, 'Ajuste de liquidacion PedidosYa', 'operating', true)
       on conflict (organization_id, name) do nothing`,
      [categoryId, organizationId]
    );
    const saved = await tx.query<{ id: string }>(
      `select id from expense_categories where organization_id = $1 and name = 'Ajuste de liquidacion PedidosYa'`,
      [organizationId]
    );
    categoryId = saved.rows[0].id;
  }
  let reconciled = 0;
  for (const settlement of settlements.rows) {
    const orders = await tx.query<{ count: string; estimated: string }>(
      `select count(*)::text as count,
              coalesce(sum((raw_data->>'estimatedIncome')::numeric), 0)::text as estimated
       from sales_documents where branch_id = $1 and source = 'pedidosya-csv'
         and status = 'active' and sale_date between $2 and $3`,
      [branchId, settlement.period_start, settlement.period_end]
    );
    if (Number(orders.rows[0]?.count ?? 0) === 0) continue;
    const actualCombined = Number(settlement.net_settlement) - Number(settlement.cash_collected);
    const adjustment = Math.round((Number(orders.rows[0].estimated) - actualCombined) * 100) / 100;
    const externalId = `${settlement.period_start}:${settlement.period_end}`;
    await tx.query(
      `insert into expenses
         (id, branch_id, expense_date, accounting_month, paid_date, category_id,
          supplier, description, amount, payment_method, payment_type, cash_account,
          status, source, external_id, created_by)
       values ($1, $2, $3, $4, $3, $5, 'Pedidos Ya', $6, $7, 'Plataforma',
               'bank', 'pedidosya', 'paid', 'pedidosya-settlement-adjustment', $8, $9)
       on conflict (branch_id, source, external_id) where external_id is not null
       do update set amount = excluded.amount, category_id = excluded.category_id`,
      [randomUUID(), branchId, settlement.period_end, settlement.period_end.slice(0, 7), categoryId,
       `Diferencia con estado de cuenta ${settlement.period_start} a ${settlement.period_end}`,
       adjustment, externalId, userId]
    );
    reconciled++;
  }
  return reconciled;
}

export function registerPedidosYaSettlementRoutes(app: Express) {
  app.get("/api/imports/pedidosya-settlements", requireAuth, async (req, res) => {
    const scope = await readBranchScope(req, req.user!.organization_id);
    const result = await db.query(
      `select s.period_start::text as "from", s.period_end::text as "to",
              s.sales::text, s.net_settlement::text as "netSettlement",
              s.cash_collected::text as "cashCollected", s.payout_date::text as "payoutDate"
       from pedidosya_settlements s join branches b on b.id = s.branch_id
       where b.organization_id = $1 and ($2::text is null or b.id = $2)
       order by s.period_start desc limit 30`,
      [req.user!.organization_id, scope.branchId]
    );
    res.json({ settlements: result.rows });
  });

  app.post("/api/imports/pedidosya-settlements", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = inputSchema.parse(req.body);
    let settlements: PedidosYaSettlement[];
    try { settlements = parsePedidosYaSettlements(input.csv); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Informe invalido" }); return; }
    const branch = await readWriteBranch(req, req.user!.organization_id);
    if (!branch) { res.status(400).json({ error: "Selecciona una sucursal" }); return; }
    const overlaps = await db.query<{ period_start: string; period_end: string }>(
      `select period_start::text, period_end::text from pedidosya_settlements
       where branch_id = $1 and period_start <= $3 and period_end >= $2`,
      [branch.id, settlements[0].from, settlements.at(-1)!.to]
    );
    if (overlaps.rows.some((existing) => settlements.some((item) =>
      item.from <= existing.period_end && item.to >= existing.period_start &&
      (item.from !== existing.period_start || item.to !== existing.period_end)))) {
      res.status(409).json({ error: "Hay una liquidacion guardada con fechas superpuestas. Revisa las semanas del archivo." });
      return;
    }
    const importId = randomUUID();
    const reconciled = await db.transaction(async (tx) => {
      for (const item of settlements) {
        await tx.query(
          `insert into pedidosya_settlements
             (id, branch_id, period_start, period_end, sales, services, operations,
              advertising, refunds, adjustments, taxes, cash_collected, net_settlement, payout_date)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           on conflict (branch_id, period_start, period_end)
           do update set sales = excluded.sales, services = excluded.services,
             operations = excluded.operations, advertising = excluded.advertising,
             refunds = excluded.refunds, adjustments = excluded.adjustments,
             taxes = excluded.taxes, cash_collected = excluded.cash_collected,
             net_settlement = excluded.net_settlement, payout_date = excluded.payout_date,
             updated_at = now()`,
          [randomUUID(), branch.id, item.from, item.to, item.sales, item.services,
           item.operations, item.advertising, item.refunds, item.adjustments, item.taxes,
           item.cashCollected, item.netSettlement, item.payoutDate]
        );
      }
      const adjusted = await reconcilePedidosYaSettlements(tx, branch.id, req.user!.organization_id,
        req.user!.id, settlements[0].from, settlements.at(-1)!.to);
      await tx.query(
        `insert into imports
           (id, branch_id, source, filename, date_from, date_to, rows_processed,
            rows_created, rows_updated, rows_rejected, status)
         values ($1, $2, 'pedidosya-settlement', $3, $4, $5, $6, 0, 0, 0, 'success')`,
        [importId, branch.id, input.filename ?? null, settlements[0].from,
         settlements.at(-1)!.to, settlements.length]
      );
      await tx.query(
        `insert into audit_logs (id, organization_id, user_id, action, entity, entity_id, new_value)
         values ($1, $2, $3, 'pedidosya.settlements_imported', 'imports', $4, $5)`,
        [randomUUID(), req.user!.organization_id, req.user!.id, importId,
         JSON.stringify({ count: settlements.length, from: settlements[0].from,
           to: settlements.at(-1)!.to, reconciled: adjusted })]
      );
      return adjusted;
    });
    res.status(201).json({ count: settlements.length, reconciled,
      from: settlements[0].from, to: settlements.at(-1)!.to });
  });
}

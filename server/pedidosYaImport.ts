import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { db } from "./db.js";
import { readBranchScope, readWriteBranch } from "./branchScope.js";
import { parsePedidosYaCsv } from "./pedidosYaCsv.js";
import { reconcilePedidosYaSettlements } from "./pedidosYaSettlement.js";

const inputSchema = z.object({
  csv: z.string().min(50).max(4_000_000),
  filename: z.string().trim().max(150).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export function registerPedidosYaImportRoutes(app: Express) {
  app.get("/api/imports/pedidosya", requireAuth, async (req, res) => {
    const scope = await readBranchScope(req, req.user!.organization_id);
    const result = await db.query<{
      date_from: string; date_to: string; rows_processed: number; rows_created: number;
      rows_updated: number; rows_rejected: number; created_at: string;
    }>(
      `select i.date_from::text, i.date_to::text, i.rows_processed, i.rows_created,
              i.rows_updated, i.rows_rejected, i.created_at::text
       from imports i join branches b on b.id = i.branch_id
       where b.organization_id = $1 and ($2::text is null or b.id = $2)
         and i.source = 'pedidosya-csv' and i.status = 'success'
       order by i.created_at desc limit 20`,
      [req.user!.organization_id, scope.branchId]
    );
    res.json({ imports: result.rows });
  });

  app.post("/api/imports/pedidosya", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = inputSchema.parse(req.body);
    let parsed: ReturnType<typeof parsePedidosYaCsv>;
    try {
      parsed = parsePedidosYaCsv(input.csv, input.from, input.to);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Informe CSV invalido" });
      return;
    }
    const branch = await readWriteBranch(req, req.user!.organization_id);
    if (!branch) { res.status(400).json({ error: "Selecciona una sucursal para importar" }); return; }

    const importedStore = await db.query<{ store_id: string }>(
      `select sd.raw_data->>'storeId' as store_id from sales_documents sd
       where sd.branch_id = $1 and sd.source = 'pedidosya-csv' limit 1`,
      [branch.id]
    );
    if (importedStore.rows[0]?.store_id && parsed.storeId && importedStore.rows[0].store_id !== parsed.storeId) {
      res.status(409).json({ error: "Este informe corresponde a otra tienda de PedidosYa" }); return;
    }

    const dates = [...new Set(parsed.orders.map((order) => order.date))];
    if (dates.length) {
      const manual = await db.query<{ date: string }>(
        `select distinct sd.sale_date::text as date from sales_documents sd
         where sd.branch_id = $1 and sd.sale_date >= $2 and sd.sale_date <= $3
           and sd.source = 'portal-manual'
           and (sd.raw_data->>'provider' = 'pedidosya' or lower(sd.payment_method) like '%pedido%')`,
        [branch.id, input.from, input.to]
      );
      if (manual.rows.some((row) => dates.includes(row.date))) {
        res.status(409).json({ error: "Ya hay totales manuales de PedidosYa en una fecha del informe. Revisa esa carga para evitar duplicar ventas." });
        return;
      }
    }

    const importId = randomUUID();
    let created = 0;
    let updated = 0;
    let cancelledUpdated = 0;
    await db.transaction(async (tx) => {
      const category = await tx.query<{ id: string }>(
        `select id from expense_categories where organization_id = $1 and name = 'Comisiones y cargos PedidosYa'`,
        [req.user!.organization_id]
      );
      let categoryId = category.rows[0]?.id;
      if (!categoryId) {
        categoryId = randomUUID();
        await tx.query(
          `insert into expense_categories (id, organization_id, name, pnl_group, active)
           values ($1, $2, 'Comisiones y cargos PedidosYa', 'operating', true)
           on conflict (organization_id, name) do nothing`,
          [categoryId, req.user!.organization_id]
        );
        const saved = await tx.query<{ id: string }>(
          `select id from expense_categories where organization_id = $1 and name = 'Comisiones y cargos PedidosYa'`,
          [req.user!.organization_id]
        );
        categoryId = saved.rows[0].id;
      }

      // A Netlify function has a short request budget. Send each group to Postgres
      // in a few statements instead of doing three network round trips per order.
      for (let offset = 0; offset < parsed.orders.length; offset += 100) {
        const batch = parsed.orders.slice(offset, offset + 100).map((order) => {
          const externalId = `pedidosya:${order.storeId}:${order.orderId}`;
          const actualCost = Math.round((order.subtotal - order.estimatedIncome) * 100) / 100;
          return {
            id: randomUUID(), externalId, orderId: order.orderId,
            date: order.date, time: order.time, subtotal: order.subtotal, actualCost,
            paymentMethod: order.paymentKind === "cash" ? "Pedidos Ya efectivo" : "Pedidos Ya online",
            details: {
              provider: "pedidosya", providerLabel: "Pedidos Ya", paymentKind: order.paymentKind,
              storeId: order.storeId, storeName: order.storeName, orderId: order.orderId,
              estimatedIncome: order.estimatedIncome, cashCollected: order.cashCollected,
              amountOwed: order.amountOwed, payout: order.payout, actualCost,
              commission: order.commission, onlinePaymentFee: order.onlinePaymentFee,
              tax: order.tax, merchantDiscount: order.merchantDiscount, marketingCost: order.marketingCost
            }
          };
        });
        const payload = JSON.stringify(batch);
        const existing = await tx.query<{ count: string }>(
          `select count(*)::text as count from sales_documents
           where branch_id = $1 and external_id = any($2::text[])`,
          [branch.id, batch.map((item) => item.externalId)]
        );
        updated += Number(existing.rows[0].count);
        created += batch.length - Number(existing.rows[0].count);
        await tx.query(
          `insert into sales_documents
             (id, branch_id, external_id, dedupe_key, document_number, document_type,
              sale_date, sale_time, customer_name, subtotal, discount, total, payment_method,
              status, source, raw_data)
           select item.id, $1, item."externalId", item."externalId", item."orderId",
                  'Pedido PedidosYa', item.date::date, item.time::time, 'Pedidos Ya',
                  item.subtotal, 0, item.subtotal, item."paymentMethod", 'active',
                  'pedidosya-csv', item.details
           from jsonb_to_recordset($2::jsonb) as item(
             id text, "externalId" text, "orderId" text, date text, time text,
             subtotal numeric, "paymentMethod" text, details jsonb)
           on conflict (branch_id, external_id) where external_id is not null
           do update set sale_date = excluded.sale_date, sale_time = excluded.sale_time,
                         subtotal = excluded.subtotal, total = excluded.total,
                         payment_method = excluded.payment_method, status = excluded.status,
                         raw_data = excluded.raw_data, imported_at = now()`,
          [branch.id, payload]
        );
        await tx.query(
          `insert into expenses
             (id, branch_id, expense_date, accounting_month, paid_date, category_id,
              supplier, description, amount, payment_method, payment_type,
              cash_account, status, source, external_id, created_by)
           select item.id, $1, item.date::date, left(item.date, 7), item.date::date,
                  $2, 'Pedidos Ya', 'Cargos estimados del pedido ' || item."orderId",
                  item."actualCost", 'Plataforma', 'bank', 'pedidosya', 'paid',
                  'pedidosya-csv-fee', item."externalId", $3
           from jsonb_to_recordset($4::jsonb) as item(
             id text, "externalId" text, "orderId" text, date text, "actualCost" numeric)
           on conflict (branch_id, source, external_id) where external_id is not null
           do update set expense_date = excluded.expense_date,
                         accounting_month = excluded.accounting_month,
                         paid_date = excluded.paid_date, amount = excluded.amount,
                         category_id = excluded.category_id`,
          [branch.id, categoryId, req.user!.id, payload]
        );
      }

      if (parsed.cancelledOrderIds.length) {
        const cancelledIds = parsed.cancelledOrderIds.map((id) => `pedidosya:${id}`);
        const cancelled = await tx.query<{ id: string }>(
          `update sales_documents set status = 'credited', imported_at = now()
           where branch_id = $1 and external_id = any($2::text[])
             and source = 'pedidosya-csv' and status <> 'credited' returning id`,
          [branch.id, cancelledIds]
        );
        cancelledUpdated = cancelled.rows.length;
        if (cancelledUpdated) {
          await tx.query(
            `update expenses set amount = 0
             where branch_id = $1 and source = 'pedidosya-csv-fee'
               and external_id = any($2::text[])`,
            [branch.id, cancelledIds]
          );
        }
      }

      await reconcilePedidosYaSettlements(tx, branch.id, req.user!.organization_id,
        req.user!.id, input.from, input.to);

      await tx.query(
        `insert into imports
           (id, branch_id, source, filename, date_from, date_to, rows_processed,
            rows_created, rows_updated, rows_rejected, status)
         values ($1, $2, 'pedidosya-csv', $3, $4, $5, $6, $7, $8, $9, 'success')`,
        [importId, branch.id, input.filename ?? null, input.from, input.to,
         parsed.rows, created, updated, parsed.excluded]
      );
      await tx.query(
        `insert into sync_runs
           (id, branch_id, integration, finished_at, status, records_received,
            records_created, records_updated)
         values ($1, $2, 'pedidosya-csv', now(), 'success', $3, $4, $5)`,
        [randomUUID(), branch.id, parsed.rows, created, updated]
      );
      await tx.query(
        `insert into audit_logs
           (id, organization_id, user_id, action, entity, entity_id, new_value)
         values ($1, $2, $3, 'pedidosya.imported', 'imports', $4, $5)`,
        [randomUUID(), req.user!.organization_id, req.user!.id, importId,
         JSON.stringify({ from: input.from, to: input.to, rows: parsed.rows, created, updated,
           cancelledUpdated, excluded: parsed.excluded, awaitingAmounts: parsed.awaitingAmounts })]
      );
    });
    res.status(201).json({ importId, from: input.from, to: input.to, rows: parsed.rows,
      created, updated, cancelledUpdated, excluded: parsed.excluded, awaitingAmounts: parsed.awaitingAmounts,
      subtotal: parsed.orders.reduce((sum, order) => sum + order.subtotal, 0),
      estimatedIncome: parsed.orders.reduce((sum, order) => sum + order.estimatedIncome, 0) });
  });
}

import { randomUUID } from "node:crypto";
import { db, queryOne } from "./db.js";
import {
  DulceHoraClient,
  DulceHoraRateLimitError,
  getDulceHoraCredentials,
  type DulceHoraDocument,
  type DulceHoraWastePayload,
  type RegistryEntry,
  type ProductCatalogItem
} from "./dulceHoraClient.js";

type SyncInput = {
  branchId: string;
  organizationId: string;
  userId: string;
  date: string;
};

type ParsedItem = {
  externalProductId: string;
  source: "product" | "custom";
  originalName: string;
  category?: string;
  quantity: number;
  unitPrice: number | null;
  discount: number;
  lineTotal: number;
  raw: unknown;
};

type ParsedDocument = {
  externalId: string;
  documentNumber: string | null;
  documentType: string;
  saleDate: string;
  saleTime: string | null;
  subtotal: number | null;
  discount: number;
  total: number;
  paymentMethod: string | null;
  status: string;
  rawData: Record<string, unknown>;
  items: ParsedItem[];
};

type ParsedWasteRecord = {
  externalId: string;
  externalEventId: string;
  date: string;
  productExternalId: string;
  productName: string;
  category?: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number;
  userName: string | null;
  rawData: Record<string, unknown>;
};

export type SyncResult = {
  runId: string;
  date: string;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  itemRows: number;
  wasteRecordsReceived: number;
  wasteRecordsCreated: number;
  wasteRecordsUpdated: number;
  errors: string[];
};

export type SyncHistoryResult = SyncResult & {
  dateFrom: string | null;
  dateTo: string | null;
  datesSynced: number;
};

export async function syncDulceHoraDate(input: SyncInput): Promise<SyncResult> {
  const credentials = getDulceHoraCredentials();
  if (!credentials) {
    throw new Error("Faltan DULCE_HORA_USERNAME y DULCE_HORA_PASSWORD en el entorno del backend");
  }

  const runId = randomUUID();
  await db.query(
    `insert into sync_runs (id, branch_id, integration, status)
     values ($1, $2, 'dulce-hora-panel', 'running')`,
    [runId, input.branchId]
  );

  const result: SyncResult = {
    runId,
    date: input.date,
    recordsReceived: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsRejected: 0,
    itemRows: 0,
    wasteRecordsReceived: 0,
    wasteRecordsCreated: 0,
    wasteRecordsUpdated: 0,
    errors: []
  };

  try {
    const client = new DulceHoraClient(credentials);
    await client.login();
    const [statistics, wastePayload] = await Promise.all([
      client.fetchStatistics(),
      client.fetchWasteRecords()
    ]);

    const catalog = statistics.catalog.size > 0 ? statistics.catalog : await client.fetchCatalog();
    const registryEntries = await client.fetchRegistry(input.date);

    if (registryEntries.length > 0) {
      result.recordsReceived = registryEntries.length;
      for (const entry of registryEntries) {
        try {
          const document = await fetchDocumentWithRetry(client, entry);
          const parsed = parseDocument(document, input.date, catalog);
          const upsert = await saveDocument(input.organizationId, input.branchId, parsed);
          result.recordsCreated += upsert.created ? 1 : 0;
          result.recordsUpdated += upsert.created ? 0 : 1;
          result.itemRows += parsed.items.length;
        } catch (error) {
          if (error instanceof DulceHoraRateLimitError) {
            const parsed = parseListingDocument(entry, input.date);
            const upsert = await saveDocument(input.organizationId, input.branchId, parsed);
            result.recordsCreated += upsert.created ? 1 : 0;
            result.recordsUpdated += upsert.created ? 0 : 1;
            if (result.errors.length === 0) {
              result.errors.push(
                "Dulce Hora limito temporalmente el detalle de comprobantes; se completo la venta desde el listado."
              );
            }
            continue;
          }
          result.recordsRejected += 1;
          result.errors.push(error instanceof Error ? error.message : "Error desconocido");
        }
      }
    } else {
      const entries = statistics.documents.filter((document) => documentDate(document) === input.date);
      result.recordsReceived = entries.length;

      for (const detail of entries) {
        try {
          const parsed = parseDocument(statisticsDocument(detail), input.date, catalog);
          const upsert = await saveDocument(input.organizationId, input.branchId, parsed);
          result.recordsCreated += upsert.created ? 1 : 0;
          result.recordsUpdated += upsert.created ? 0 : 1;
          result.itemRows += parsed.items.length;
        } catch (error) {
          result.recordsRejected += 1;
          result.errors.push(error instanceof Error ? error.message : "Error desconocido");
        }
      }
    }

    const wasteResult = await saveWasteRecords(
      input.organizationId,
      input.branchId,
      input.date,
      wastePayload
    );
    result.wasteRecordsReceived = wasteResult.received;
    result.wasteRecordsCreated = wasteResult.created;
    result.wasteRecordsUpdated = wasteResult.updated;

    await finishRun(runId, "success", result);
    await auditSync(input.organizationId, input.userId, runId, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    result.errors.push(message);
    await finishRun(runId, "failed", result, message);
    throw error;
  }
}

export async function syncDulceHoraHistory(
  input: Omit<SyncInput, "date"> & { dateFrom?: string | null; dateTo?: string | null }
): Promise<SyncHistoryResult> {
  const credentials = getDulceHoraCredentials();
  if (!credentials) {
    throw new Error("Faltan DULCE_HORA_USERNAME y DULCE_HORA_PASSWORD en el entorno del backend");
  }

  const runId = randomUUID();
  await db.query(
    `insert into sync_runs (id, branch_id, integration, status)
     values ($1, $2, 'dulce-hora-panel-history', 'running')`,
    [runId, input.branchId]
  );

  const result: SyncHistoryResult = {
    runId,
    date: "historial",
    dateFrom: null,
    dateTo: null,
    datesSynced: 0,
    recordsReceived: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsRejected: 0,
    itemRows: 0,
    wasteRecordsReceived: 0,
    wasteRecordsCreated: 0,
    wasteRecordsUpdated: 0,
    errors: []
  };

  try {
    const client = new DulceHoraClient(credentials);
    await client.login();
    const [statistics, wastePayload] = await Promise.all([
      client.fetchStatistics(),
      client.fetchWasteRecords()
    ]);
    const documentsByDate = groupByDate(statistics.documents);
    const dates = [...new Set([...documentsByDate.keys(), ...wasteDates(wastePayload)])]
      .filter((date) => (!input.dateFrom || date >= input.dateFrom) && (!input.dateTo || date <= input.dateTo))
      .sort();
    result.dateFrom = dates[0] ?? null;
    result.dateTo = dates.at(-1) ?? null;

    for (const date of dates) {
      const entries = documentsByDate.get(date) ?? [];
      result.recordsReceived += entries.length;

      for (const detail of entries) {
        try {
          const parsed = parseDocument(statisticsDocument(detail), date, statistics.catalog);
          const upsert = await saveDocument(input.organizationId, input.branchId, parsed);
          result.recordsCreated += upsert.created ? 1 : 0;
          result.recordsUpdated += upsert.created ? 0 : 1;
          result.itemRows += parsed.items.length;
        } catch (error) {
          result.recordsRejected += 1;
          result.errors.push(error instanceof Error ? error.message : "Error desconocido");
        }
      }

      const wasteResult = await saveWasteRecords(
        input.organizationId,
        input.branchId,
        date,
        wastePayload
      );
      result.wasteRecordsReceived += wasteResult.received;
      result.wasteRecordsCreated += wasteResult.created;
      result.wasteRecordsUpdated += wasteResult.updated;
      if (entries.length > 0 || wasteResult.received > 0) result.datesSynced += 1;
    }

    await finishRun(runId, "success", result);
    await auditSync(input.organizationId, input.userId, runId, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    result.errors.push(message);
    await finishRun(runId, "failed", result, message);
    throw error;
  }
}

async function fetchDocumentWithRetry(client: DulceHoraClient, entry: RegistryEntry) {
  const defaultRetries = process.env.NETLIFY === "true" ? 0 : 1;
  const retries = Number(process.env.DULCE_HORA_RATE_LIMIT_RETRIES ?? defaultRetries);
  const pauseMs = Number(process.env.DULCE_HORA_RATE_LIMIT_PAUSE_MS ?? 65000);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await client.fetchDocument(entry);
    } catch (error) {
      if (!(error instanceof DulceHoraRateLimitError) || attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }

  throw new DulceHoraRateLimitError();
}

function groupByDate(documents: Array<Record<string, unknown>>) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const document of documents) {
    const date = documentDate(document);
    if (!date) continue;
    const entries = grouped.get(date) ?? [];
    entries.push(document);
    grouped.set(date, entries);
  }
  return grouped;
}

function wasteDates(payload: DulceHoraWastePayload) {
  return payload.events
    .filter((event) => event.active)
    .map((event) => formatArgentinaDate(event.occurredAt))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
}

function parseDocument(
  document: DulceHoraDocument,
  fallbackDate: string,
  catalog: Map<string, ProductCatalogItem>
): ParsedDocument {
  const detail = document.detail;
  const externalId = `${document.listing.displayType}:${String(detail.id ?? document.listing.externalId)}`;
  const tipo = detail.tipo ?? document.listing.displayType;
  const documentType = normalizeDocumentType(tipo);
  const fechaEvento = String(detail.fechaevento ?? detail.fecha ?? fallbackDate);
  const { saleDate, saleTime } = parseEventDate(fechaEvento, fallbackDate);
  const total = toNumber(detail.total);
  const discount = extractDiscount(detail.observaciones);
  const subtotal = detail.neto !== undefined ? toNumber(detail.neto) : total + discount;
  const documentNumber = formatDocumentNumber(detail);
  const status = statusFromDocument(tipo, detail.nc_factura);
  const rawItems = parseRawItems(detail.detalle);

  return {
    externalId,
    documentNumber,
    documentType,
    saleDate,
    saleTime,
    subtotal,
    discount,
    total,
    paymentMethod: detail.formaPago ? String(detail.formaPago) : null,
    status,
    rawData: detail,
    items: rawItems.map((raw) => parseItem(raw, catalog))
  };
}

function statisticsDocument(detail: Record<string, unknown>): DulceHoraDocument {
  return {
    listing: {
      externalId: String(detail.id ?? ""),
      displayType: listingTypeFromDetail(detail.tipo),
      cells: []
    },
    detail
  };
}

function parseListingDocument(entry: RegistryEntry, fallbackDate: string): ParsedDocument {
  const { saleDate, saleTime } = parseListingDate(entry.cells[0] ?? "", fallbackDate);
  return {
    externalId: `${entry.displayType}:${entry.externalId}`,
    documentNumber: entry.cells[2] || null,
    documentType: normalizeDocumentType(entry.displayType),
    saleDate,
    saleTime,
    subtotal: null,
    discount: 0,
    total: parseMoney(entry.cells[3] ?? "0"),
    paymentMethod: entry.cells[4] || null,
    status: "active",
    rawData: {
      listing: entry,
      detailUnavailable: true
    },
    items: []
  };
}

function parseItem(raw: unknown, catalog: Map<string, ProductCatalogItem>): ParsedItem {
  const row = Array.isArray(raw) ? raw : [];
  const productId = String(row[5] ?? row[3] ?? "");
  const source: ParsedItem["source"] = catalog.has(`product:${productId}`) ? "product" : "custom";
  const catalogItem = catalog.get(`${source}:${productId}`);
  const lineTotal = toNumber(row[1]);
  const quantity = toNumber(row[4]) || 1;
  const unitPrice = quantity > 0 ? lineTotal / quantity : null;

  return {
    externalProductId: `${source}:${productId}`,
    source,
    originalName: catalogItem?.name ?? `Producto externo ${source}:${productId}`,
    category: catalogItem?.category,
    quantity,
    unitPrice,
    discount: 0,
    lineTotal,
    raw
  };
}

async function saveDocument(organizationId: string, branchId: string, document: ParsedDocument) {
  return db.transaction(async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `select id from sales_documents
       where branch_id = $1 and external_id = $2
       limit 1`,
      [branchId, document.externalId]
    );

    const documentId = existing.rows[0]?.id ?? randomUUID();
    const created = existing.rows.length === 0;
    const dedupeKey = `${branchId}|${document.externalId}`;
    const preserveExistingItems = document.items.length === 0 && document.rawData.detailUnavailable === true;

    if (created) {
      await tx.query(
        `insert into sales_documents
          (id, branch_id, external_id, dedupe_key, document_number, document_type, sale_date,
           sale_time, subtotal, discount, total, payment_method, status, source, raw_data)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'dulce-hora-panel', $14)`,
        [
          documentId,
          branchId,
          document.externalId,
          dedupeKey,
          document.documentNumber,
          document.documentType,
          document.saleDate,
          document.saleTime,
          document.subtotal,
          document.discount,
          document.total,
          document.paymentMethod,
          document.status,
          JSON.stringify(document.rawData)
        ]
      );
    } else {
      await tx.query(
        `update sales_documents
         set document_number = $3,
             document_type = $4,
             sale_date = $5,
             sale_time = $6,
             subtotal = $7,
             discount = $8,
             total = $9,
             payment_method = $10,
             status = $11,
             raw_data = $12,
             imported_at = now()
         where id = $1 and branch_id = $2`,
        [
          documentId,
          branchId,
          document.documentNumber,
          document.documentType,
          document.saleDate,
          document.saleTime,
          document.subtotal,
          document.discount,
          document.total,
          document.paymentMethod,
          document.status,
          JSON.stringify(document.rawData)
        ]
      );
      if (!preserveExistingItems) {
        await tx.query("delete from sale_items where sales_document_id = $1", [documentId]);
      }
    }

    if (!preserveExistingItems) {
      for (const item of document.items) {
        const productId = await ensureProduct(tx, organizationId, item);
        await tx.query(
          `insert into sale_items
            (id, sales_document_id, external_product_id, original_name, normalized_product_id,
             quantity, unit_price, discount, line_total)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            randomUUID(),
            documentId,
            item.externalProductId,
            item.originalName,
            productId,
            item.quantity,
            item.unitPrice,
            item.discount,
            item.lineTotal
          ]
        );
      }
    }

    return { created };
  });
}

async function saveWasteRecords(
  organizationId: string,
  branchId: string,
  date: string,
  payload: DulceHoraWastePayload
) {
  const records = parseWasteRecords(date, payload);
  let created = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    for (const record of records) {
      const productId = await ensureWasteProduct(tx, organizationId, record);
      const existing = await tx.query<{ id: string }>(
        `select id from waste_records
         where branch_id = $1 and external_id = $2
         limit 1`,
        [branchId, record.externalId]
      );

      if (existing.rows[0]?.id) {
        await tx.query(
          `update waste_records
           set date = $3,
               product_id = $4,
               quantity = $5,
               unit_cost = $6,
               total_cost = $7,
               notes = $8,
               source = 'dulce-hora-panel',
               external_event_id = $9,
               user_name = $10,
               raw_data = $11
           where id = $1 and branch_id = $2`,
          [
            existing.rows[0].id,
            branchId,
            record.date,
            productId,
            record.quantity,
            record.unitCost,
            record.totalCost,
            wasteNotes(record),
            record.externalEventId,
            record.userName,
            JSON.stringify(record.rawData)
          ]
        );
        updated += 1;
      } else {
        await tx.query(
          `insert into waste_records
            (id, branch_id, date, product_id, quantity, unit_cost, total_cost, notes,
             source, external_id, external_event_id, user_name, raw_data)
           values ($1, $2, $3, $4, $5, $6, $7, $8, 'dulce-hora-panel', $9, $10, $11, $12)`,
          [
            randomUUID(),
            branchId,
            record.date,
            productId,
            record.quantity,
            record.unitCost,
            record.totalCost,
            wasteNotes(record),
            record.externalId,
            record.externalEventId,
            record.userName,
            JSON.stringify(record.rawData)
          ]
        );
        created += 1;
      }
    }
  });

  return { received: records.length, created, updated };
}

function parseWasteRecords(date: string, payload: DulceHoraWastePayload): ParsedWasteRecord[] {
  const records: ParsedWasteRecord[] = [];

  for (const event of payload.events) {
    if (!event.active || formatArgentinaDate(event.occurredAt) !== date) continue;

    event.lines.forEach((line, index) => {
      const product = payload.products.get(line.productId);
      const totalCost = line.totalCost;
      records.push({
        externalId: `${event.id}:${line.productId}:${index}`,
        externalEventId: event.id,
        date,
        productExternalId: `local:${line.productId}`,
        productName: product?.name ?? `Producto desperdicio ${line.productId}`,
        category: product?.category,
        quantity: line.quantity,
        unitCost: line.quantity > 0 ? totalCost / line.quantity : null,
        totalCost,
        userName: event.userName,
        rawData: { event: event.raw, line: line.raw }
      });
    });
  }

  return records;
}

async function ensureWasteProduct(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  record: ParsedWasteRecord
) {
  const alias = await tx.query<{ product_id: string }>(
    `select product_id
     from product_aliases
     where source = 'dulce-hora-waste' and external_id = $1
     limit 1`,
    [record.productExternalId]
  );
  if (alias.rows[0]?.product_id) return alias.rows[0].product_id;

  const categoryId = record.category ? await ensureCategory(tx, organizationId, record.category) : null;
  const existing = await tx.query<{ id: string }>(
    `select id from products
     where organization_id = $1 and canonical_name = $2
     limit 1`,
    [organizationId, record.productName]
  );
  const productId = existing.rows[0]?.id ?? randomUUID();

  if (existing.rows.length === 0) {
    await tx.query(
      `insert into products (id, organization_id, canonical_name, category_id, cost, active)
       values ($1, $2, $3, $4, $5, true)`,
      [productId, organizationId, record.productName, categoryId, record.unitCost]
    );
  }

  await tx.query(
    `insert into product_aliases (id, product_id, source, external_name, external_id)
     values ($1, $2, 'dulce-hora-waste', $3, $4)`,
    [randomUUID(), productId, record.productName, record.productExternalId]
  );

  return productId;
}

async function ensureProduct(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  item: ParsedItem
) {
  const alias = await tx.query<{ product_id: string }>(
    `select pa.product_id
     from product_aliases pa
     where pa.source = 'dulce-hora-panel' and pa.external_id = $1
     limit 1`,
    [item.externalProductId]
  );
  if (alias.rows[0]?.product_id) {
    await refreshProductName(tx, organizationId, alias.rows[0].product_id, item);
    return alias.rows[0].product_id;
  }

  const categoryId = item.category ? await ensureCategory(tx, organizationId, item.category) : null;
  const existing = await tx.query<{ id: string }>(
    `select id from products
     where organization_id = $1 and canonical_name = $2
     limit 1`,
    [organizationId, item.originalName]
  );
  const productId = existing.rows[0]?.id ?? randomUUID();

  if (existing.rows.length === 0) {
    await tx.query(
      `insert into products (id, organization_id, canonical_name, category_id, cost, active)
       values ($1, $2, $3, $4, null, true)`,
      [productId, organizationId, item.originalName, categoryId]
    );
  }

  await tx.query(
    `insert into product_aliases (id, product_id, source, external_name, external_id)
     values ($1, $2, 'dulce-hora-panel', $3, $4)`,
    [randomUUID(), productId, item.originalName, item.externalProductId]
  );

  return productId;
}

async function refreshProductName(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  productId: string,
  item: ParsedItem
) {
  if (item.originalName.startsWith("Producto externo")) return;

  const existing = await tx.query<{ canonical_name: string; category_id: string | null }>(
    `select canonical_name, category_id
     from products
     where id = $1 and organization_id = $2
     limit 1`,
    [productId, organizationId]
  );
  const product = existing.rows[0];
  if (!product || !product.canonical_name.startsWith("Producto externo")) return;

  const productWithName = await tx.query<{ id: string }>(
    `select id
     from products
     where organization_id = $1
       and canonical_name = $2
       and id <> $3
     limit 1`,
    [organizationId, item.originalName, productId]
  );
  const targetProductId = productWithName.rows[0]?.id;
  if (targetProductId) {
    await tx.query(
      `update sale_items
       set normalized_product_id = $2
       where normalized_product_id = $1`,
      [productId, targetProductId]
    );
    await tx.query(
      `update product_aliases
       set product_id = $2,
           external_name = $3
       where product_id = $1 and source = 'dulce-hora-panel'`,
      [productId, targetProductId, item.originalName]
    );
    return;
  }

  const categoryId = item.category ? await ensureCategory(tx, organizationId, item.category) : product.category_id;
  await tx.query(
    `update products
     set canonical_name = $3,
         category_id = $4
     where id = $1 and organization_id = $2`,
    [productId, organizationId, item.originalName, categoryId]
  );
  await tx.query(
    `update product_aliases
     set external_name = $2
     where product_id = $1 and source = 'dulce-hora-panel'`,
    [productId, item.originalName]
  );
}

async function ensureCategory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  name: string
) {
  const existing = await tx.query<{ id: string }>(
    `select id from categories
     where organization_id = $1 and name = $2
     limit 1`,
    [organizationId, name]
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const id = randomUUID();
  await tx.query(
    `insert into categories (id, organization_id, name, target_margin, active)
     values ($1, $2, $3, null, true)`,
    [id, organizationId, name]
  );
  return id;
}

async function finishRun(runId: string, status: string, result: SyncResult, errorMessage?: string) {
  await db.query(
    `update sync_runs
     set finished_at = now(),
         status = $2,
         records_received = $3,
         records_created = $4,
         records_updated = $5,
         error_message = $6
     where id = $1`,
    [
      runId,
      status,
      result.recordsReceived,
      result.recordsCreated,
      result.recordsUpdated,
      errorMessage ?? (result.errors.length > 0 ? result.errors.slice(0, 3).join(" | ") : null)
    ]
  );
}

async function auditSync(organizationId: string, userId: string, runId: string, result: SyncResult) {
  await db.query(
    `insert into audit_logs
      (id, organization_id, user_id, action, entity, entity_id, previous_value, new_value)
     values ($1, $2, $3, 'sync.dulce_hora.date', 'sync_runs', $4, null, $5)`,
    [randomUUID(), organizationId, userId, runId, JSON.stringify(result)]
  );
}

function parseRawItems(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseEventDate(value: string, fallbackDate: string) {
  if (hasExplicitTimezone(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatArgentinaDateTime(date, fallbackDate);
    }
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}:\d{2}))?/);
  return {
    saleDate: match?.[1] ?? fallbackDate,
    saleTime: match?.[2] ?? null
  };
}

function hasExplicitTimezone(value: string) {
  return /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function formatArgentinaDateTime(date: Date, fallbackDate: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    saleDate: `${get("year")}-${get("month")}-${get("day")}` || fallbackDate,
    saleTime: `${get("hour")}:${get("minute")}:${get("second")}`
  };
}

function parseListingDate(value: string, fallbackDate: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
  if (!match) return { saleDate: fallbackDate, saleTime: null };

  return {
    saleDate: `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`,
    saleTime: match[4]
  };
}

function parseMoney(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
  return toNumber(normalized);
}

function formatDocumentNumber(detail: Record<string, unknown>) {
  const numero = detail.numero !== undefined ? String(detail.numero) : null;
  if (!numero) return null;
  if (detail.ptoventa === undefined) return numero;
  return `${String(detail.ptoventa).padStart(3, "0")}-${numero.padStart(7, "0")}`;
}

function normalizeDocumentType(tipo: unknown) {
  const value = String(tipo);
  const labels: Record<string, string> = {
    "1": "Factura A",
    "3": "Nota de credito A",
    "6": "Factura B",
    "8": "Nota de credito B",
    "11": "Factura C",
    "13": "Nota de credito C",
    C: "Comprobante C",
    X: "Comanda",
    S: "Senia"
  };
  return labels[value] ?? value;
}

function listingTypeFromDetail(tipo: unknown) {
  const value = String(tipo);
  if (["1", "3", "6", "8", "11", "13"].includes(value)) return "C";
  return value;
}

function documentDate(detail: Record<string, unknown>) {
  const fecha = String(detail.fecha ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const fechaEvento = String(detail.fechaevento ?? "");
  return parseEventDate(fechaEvento, "").saleDate;
}

function statusFromDocument(tipo: unknown, ncFactura: unknown) {
  if (["3", "8", "13"].includes(String(tipo))) return "credit_note";
  if (ncFactura !== null && ncFactura !== undefined && String(ncFactura) !== "") return "credited";
  return "active";
}

function extractDiscount(value: unknown) {
  if (typeof value !== "string") return 0;
  try {
    const observations = JSON.parse(value) as { descuento?: { estado?: boolean; monto?: number } };
    return observations.descuento?.estado ? toNumber(observations.descuento.monto) : 0;
  } catch {
    return 0;
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatArgentinaDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function wasteNotes(record: Pick<ParsedWasteRecord, "userName">) {
  return record.userName ? `Usuario Dulce Hora: ${record.userName}` : null;
}

export async function getDefaultBranch(organizationId: string) {
  return queryOne<{ id: string; name: string }>(
    `select id, name
     from branches
     where organization_id = $1 and active = true
     order by created_at
     limit 1`,
    [organizationId]
  );
}

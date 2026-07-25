import { randomUUID } from "node:crypto";
import { db, migrate, queryOne } from "../server/db.js";
import { getDefaultBranch, syncDulceHoraHistory } from "../server/dulceHoraSync.js";

type OrganizationRow = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  organization_id: string;
  name: string;
};

type Period = {
  label: string;
  from: string;
  to: string;
  lockWhenDone: boolean;
};

type PeriodLock = {
  id: string;
  status: string;
  locked_at: string;
};

type PeriodCounts = {
  sales_documents: string;
  sale_items: string;
  waste_records: string;
};

const defaultStartDate = "2026-04-17";

async function main() {
  const mode = readArg("mode") ?? (readArg("from") || readArg("to") || readArg("month") ? "range" : "closed");
  const from = readArg("from");
  const to = readArg("to");
  const month = readArg("month");
  const force = hasFlag("force");
  const includeWaste = !hasFlag("no-waste");
  const today = todayArgentina();

  await migrate();

  const organization = await queryOne<OrganizationRow>(
    "select id, name from organizations order by created_at limit 1"
  );
  if (!organization) throw new Error("No hay organizacion configurada");

  const user = await queryOne<UserRow>(
    `select id, organization_id, name
     from users
     where organization_id = $1 and active = true
     order by case when role = 'owner' then 0 else 1 end, created_at
     limit 1`,
    [organization.id]
  );
  if (!user) throw new Error("No hay usuario activo configurado");

  const branch = await getDefaultBranch(organization.id);
  if (!branch) throw new Error("No hay sucursal activa configurada");

  await closeStaleRunningSyncs(branch.id);

  const periods = buildPeriods({ mode, from, to, month, today });
  if (periods.length === 0) {
    console.log("No hay meses cerrados pendientes para sincronizar.");
    return;
  }

  console.log("Sincronizando Dulce Hora -> Neon");
  console.log(`Organizacion: ${organization.name}`);
  console.log(`Sucursal: ${branch.name}`);
  console.log(`Modo: ${mode}`);
  console.log(`Mermas: ${includeWaste ? "si" : "no"}`);
  console.log(`Forzar meses cerrados: ${force ? "si" : "no"}`);
  console.log("");

  const startedAt = Date.now();
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, period] of periods.entries()) {
    console.log(`\n[${index + 1}/${periods.length}] ${period.label} (${period.from} a ${period.to})`);

    if (period.lockWhenDone && !force) {
      const existingLock = await getPeriodLock(organization.id, branch.id, period.from);
      if (existingLock?.status === "locked") {
        skipped += 1;
        console.log(`Ya estaba cerrado en Neon desde ${formatDateTime(existingLock.locked_at)}. Se saltea.`);
        continue;
      }
    }

    const periodStartedAt = Date.now();
    try {
      const result = await syncDulceHoraHistory({
        branchId: branch.id,
        organizationId: organization.id,
        userId: user.id,
        dateFrom: period.from,
        dateTo: period.to,
        includeWaste,
        onDateSynced(progress) {
          console.log(
            `  ${progress.date}: ${progress.recordsReceived} comprobantes, ${progress.itemRows} items acumulados, ${progress.wasteRecordsReceived} mermas acumuladas`
          );
        }
      });
      const counts = await countPeriodRows(organization.id, branch.id, period.from, period.to);
      const status = result.errors.length > 0 || result.recordsRejected > 0 ? "partial" : "locked";

      if (period.lockWhenDone) {
        await upsertPeriodLock({
          organizationId: organization.id,
          branchId: branch.id,
          userId: user.id,
          period,
          counts,
          status,
          notes:
            status === "locked"
              ? "Mes cerrado importado desde Dulce Hora"
              : `Importacion parcial: ${result.errors.slice(0, 3).join(" | ")}`
        });
      }

      completed += 1;
      console.table({
        estado: period.lockWhenDone ? status : "actualizado",
        fechas: result.datesSynced,
        comprobantes_leidos: result.recordsReceived,
        nuevos: result.recordsCreated,
        actualizados: result.recordsUpdated,
        items: result.itemRows,
        mermas: result.wasteRecordsReceived,
        errores: result.errors.length,
        minutos: minutesSince(periodStartedAt)
      });

      if (result.errors.length > 0) {
        console.log("Errores principales:");
        for (const error of result.errors.slice(0, 8)) {
          console.log(`- ${error}`);
        }
      }
    } catch (error) {
      failed += 1;
      console.error(`No se pudo completar ${period.label}.`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.log("\nResumen final");
  console.table({
    completados: completed,
    salteados_por_cerrados: skipped,
    fallidos: failed,
    minutos_totales: minutesSince(startedAt)
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

function buildPeriods(input: {
  mode: string;
  from?: string;
  to?: string;
  month?: string;
  today: string;
}): Period[] {
  if (input.month) {
    assertMonth(input.month);
    const from = `${input.month}-01`;
    const to = minDate(monthEnd(from), input.today);
    return [periodForRange(from, to, input.today)];
  }

  if (input.mode === "range") {
    const from = input.from ?? defaultStartDate;
    const to = input.to ?? input.today;
    assertDate(from);
    assertDate(to);
    return [periodForRange(from, to, input.today)];
  }

  if (input.mode === "current") {
    const from = monthStart(input.today);
    return [{ label: monthLabel(from), from, to: input.today, lockWhenDone: false }];
  }

  if (input.mode === "all") {
    return [
      ...closedMonthPeriods(defaultStartDate, input.today),
      { label: `${monthLabel(monthStart(input.today))} (mes actual)`, from: monthStart(input.today), to: input.today, lockWhenDone: false }
    ];
  }

  if (input.mode === "closed") {
    return closedMonthPeriods(defaultStartDate, input.today);
  }

  throw new Error("Modo invalido. Usar --mode=closed, --mode=current, --mode=all o --mode=range.");
}

function closedMonthPeriods(startDate: string, today: string): Period[] {
  const periods: Period[] = [];
  let cursor = monthStart(startDate);
  const currentMonthStart = monthStart(today);

  while (cursor < currentMonthStart) {
    const to = minDate(monthEnd(cursor), previousDay(currentMonthStart));
    periods.push({ label: `${monthLabel(cursor)} (cerrado)`, from: cursor, to, lockWhenDone: true });
    cursor = nextMonthStart(cursor);
  }

  return periods;
}

function periodForRange(from: string, to: string, today: string): Period {
  const lockWhenDone = to < monthStart(today) && from.slice(0, 7) === to.slice(0, 7);
  return { label: lockWhenDone ? `${monthLabel(from)} (cerrado)` : "Rango manual", from, to, lockWhenDone };
}

async function closeStaleRunningSyncs(branchId: string) {
  await db.query(
    `update sync_runs
     set status = 'failed',
         finished_at = now(),
         error_message = coalesce(error_message, 'Sincronizacion local anterior cerrada antes de reintentar')
     where branch_id = $1
       and integration in ('dulce-hora-panel', 'dulce-hora-panel-history', 'dulce-hora-waste-history')
       and status = 'running'
       and started_at < now() - interval '20 minutes'`,
    [branchId]
  );
}

async function getPeriodLock(organizationId: string, branchId: string, periodStart: string) {
  return queryOne<PeriodLock>(
    `select id, status, locked_at
     from sync_period_locks
     where organization_id = $1
       and branch_id = $2
       and source = 'dulce-hora-panel'
       and period_type = 'month'
       and period_start = $3
     limit 1`,
    [organizationId, branchId, periodStart]
  );
}

async function countPeriodRows(
  organizationId: string,
  branchId: string,
  from: string,
  to: string
): Promise<PeriodCounts> {
  const row = await queryOne<PeriodCounts>(
    `select
       count(distinct sd.id)::text as sales_documents,
       count(si.id)::text as sale_items,
       (
         select count(wr.id)::text
         from waste_records wr
         join branches wb on wb.id = wr.branch_id
         where wb.organization_id = $1
           and wr.branch_id = $2
           and wr.source = 'dulce-hora-panel'
           and wr.date between $3 and $4
       ) as waste_records
     from sales_documents sd
     join branches b on b.id = sd.branch_id
     left join sale_items si on si.sales_document_id = sd.id
     where b.organization_id = $1
       and sd.branch_id = $2
       and sd.source = 'dulce-hora-panel'
       and sd.sale_date between $3 and $4`,
    [organizationId, branchId, from, to]
  );

  return row ?? { sales_documents: "0", sale_items: "0", waste_records: "0" };
}

async function upsertPeriodLock(input: {
  organizationId: string;
  branchId: string;
  userId: string;
  period: Period;
  counts: PeriodCounts;
  status: string;
  notes: string;
}) {
  await db.query(
    `insert into sync_period_locks
      (id, organization_id, branch_id, source, period_type, period_start, period_end,
       status, locked_at, locked_by_user_id, sales_documents_count, sale_items_count,
       waste_records_count, notes)
     values ($1, $2, $3, 'dulce-hora-panel', 'month', $4, $5, $6, now(), $7, $8, $9, $10, $11)
     on conflict (organization_id, branch_id, source, period_type, period_start)
     do update set period_end = excluded.period_end,
                   status = excluded.status,
                   locked_at = excluded.locked_at,
                   locked_by_user_id = excluded.locked_by_user_id,
                   sales_documents_count = excluded.sales_documents_count,
                   sale_items_count = excluded.sale_items_count,
                   waste_records_count = excluded.waste_records_count,
                   notes = excluded.notes`,
    [
      randomUUID(),
      input.organizationId,
      input.branchId,
      input.period.from,
      input.period.to,
      input.status,
      input.userId,
      Number(input.counts.sales_documents),
      Number(input.counts.sale_items),
      Number(input.counts.waste_records),
      input.notes
    ]
  );
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha invalida: ${value}. Usar YYYY-MM-DD.`);
  }
}

function assertMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error(`Mes invalido: ${value}. Usar YYYY-MM.`);
  }
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

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function monthEnd(value: string) {
  const [year, month] = value.split("-").map(Number);
  return formatDate(new Date(Date.UTC(year, month, 0)));
}

function nextMonthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  return formatDate(new Date(Date.UTC(year, month, 1)));
}

function previousDay(value: string) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDate(date);
}

function minDate(left: string, right: string) {
  return left < right ? left : right;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(value));
}

function minutesSince(startedAt: number) {
  return Math.round(((Date.now() - startedAt) / 60000) * 10) / 10;
}

main()
  .catch((error) => {
    console.error("\nNo se pudo completar la sincronizacion.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });

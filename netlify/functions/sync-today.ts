import type { Config, Handler } from "@netlify/functions";
import { migrate, queryOne } from "../../server/db.js";
import { getDefaultBranch, hydrateDulceHoraDetailBacklog, syncDulceHoraDate } from "../../server/dulceHoraSync.js";

process.env.DULCE_HORA_SERVERLESS = "true";
process.env.NETLIFY = process.env.NETLIFY ?? "true";

export const config: Config = {
  schedule: "*/15 * * * *"
};

type OrganizationRow = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  organization_id: string;
  name: string;
};

export const handler: Handler = async () => {
  try {
    await migrate();

    const organization = await queryOne<OrganizationRow>(
      "select id, name from organizations order by created_at limit 1"
    );
    if (!organization) return json(200, { ok: true, skipped: "no-organization" });

    const user = await queryOne<UserRow>(
      `select id, organization_id, name
       from users
       where organization_id = $1 and active = true
       order by case when role = 'owner' then 0 else 1 end, created_at
       limit 1`,
      [organization.id]
    );
    if (!user) return json(200, { ok: true, skipped: "no-user" });

    const branch = await getDefaultBranch(organization.id);
    if (!branch) return json(200, { ok: true, skipped: "no-branch" });

    const running = await queryOne<{ count: string }>(
      `select count(*)::text as count
       from sync_runs
       where branch_id = $1
         and integration = 'dulce-hora-panel'
         and status = 'running'
         and started_at > now() - interval '10 minutes'`,
      [branch.id]
    );
    if (Number(running?.count ?? 0) > 0) return json(200, { ok: true, skipped: "sync-running" });

    const date = todayArgentina();
    const result = await syncDulceHoraDate({
      branchId: branch.id,
      organizationId: organization.id,
      userId: user.id,
      date,
      includeWaste: false,
      includeStatistics: false
    });
    const detailLimit = positiveInteger(process.env.DULCE_HORA_SCHEDULED_DETAIL_LIMIT, 8);
    const detailWindowDays = positiveInteger(process.env.DULCE_HORA_SCHEDULED_DETAIL_WINDOW_DAYS, 7);
    const detailResult = await hydrateDulceHoraDetailBacklog({
      branchId: branch.id,
      organizationId: organization.id,
      userId: user.id,
      dateFrom: shiftDate(date, -(detailWindowDays - 1)),
      dateTo: date,
      limit: detailLimit
    });

    return json(200, {
      ok: true,
      date: result.date,
      recordsReceived: result.recordsReceived,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      itemRows: detailResult.itemRows,
      detailRecordsUpdated: detailResult.recordsUpdated,
      detailRecordsRemaining: detailResult.detailRecordsRemaining ?? null,
      detailWarnings: detailResult.warnings
    });
  } catch (error) {
    console.error("[scheduled-sync-today]", error);
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido"
    });
  }
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
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

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

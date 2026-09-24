import type { BackgroundHandler, Config } from "@netlify/functions";
import { resolveUserFromCookieHeader } from "../../server/auth.js";
import { db, migrate, queryOne } from "../../server/db.js";
import { syncRecentProductBackfill } from "../../server/dulceHoraSync.js";

process.env.DULCE_HORA_SERVERLESS = "true";
process.env.NETLIFY = process.env.NETLIFY ?? "true";

export const config: Config = {
  background: true
};

type RequestInput = {
  date?: string;
  days?: number;
  refreshLastDate?: boolean;
};

export const handler: BackgroundHandler = async (event) => {
  if (event.httpMethod !== "POST") return;

  try {
    await migrate();
    const auth = await resolveUserFromCookieHeader(event.headers.cookie);
    if (!auth || !["owner", "administrator", "manager"].includes(auth.user.role)) return;

    const input = parseInput(event.body);
    const branchId = event.queryStringParameters?.branchId?.trim();
    if (!branchId || branchId === "all") return;

    const branch = await queryOne<{ id: string }>(
      `select id
       from branches
       where id = $1 and organization_id = $2 and active = true`,
      [branchId, auth.user.organization_id]
    );
    if (!branch) return;

    const running = await queryOne<{ count: string }>(
      `select count(*)::text as count
       from sync_runs
       where branch_id = $1
         and integration = 'dulce-hora-panel-details-background'
         and status = 'running'
         and started_at > now() - interval '16 minutes'`,
      [branch.id]
    );
    if (Number(running?.count ?? 0) > 0) return;

    const dateTo = input.date ?? todayArgentina();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateTo > todayArgentina()) return;

    const result = await syncRecentProductBackfill({
      branchId: branch.id,
      organizationId: auth.user.organization_id,
      userId: auth.user.id,
      dateTo,
      days: input.days,
      refreshLastDate: input.refreshLastDate,
      detailLimit: positiveInteger(process.env.DULCE_HORA_BACKGROUND_DETAIL_LIMIT, 250),
      maxDetailDurationMs: positiveInteger(process.env.DULCE_HORA_BACKGROUND_DETAIL_MAX_MS, 705_000)
    });

    console.info("[dulce-hora:detail-backfill]", {
      branchId: branch.id,
      from: result.window.dateFrom,
      to: result.window.dateTo,
      baseDates: result.datesToRefresh,
      detailsRemaining: result.details.detailRecordsRemaining ?? null
    });
  } catch (error) {
    console.error("[dulce-hora:detail-backfill]", error);
    throw error;
  }
};

function parseInput(body: string | null): RequestInput {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as RequestInput;
    return {
      date: typeof parsed.date === "string" ? parsed.date : undefined,
      days: Number.isFinite(parsed.days) ? Math.max(1, Math.min(4, Math.floor(Number(parsed.days)))) : undefined,
      refreshLastDate: typeof parsed.refreshLastDate === "boolean" ? parsed.refreshLastDate : undefined
    };
  } catch {
    return {};
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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

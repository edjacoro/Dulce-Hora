import { migrate, queryOne } from "../server/db.js";
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

const defaultStartDate = "2026-04-17";

async function main() {
  const from = readArg("from") ?? defaultStartDate;
  const to = readArg("to") ?? todayArgentina();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Usar fechas con formato YYYY-MM-DD. Ejemplo: --from=2026-04-17 --to=2026-07-25");
  }

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

  const startedAt = Date.now();
  console.log(`Sincronizando Dulce Hora -> Neon`);
  console.log(`Organizacion: ${organization.name}`);
  console.log(`Sucursal: ${branch.name}`);
  console.log(`Rango: ${from} a ${to}`);
  console.log("Esto puede tardar varios minutos. No cierres esta ventana.\n");

  const result = await syncDulceHoraHistory({
    branchId: branch.id,
    organizationId: organization.id,
    userId: user.id,
    dateFrom: from,
    dateTo: to,
    includeWaste: true
  });

  console.log("\nSincronizacion terminada");
  console.table({
    fechas: result.datesSynced,
    comprobantes: result.recordsReceived,
    nuevos: result.recordsCreated,
    actualizados: result.recordsUpdated,
    items: result.itemRows,
    mermas: result.wasteRecordsReceived,
    "mermas nuevas": result.wasteRecordsCreated,
    "mermas actualizadas": result.wasteRecordsUpdated,
    errores: result.errors.length,
    minutos: Math.round(((Date.now() - startedAt) / 60000) * 10) / 10
  });

  if (result.errors.length > 0) {
    console.log("\nErrores:");
    for (const error of result.errors.slice(0, 20)) {
      console.log(`- ${error}`);
    }
  }
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
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

main()
  .catch((error) => {
    console.error("\nNo se pudo completar la sincronizacion.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });

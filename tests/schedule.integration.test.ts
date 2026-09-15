/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import test from "node:test";

test("turnos: alta, edicion, reasignacion, conflicto, auditoria y persistencia", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "dulce-hora-schedule-test-"));
  process.env.APP_ROOT = process.cwd();
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_URL = "";
  process.env.NETLIFY = "true";

  const [{ app, initializeServer }, { db }, { hashPassword }] = await Promise.all([
    import("../server/index.ts"),
    import("../server/db.ts"),
    import("../server/auth.ts")
  ]);
  await initializeServer();

  const organization = await db.query<{ id: string }>("select id from organizations order by created_at limit 1");
  assert.ok(organization.rows[0]?.id);

  const ownerId = randomUUID();
  const email = `schedule-owner-${randomUUID()}@example.com`;
  const password = "schedule-test-password";
  await db.query(
    `insert into users (id, organization_id, name, email, password_hash, role, active)
     values ($1, $2, 'Dueño de prueba', $3, $4, 'owner', true)`,
    [ownerId, organization.rows[0].id, email, await hashPassword(password)]
  );

  let server = await listen(app);
  let baseUrl = serverUrl(server);
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", cookie, ...init.headers }
    });
    const body = (await response.json()) as Record<string, any>;
    return { response, body };
  };

  const suffix = randomUUID().slice(0, 8);
  const employeeA = await request("/api/schedule/employees", {
    method: "POST",
    body: JSON.stringify({ name: `Empleado A ${suffix}`, active: true })
  });
  const employeeB = await request("/api/schedule/employees", {
    method: "POST",
    body: JSON.stringify({ name: `Empleado B ${suffix}`, active: true })
  });
  assert.equal(employeeA.response.status, 201);
  assert.equal(employeeB.response.status, 201);

  const date = addDays(todayArgentina(), 2);
  const month = date.slice(0, 7);
  const created = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify(shiftPayload(employeeA.body.id, date, "09:15", "12:45"))
  });
  assert.equal(created.response.status, 201);
  const shiftId = created.body.id as string;

  const scheduleAfterCreate = await request(`/api/schedule?month=${month}`);
  assert.equal(scheduleAfterCreate.response.status, 200);
  assert.equal(findShift(scheduleAfterCreate.body, shiftId).hours, 3.5);
  const businessDay = scheduleAfterCreate.body.businessHours.find((row: any) => row.date === date);
  assert.ok(businessDay);
  assert.equal(businessDay.openTime, weekdayNumber(date) === 0 ? "08:00" : "07:30");

  const edited = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify({ id: shiftId, ...shiftPayload(employeeA.body.id, date, "09:45", "12:45") })
  });
  assert.equal(edited.response.status, 200);

  const moved = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify({ id: shiftId, ...shiftPayload(employeeA.body.id, date, "10:15", "13:15") })
  });
  assert.equal(moved.response.status, 200);

  const resized = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify({ id: shiftId, ...shiftPayload(employeeA.body.id, date, "10:15", "13:45") })
  });
  assert.equal(resized.response.status, 200);

  const reassigned = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify({ id: shiftId, ...shiftPayload(employeeB.body.id, date, "10:15", "13:45") })
  });
  assert.equal(reassigned.response.status, 200);

  const conflict = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify(shiftPayload(employeeB.body.id, date, "11:00", "12:00"))
  });
  assert.equal(conflict.response.status, 409);
  assert.match(String(conflict.body.error), /ya tiene un turno/);

  const simultaneousOtherEmployee = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify(shiftPayload(employeeA.body.id, date, "11:00", "12:00"))
  });
  assert.equal(simultaneousOtherEmployee.response.status, 201);

  const afterChanges = await request(`/api/schedule?month=${month}`);
  const persisted = findShift(afterChanges.body, shiftId);
  assert.equal(persisted.employeeId, employeeB.body.id);
  assert.equal(persisted.startTime, "10:15");
  assert.equal(persisted.endTime, "13:45");
  assert.equal(persisted.hours, 3.5);

  const audit = await request(`/api/schedule/changes?month=${month}`);
  assert.equal(audit.response.status, 200);
  const operations = audit.body.changes.filter((row: any) => row.shiftId === shiftId).map((row: any) => row.operation);
  assert.ok(operations.includes("created"));
  assert.ok(operations.includes("updated"));
  assert.ok(operations.includes("reassigned"));
  assert.ok(audit.body.changes.every((row: any) => row.status === "approved"));

  const templateDate = addDays(todayArgentina(), 3);
  const templateMonth = templateDate.slice(0, 7);
  const templateName = `Empleado plantilla ${suffix}`;
  const templateEmployee = await request("/api/employees", {
    method: "POST",
    body: JSON.stringify({
      name: templateName,
      active: true,
      scheduleTemplate: {
        mode: "fixed",
        label: "Plantilla de prueba",
        rotation: "none",
        fixedShifts: [{ days: weekdaySpanish(templateDate), startTime: "15:10", endTime: "16:40" }],
        notes: "Prueba automatizada"
      }
    })
  });
  assert.equal(templateEmployee.response.status, 201);
  const scheduleFromTemplate = await request(`/api/schedule?month=${templateMonth}`);
  assert.ok(
    scheduleFromTemplate.body.shifts.some(
      (row: any) =>
        row.employeeId === templateEmployee.body.id && row.date === templateDate && row.startTime === "15:10" && row.endTime === "16:40"
    )
  );

  const changedTemplate = await request("/api/employees", {
    method: "POST",
    body: JSON.stringify({
      id: templateEmployee.body.id,
      name: templateName,
      active: true,
      scheduleTemplate: {
        mode: "fixed",
        label: "Plantilla actualizada",
        rotation: "none",
        fixedShifts: [{ days: weekdaySpanish(templateDate), startTime: "16:10", endTime: "17:40" }],
        notes: "Prueba automatizada"
      }
    })
  });
  assert.equal(changedTemplate.response.status, 200);
  const scheduleAfterTemplateChange = await request(`/api/schedule?month=${templateMonth}`);
  assert.equal(
    scheduleAfterTemplateChange.body.shifts.some(
      (row: any) => row.employeeId === templateEmployee.body.id && row.date === templateDate && row.startTime === "15:10"
    ),
    false
  );
  assert.ok(
    scheduleAfterTemplateChange.body.shifts.some(
      (row: any) => row.employeeId === templateEmployee.body.id && row.date === templateDate && row.startTime === "16:10"
    )
  );

  await close(server);
  server = await listen(app);
  baseUrl = serverUrl(server);
  const afterRestart = await request(`/api/schedule?month=${month}`);
  assert.equal(findShift(afterRestart.body, shiftId).employeeId, employeeB.body.id);

  const deleted = await request(`/api/schedule/shifts/${shiftId}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 200);
  const deleteSecond = await request(`/api/schedule/shifts/${simultaneousOtherEmployee.body.id}`, { method: "DELETE" });
  assert.equal(deleteSecond.response.status, 200);

  const afterDelete = await request(`/api/schedule?month=${month}`);
  assert.equal(afterDelete.body.shifts.some((row: any) => row.id === shiftId), false);
  const auditAfterDelete = await request(`/api/schedule/changes?month=${month}`);
  assert.ok(auditAfterDelete.body.changes.some((row: any) => row.shiftId === shiftId && row.operation === "deleted"));

  const historical = previousMonthDate(todayArgentina());
  const historicalAttempt = await request("/api/schedule/shifts", {
    method: "POST",
    body: JSON.stringify(shiftPayload(employeeA.body.id, historical, "09:00", "10:00"))
  });
  assert.equal(historicalAttempt.response.status, 409);

  await close(server);
});

function shiftPayload(employeeId: string, date: string, startTime: string, endTime: string) {
  return {
    employeeId,
    date,
    dateTo: null,
    startTime,
    endTime,
    breakMinutes: 0,
    isHoliday: false,
    isAbsence: false,
    notes: "Prueba automatizada"
  };
}

function findShift(schedule: Record<string, any>, id: string) {
  const shift = schedule.shifts.find((row: any) => row.id === id);
  assert.ok(shift, `No se encontro el turno ${id}`);
  return shift;
}

function todayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function previousMonthDate(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-15`;
}

function weekdayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function weekdaySpanish(value: string) {
  return ["Domingos", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabados"][weekdayNumber(value)];
}

async function listen(app: { listen: (port: number, host: string, callback: () => void) => Server }) {
  return await new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function serverUrl(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

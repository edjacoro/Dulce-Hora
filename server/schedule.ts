import type { Express, Request } from "express";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { db } from "./db.js";
import { getDefaultBranch } from "./dulceHoraSync.js";

type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type EmployeeRow = {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  weekly_hours: string;
  monthly_net_salary: string;
  monthly_gross_salary: string | null;
  employer_cost: string | null;
  photo_url: string | null;
  on_payroll: boolean;
  active: boolean;
  source: string;
};

type EmployeeRecordRow = EmployeeRow & {
  address: string | null;
  cuil: string | null;
  contact_phone: string | null;
  birth_date: string | null;
  observations: string | null;
  schedule_template: string | null;
};

type ShiftRow = {
  id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  hours: string;
  is_holiday: boolean;
  is_absence: boolean;
  notes: string | null;
  source: string;
  employee_id: string;
  employee_name: string;
  employee_color: string | null;
  weekly_hours: string;
  monthly_net_salary: string;
  employer_cost: string | null;
};

type NationalHoliday = {
  date: string;
  name: string;
};

type ManualHolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
  kind: "holiday" | "closure";
  close_at: string | null;
  source: "manual";
  active: boolean;
};

type ScheduleHoliday = {
  id: string | null;
  date: string;
  name: string;
  source: "national" | "manual";
  kind: "holiday" | "closure";
  hours: number;
  people: number;
  estimatedCost: number;
  shiftCount: number;
  isSaturday: boolean;
  closesAt: string | null;
};

type ParsedEmployee = {
  name: string;
  weeklyHours: number;
  monthlyNetSalary: number;
  monthlyGrossSalary: number | null;
  employerCost: number | null;
  onPayroll: boolean;
};

type DefaultScheduleEmployee = {
  name: string;
  role?: string;
  weeklyHours: number;
  shifts: Array<{
    weeks?: number[];
    weekdays: number[];
    startTime: string;
    endTime: string;
  }>;
};

type EmployeeScheduleBlock = {
  weeks?: string;
  days: string;
  startTime: string;
  endTime: string;
};

type EmployeeScheduleTemplate = {
  mode: "fixed" | "rotating" | "custom";
  label: string;
  rotation: "none" | "diego" | "vicky" | "mica" | "romi";
  fixedShifts: EmployeeScheduleBlock[];
  notes: string;
};

const DEFAULT_SCHEDULE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1mYOoGvqmee5CT1XF6xllwK-4FFp74iFU/export?format=xlsx";
const DEFAULT_SCHEDULE_SOURCE = "default-schedule-v6";
const LEGACY_DEFAULT_SCHEDULE_SOURCES = [
  "default-schedule",
  "default-schedule-v2",
  "default-schedule-v3",
  "default-schedule-v4",
  "default-schedule-v5"
];
const DEFAULT_SCHEDULE_WEEK_ONE_SUNDAY = "2026-05-31";
const WEEKS_PER_MONTH = 4.333;
const ARGENTINA_NATIONAL_HOLIDAYS: Record<string, NationalHoliday[]> = {
  "2026": [
    { date: "2026-01-01", name: "Año nuevo" },
    { date: "2026-02-16", name: "Carnaval" },
    { date: "2026-02-17", name: "Carnaval" },
    { date: "2026-03-24", name: "Dia Nacional de la Memoria por la Verdad y la Justicia" },
    { date: "2026-04-02", name: "Dia del Veterano y de los Caidos en la Guerra de Malvinas" },
    { date: "2026-04-03", name: "Viernes Santo" },
    { date: "2026-05-01", name: "Dia del Trabajador" },
    { date: "2026-05-25", name: "Dia de la Revolucion de Mayo" },
    { date: "2026-06-15", name: "Paso a la Inmortalidad del General Martin Guemes" },
    { date: "2026-06-20", name: "Paso a la Inmortalidad del General Manuel Belgrano" },
    { date: "2026-07-09", name: "Dia de la Independencia" },
    { date: "2026-08-17", name: "Paso a la Inmortalidad del Gral. Jose de San Martin" },
    { date: "2026-10-12", name: "Dia del Respeto a la Diversidad Cultural" },
    { date: "2026-11-23", name: "Dia de la Soberania Nacional" },
    { date: "2026-12-08", name: "Dia de la Inmaculada Concepcion de Maria" },
    { date: "2026-12-25", name: "Navidad" }
  ]
};
const DEFAULT_SCHEDULE_EMPLOYEES: DefaultScheduleEmployee[] = [
  {
    name: "Diego",
    role: "Dueño",
    weeklyHours: 56,
    shifts: [
      { weekdays: [1, 2, 3, 4, 5, 6], startTime: "06:30", endTime: "11:30" },
      { weekdays: [1, 2, 3, 4, 5, 6], startTime: "16:30", endTime: "20:00" },
      { weekdays: [0], startTime: "06:30", endTime: "11:30" }
    ]
  },
  {
    name: "Vicky",
    weeklyHours: 42,
    shifts: [
      { weeks: [1, 3], weekdays: [1, 2, 3, 4, 5, 6], startTime: "13:00", endTime: "20:00" },
      { weeks: [2, 4], weekdays: [2, 3, 4, 5, 6], startTime: "13:00", endTime: "20:00" },
      { weeks: [2, 4], weekdays: [0], startTime: "11:30", endTime: "19:30" }
    ]
  },
  {
    name: "Mica",
    weeklyHours: 42,
    shifts: [
      { weeks: [1, 3], weekdays: [2, 3, 4, 5, 6], startTime: "06:30", endTime: "13:30" },
      { weeks: [1, 3], weekdays: [0], startTime: "11:30", endTime: "19:30" },
      { weeks: [2, 4], weekdays: [1, 2, 3, 4, 5, 6], startTime: "06:30", endTime: "13:30" }
    ]
  },
  {
    name: "Romi",
    weeklyHours: 35,
    shifts: [
      { weekdays: [3, 4, 5, 6], startTime: "13:00", endTime: "20:00" },
      { weekdays: [0], startTime: "07:30", endTime: "14:30" }
    ]
  }
];

const employeeInputSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().max(80).optional().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#64748b"),
  weeklyHours: z.number().min(0).max(80).optional().default(0),
  monthlyNetSalary: z.number().min(0).optional().default(0),
  monthlyGrossSalary: z.number().min(0).optional().nullable(),
  employerCost: z.number().min(0).optional().nullable(),
  onPayroll: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true)
});

const employeeScheduleTemplateSchema = z.object({
  mode: z.enum(["fixed", "rotating", "custom"]).optional().default("fixed"),
  label: z.string().trim().max(120).optional().default(""),
  rotation: z.enum(["none", "diego", "vicky", "mica", "romi"]).optional().default("none"),
  fixedShifts: z
    .array(
      z.object({
        weeks: z.string().trim().max(80).optional().default(""),
        days: z.string().trim().min(2).max(120),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      })
    )
    .max(16)
    .optional()
    .default([]),
  notes: z.string().trim().max(1000).optional().default("")
});

const employeeFileInputSchema = employeeInputSchema.extend({
  address: z.string().trim().max(180).optional().default(""),
  cuil: z.string().trim().max(20).optional().default(""),
  contactPhone: z.string().trim().max(60).optional().default(""),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  observations: z.string().trim().max(1500).optional().default(""),
  photoUrl: z.string().trim().max(900_000).optional().nullable(),
  scheduleTemplate: employeeScheduleTemplateSchema.optional().default({
    mode: "fixed",
    label: "",
    rotation: "none",
    fixedShifts: [],
    notes: ""
  })
});

const shiftInputSchema = z.object({
  id: z.string().optional().nullable(),
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  breakMinutes: z.number().int().min(0).max(240).optional().default(0),
  isHoliday: z.boolean().optional().default(false),
  isAbsence: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().default("")
});

const scheduleImportSchema = z.object({
  url: z.string().url().optional().default(DEFAULT_SCHEDULE_SHEET_URL)
});

const scheduleHolidayInputSchema = z.object({
  id: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["holiday", "closure"]).optional().default("holiday"),
  closeAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable()
});

export function registerScheduleRoutes(app: Express) {
  app.get("/api/employees", requireAuth, async (req, res) => {
    const branch = await getDefaultBranch(req.user!.organization_id);
    if (branch) {
      const month = todayArgentina().slice(0, 7);
      await ensureDefaultScheduleForMonth(req.user!.organization_id, branch.id, month, monthRange(month));
    }

    const employeesResult = await db.query<EmployeeRecordRow>(
      `select id, name, role, weekly_hours::text, monthly_net_salary::text,
              monthly_gross_salary::text, employer_cost::text, photo_url,
              on_payroll, active, source,
              address, cuil, contact_phone, birth_date::text as birth_date,
              observations, schedule_template, color
       from employees
       where organization_id = $1
       order by active desc, name`,
      [req.user!.organization_id]
    );
    const employees = employeesResult.rows.map(formatEmployeeRecord);

    res.json({
      employees,
      summary: {
        total: employees.length,
        active: employees.filter((employee) => employee.active).length,
        missingCuil: employees.filter((employee) => !employee.cuil).length,
        missingBirthDate: employees.filter((employee) => !employee.birthDate).length
      }
    });
  });

  app.post("/api/employees", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = employeeFileInputSchema.parse(req.body);
    const id = input.id || randomUUID();
    const existing = input.id
      ? await db.query<{ id: string }>(
          `select id from employees where id = $1 and organization_id = $2`,
          [input.id, req.user!.organization_id]
        )
      : await db.query<{ id: string }>(
          `select id from employees where organization_id = $1 and lower(name) = lower($2)`,
          [req.user!.organization_id, input.name]
        );
    const role = roleForEmployee(input.name, input.role);
    const color = input.color || defaultEmployeeColor(input.name);
    const scheduleTemplate = JSON.stringify(normalizeScheduleTemplate(input.scheduleTemplate));
    const socialCharges = computedSocialCharges(input.onPayroll, input.monthlyNetSalary);
    const employerCost = computedEmployerCost(input.monthlyNetSalary, socialCharges);

    if (existing.rows[0]) {
      await db.query(
        `update employees
         set name = $1,
             role = $2,
             color = $3,
             weekly_hours = $4,
             monthly_net_salary = $5,
             monthly_gross_salary = $6,
             employer_cost = $7,
             on_payroll = $8,
             active = $9,
             address = $10,
             cuil = $11,
             contact_phone = $12,
             birth_date = $13,
             observations = $14,
             photo_url = $15,
             schedule_template = $16,
             updated_at = now()
         where id = $17`,
        [
          input.name,
          role,
          color,
          input.weeklyHours,
          input.monthlyNetSalary,
          socialCharges,
          employerCost,
          input.onPayroll,
          input.active,
          input.address || null,
          input.cuil || null,
          input.contactPhone || null,
          input.birthDate || null,
          input.observations || null,
          input.photoUrl || null,
          scheduleTemplate,
          existing.rows[0].id
        ]
      );
      res.json({ id: existing.rows[0].id, updated: true });
      return;
    }

    await db.query(
      `insert into employees
        (id, organization_id, name, role, weekly_hours, monthly_net_salary,
         monthly_gross_salary, employer_cost, on_payroll, active, source, address, cuil,
         contact_phone, birth_date, observations, photo_url, schedule_template, color)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual',
               $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        id,
        req.user!.organization_id,
        input.name,
        role,
        input.weeklyHours,
        input.monthlyNetSalary,
        socialCharges,
        employerCost,
        input.onPayroll,
        input.active,
        input.address || null,
        input.cuil || null,
        input.contactPhone || null,
        input.birthDate || null,
        input.observations || null,
        input.photoUrl || null,
        scheduleTemplate,
        color
      ]
    );

    res.status(201).json({ id, updated: false });
  });

  app.get("/api/schedule", requireAuth, async (req, res) => {
    const month = readMonth(req) ?? todayArgentina().slice(0, 7);
    const range = monthRange(month);
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para la grilla" });
      return;
    }

    await ensureDefaultScheduleForMonth(req.user!.organization_id, branch.id, month, range);

    const [employeesResult, shiftsResult, manualHolidaysResult] = await Promise.all([
      db.query<EmployeeRow>(
        `select id, name, role, weekly_hours::text, monthly_net_salary::text,
                monthly_gross_salary::text, employer_cost::text, photo_url,
                on_payroll, active, source, color
         from employees
         where organization_id = $1
         order by active desc, name`,
        [req.user!.organization_id]
      ),
      db.query<ShiftRow>(
        `select ss.id,
                ss.shift_date::text as shift_date,
                substring(ss.start_time::text from 1 for 5) as start_time,
                substring(ss.end_time::text from 1 for 5) as end_time,
                ss.break_minutes,
                ss.hours::text,
                ss.is_holiday,
                ss.is_absence,
                ss.notes,
                ss.source,
                e.id as employee_id,
                e.name as employee_name,
                e.color as employee_color,
                e.weekly_hours::text,
                e.monthly_net_salary::text,
                e.employer_cost::text
         from staff_shifts ss
         join employees e on e.id = ss.employee_id
         where ss.branch_id = $1
           and ss.shift_date >= $2
           and ss.shift_date <= $3
         order by ss.shift_date, ss.start_time, e.name`,
        [branch.id, range.from, range.to]
      ),
      db.query<ManualHolidayRow>(
        `select id,
                holiday_date::text as holiday_date,
                name,
                kind,
                substring(close_at::text from 1 for 5) as close_at,
                source,
                active
         from schedule_holidays
         where branch_id = $1
           and holiday_date >= $2
           and holiday_date <= $3
           and active = true
         order by holiday_date`,
        [branch.id, range.from, range.to]
      )
    ]);

    const employees = employeesResult.rows.map(formatEmployee);
    const holidayMap = scheduleHolidayMap(range, manualHolidaysResult.rows);
    const shifts = shiftsResult.rows.flatMap((row) => {
      const holiday = scheduleHolidayForDate(row.shift_date, holidayMap);
      const time = effectiveShiftTime(row, holiday);
      if (!time) return [];
      const baseMonthlyCost = toNumber(row.employer_cost) || toNumber(row.monthly_net_salary);
      const hourlyCost = hourlyCostFor(baseMonthlyCost, toNumber(row.weekly_hours));
      const hours = row.is_absence ? 0 : computeHours(time.startTime, time.endTime, row.break_minutes);
      const isHoliday = row.is_holiday || Boolean(holiday);
      const multiplier = isHoliday && !row.is_absence ? 2 : 1;
      return [{
        id: row.id,
        date: row.shift_date,
        weekday: weekdayLabel(row.shift_date),
        startTime: time.startTime,
        endTime: time.endTime,
        breakMinutes: row.break_minutes,
        hours,
        isHoliday,
        holidayName: holiday?.name ?? null,
        isAbsence: row.is_absence,
        notes: row.notes,
        source: row.source,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeColor: row.employee_color ?? defaultEmployeeColor(row.employee_name),
        hourlyCost,
        estimatedCost: hours * hourlyCost * multiplier
      }];
    });

    const employeeSummary = employees.map((employee) => {
      const employeeShifts = shifts.filter((shift) => shift.employeeId === employee.id);
      const hours = sum(employeeShifts.map((shift) => shift.hours));
      const holidayHours = sum(employeeShifts.filter((shift) => shift.isHoliday).map((shift) => shift.hours));
      const absences = employeeShifts.filter((shift) => shift.isAbsence).length;
      const estimatedCost = sum(employeeShifts.map((shift) => shift.estimatedCost));
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        hours,
        holidayHours,
        absences,
        shifts: employeeShifts.length,
        hourlyCost: employee.hourlyCost,
        estimatedCost
      };
    });

    const dailySummary = daysBetween(range).map((date) => {
      const dayShifts = shifts.filter((shift) => shift.date === date);
      return {
        date,
        weekday: weekdayLabel(date),
        hours: sum(dayShifts.map((shift) => shift.hours)),
        estimatedCost: sum(dayShifts.map((shift) => shift.estimatedCost)),
        people: new Set(dayShifts.filter((shift) => !shift.isAbsence).map((shift) => shift.employeeId)).size,
        holidays: dayShifts.filter((shift) => shift.isHoliday).length,
        absences: dayShifts.filter((shift) => shift.isAbsence).length
      };
    });
    const holidays = scheduleHolidaySummaries(holidayMap, shifts);

    res.json({
      month,
      range,
      branch,
      employees,
      shifts,
      employeeSummary,
      dailySummary,
      holidays,
      summary: {
        employees: employees.filter((employee) => employee.active).length,
        shifts: shifts.length,
        hours: sum(shifts.map((shift) => shift.hours)),
        holidayHours: sum(shifts.filter((shift) => shift.isHoliday).map((shift) => shift.hours)),
        absences: shifts.filter((shift) => shift.isAbsence).length,
        estimatedCost: sum(shifts.map((shift) => shift.estimatedCost))
      }
    });
  });

  app.post("/api/schedule/holidays", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = scheduleHolidayInputSchema.parse(req.body);
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para guardar feriados" });
      return;
    }

    if (input.id) {
      const existing = await db.query<{ id: string }>(
        `select id from schedule_holidays where id = $1 and branch_id = $2 and source = 'manual'`,
        [input.id, branch.id]
      );
      if (!existing.rows[0]) {
        res.status(404).json({ error: "Feriado manual no encontrado" });
        return;
      }
      await db.query(
        `update schedule_holidays
         set holiday_date = $1,
             name = $2,
             kind = $3,
             close_at = $4,
             active = true,
             updated_at = now()
         where id = $5`,
        [input.date, input.name, input.kind, input.closeAt || null, input.id]
      );
      res.json({ id: input.id, updated: true });
      return;
    }

    const id = randomUUID();
    const result = await db.query<{ id: string }>(
      `insert into schedule_holidays (id, branch_id, holiday_date, name, kind, close_at, source, active, created_by)
       values ($1, $2, $3, $4, $5, $6, 'manual', true, $7)
       on conflict (branch_id, holiday_date, source)
       do update set name = excluded.name,
                     kind = excluded.kind,
                     close_at = excluded.close_at,
                     active = true,
                     updated_at = now()
       returning id`,
      [id, branch.id, input.date, input.name, input.kind, input.closeAt || null, req.user!.id]
    );

    res.status(201).json({ id: result.rows[0]?.id ?? id, updated: false });
  });

  app.delete("/api/schedule/holidays/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const branch = await getDefaultBranch(req.user!.organization_id);
    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para borrar feriados" });
      return;
    }

    const result = await db.query<{ id: string }>(
      `delete from schedule_holidays
       where id = $1
         and branch_id = $2
         and source = 'manual'
       returning id`,
      [req.params.id, branch.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Feriado manual no encontrado" });
      return;
    }

    res.json({ ok: true });
  });

  app.post("/api/schedule/employees", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = employeeInputSchema.parse(req.body);
    const id = input.id || randomUUID();
    const existing = input.id
      ? await db.query<{ id: string }>(
          `select id from employees where id = $1 and organization_id = $2`,
          [input.id, req.user!.organization_id]
        )
      : await db.query<{ id: string }>(
          `select id from employees where organization_id = $1 and lower(name) = lower($2)`,
          [req.user!.organization_id, input.name]
        );

    if (existing.rows[0]) {
      await db.query(
        `update employees
         set name = $1,
             role = $2,
             weekly_hours = $3,
             monthly_net_salary = $4,
             monthly_gross_salary = $5,
             employer_cost = $6,
             active = $7,
             updated_at = now()
         where id = $8`,
        [
          input.name,
          roleForEmployee(input.name, input.role),
          input.weeklyHours,
          input.monthlyNetSalary,
          input.monthlyGrossSalary ?? null,
          input.employerCost ?? null,
          input.active,
          existing.rows[0].id
        ]
      );
      res.json({ id: existing.rows[0].id, updated: true });
      return;
    }

    await db.query(
      `insert into employees
        (id, organization_id, name, role, weekly_hours, monthly_net_salary,
         monthly_gross_salary, employer_cost, active, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual')`,
      [
        id,
        req.user!.organization_id,
        input.name,
        roleForEmployee(input.name, input.role),
        input.weeklyHours,
        input.monthlyNetSalary,
        input.monthlyGrossSalary ?? null,
        input.employerCost ?? null,
        input.active
      ]
    );

    res.status(201).json({ id, updated: false });
  });

  app.post("/api/schedule/shifts", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = shiftInputSchema.parse(req.body);
    const branch = await getDefaultBranch(req.user!.organization_id);

    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa para guardar turnos" });
      return;
    }

    const employee = await db.query<{ id: string }>(
      `select id from employees where id = $1 and organization_id = $2`,
      [input.employeeId, req.user!.organization_id]
    );
    if (!employee.rows[0]) {
      res.status(404).json({ error: "Empleado no encontrado" });
      return;
    }

    if (!input.id && input.isAbsence && input.dateTo && input.dateTo >= input.date) {
      const dates = datesBetween(input.date, input.dateTo);
      await db.transaction(async (tx) => {
        await tx.query(
          `delete from staff_shifts
           where branch_id = $1
             and employee_id = $2
             and shift_date >= $3
             and shift_date <= $4
             and source like 'default-schedule%'`,
          [branch.id, input.employeeId, input.date, input.dateTo]
        );

        for (const date of dates) {
          const existingAbsence = await tx.query<{ id: string }>(
            `select id
             from staff_shifts
             where branch_id = $1
               and employee_id = $2
               and shift_date = $3
               and is_absence = true`,
            [branch.id, input.employeeId, date]
          );
          if (existingAbsence.rows[0]) continue;

          await tx.query(
            `insert into staff_shifts
              (id, branch_id, employee_id, shift_date, start_time, end_time, break_minutes,
               hours, is_holiday, is_absence, notes, source)
             values ($1, $2, $3, $4, null, null, 0, 0, false, true, $5, 'manual')`,
            [randomUUID(), branch.id, input.employeeId, date, input.notes || "Vacaciones"]
          );
        }
      });
      res.status(201).json({ id: null, count: dates.length, updated: false });
      return;
    }

    const hours = input.isAbsence ? 0 : computeHours(input.startTime, input.endTime, input.breakMinutes);
    const existing = input.id
      ? await findShift(input.id, branch.id)
      : await db.query<{ id: string }>(
          `select id
           from staff_shifts
           where branch_id = $1
             and employee_id = $2
             and shift_date = $3
             and coalesce(substring(start_time::text from 1 for 5), '') = coalesce($4, '')
             and coalesce(substring(end_time::text from 1 for 5), '') = coalesce($5, '')
             and is_absence = $6`,
          [
            branch.id,
            input.employeeId,
            input.date,
            input.isAbsence ? null : input.startTime,
            input.isAbsence ? null : input.endTime,
            input.isAbsence
          ]
        );

    if (existing.rows[0]) {
      await db.query(
        `update staff_shifts
         set employee_id = $1,
             shift_date = $2,
             start_time = $3,
             end_time = $4,
             break_minutes = $5,
             hours = $6,
             is_holiday = $7,
             is_absence = $8,
             notes = $9,
             updated_at = now()
         where id = $10`,
        [
          input.employeeId,
          input.date,
          input.isAbsence ? null : input.startTime,
          input.isAbsence ? null : input.endTime,
          input.breakMinutes,
          hours,
          input.isHoliday,
          input.isAbsence,
          input.notes || null,
          existing.rows[0].id
        ]
      );
      res.json({ id: existing.rows[0].id, updated: true });
      return;
    }

    const id = randomUUID();
    await db.query(
      `insert into staff_shifts
        (id, branch_id, employee_id, shift_date, start_time, end_time, break_minutes,
         hours, is_holiday, is_absence, notes, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual')`,
      [
        id,
        branch.id,
        input.employeeId,
        input.date,
        input.isAbsence ? null : input.startTime,
        input.isAbsence ? null : input.endTime,
        input.breakMinutes,
        hours,
        input.isHoliday,
        input.isAbsence,
        input.notes || null
      ]
    );
    res.status(201).json({ id, updated: false });
  });

  app.delete("/api/schedule/shifts/:id", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const branch = await getDefaultBranch(req.user!.organization_id);
    if (!branch) {
      res.status(400).json({ error: "No hay una sucursal activa" });
      return;
    }

    const deleted = await db.query<{ id: string }>(
      `delete from staff_shifts where id = $1 and branch_id = $2 returning id`,
      [req.params.id, branch.id]
    );

    if (!deleted.rows[0]) {
      res.status(404).json({ error: "Turno no encontrado" });
      return;
    }

    res.json({ ok: true });
  });

  app.post("/api/imports/schedule-sheet", requireRole(["owner", "administrator", "manager"]), async (req, res) => {
    const input = scheduleImportSchema.parse(req.body ?? {});
    const workbook = await downloadWorkbook(input.url);
    const employees = parseEmployees(workbook);

    if (employees.length === 0) {
      res.status(400).json({ error: "No encontre empleados validos en la grilla horaria" });
      return;
    }

    let created = 0;
    let updated = 0;
    await db.transaction(async (tx) => {
      for (const employee of employees) {
        const wasUpdated = await upsertEmployee(tx, req.user!.organization_id, employee);
        if (wasUpdated) updated += 1;
        else created += 1;
      }
    });

    res.status(201).json({
      employeesReceived: employees.length,
      employeesCreated: created,
      employeesUpdated: updated,
      employees
    });
  });
}

async function ensureDefaultScheduleForMonth(
  organizationId: string,
  branchId: string,
  month: string,
  range: { from: string; to: string }
) {
  const existingPrefill = await db.query<{ id: string }>(
    `select id
     from schedule_month_prefills
     where branch_id = $1 and month = $2 and source = $3`,
    [branchId, month, DEFAULT_SCHEDULE_SOURCE]
  );
  if (existingPrefill.rows[0]) return;

  await db.transaction(async (tx) => {
    const insertedPrefill = await tx.query<{ id: string }>(
      `insert into schedule_month_prefills (id, branch_id, month, source)
       values ($1, $2, $3, $4)
       on conflict (branch_id, month, source) do nothing
       returning id`,
      [randomUUID(), branchId, month, DEFAULT_SCHEDULE_SOURCE]
    );
    if (!insertedPrefill.rows[0]) return;

    await removeLegacyDefaultSchedule(tx, branchId, range);

    const employeeIds = new Map<string, string>();
    for (const employee of DEFAULT_SCHEDULE_EMPLOYEES) {
      const id = await upsertDefaultScheduleEmployee(tx, organizationId, employee);
      employeeIds.set(employee.name, id);
    }

    for (const date of daysBetween(range)) {
      const weekday = weekdayNumber(date);
      const rotationWeek = scheduleRotationWeek(date);
      for (const employee of DEFAULT_SCHEDULE_EMPLOYEES) {
        const employeeId = employeeIds.get(employee.name);
        if (!employeeId) continue;

        for (const shift of employee.shifts) {
          if (shift.weeks && !shift.weeks.includes(rotationWeek)) continue;
          if (!shift.weekdays.includes(weekday)) continue;
          const adjustedShift = defaultShiftForDate(date, shift.startTime, shift.endTime);
          if (!adjustedShift) continue;
          await insertDefaultShiftIfMissing(tx, branchId, employeeId, date, adjustedShift.startTime, adjustedShift.endTime);
        }
      }
    }
  });
}

async function removeLegacyDefaultSchedule(
  queryable: Queryable,
  branchId: string,
  range: { from: string; to: string }
) {
  if (LEGACY_DEFAULT_SCHEDULE_SOURCES.length === 0) return;

  for (const legacySource of LEGACY_DEFAULT_SCHEDULE_SOURCES) {
    await queryable.query(
      `delete from staff_shifts
       where branch_id = $1
         and shift_date >= $2
         and shift_date <= $3
         and source = $4`,
      [branchId, range.from, range.to, legacySource]
    );
    await queryable.query(
      `delete from schedule_month_prefills
       where branch_id = $1
         and source = $2`,
      [branchId, legacySource]
    );
  }
}

async function upsertDefaultScheduleEmployee(
  queryable: Queryable,
  organizationId: string,
  employee: DefaultScheduleEmployee
) {
  const existing = await queryable.query<{ id: string; weekly_hours: string }>(
    `select id, weekly_hours::text
     from employees
     where organization_id = $1 and lower(name) = lower($2)`,
    [organizationId, employee.name]
  );

  if (existing.rows[0]) {
    await queryable.query(
      `update employees
       set weekly_hours = case when weekly_hours <= 0 then $1 else weekly_hours end,
           role = coalesce($2::text, role),
           color = coalesce(color, $3::text),
           schedule_template = case
             when coalesce(nullif(schedule_template, ''), '{}') = '{}' then $4::text
             else schedule_template
           end,
           active = true,
           updated_at = now()
       where id = $5`,
      [
        employee.weeklyHours,
        roleForEmployee(employee.name, employee.role ?? ""),
        defaultEmployeeColor(employee.name),
        JSON.stringify(defaultScheduleTemplateFor(employee.name)),
        existing.rows[0].id
      ]
    );
    return existing.rows[0].id;
  }

  const id = randomUUID();
  await queryable.query(
    `insert into employees
      (id, organization_id, name, role, weekly_hours, monthly_net_salary,
       monthly_gross_salary, employer_cost, active, source, schedule_template, color)
     values ($1, $2, $3, $4, $5, 0, null, null, true, $6, $7, $8)`,
    [
      id,
      organizationId,
      employee.name,
      roleForEmployee(employee.name, employee.role ?? "Equipo"),
      employee.weeklyHours,
      DEFAULT_SCHEDULE_SOURCE,
      JSON.stringify(defaultScheduleTemplateFor(employee.name)),
      defaultEmployeeColor(employee.name)
    ]
  );
  return id;
}

async function insertDefaultShiftIfMissing(
  queryable: Queryable,
  branchId: string,
  employeeId: string,
  date: string,
  startTime: string,
  endTime: string
) {
  const existing = await queryable.query<{ id: string }>(
    `select id
     from staff_shifts
     where branch_id = $1
       and employee_id = $2
       and shift_date = $3
       and substring(start_time::text from 1 for 5) = $4
       and substring(end_time::text from 1 for 5) = $5
       and is_absence = false`,
    [branchId, employeeId, date, startTime, endTime]
  );
  if (existing.rows[0]) return;

  await queryable.query(
    `insert into staff_shifts
      (id, branch_id, employee_id, shift_date, start_time, end_time, break_minutes,
       hours, is_holiday, is_absence, notes, source)
     values ($1, $2, $3, $4, $5, $6, 0, $7, $8, false, $9, $10)`,
    [
      randomUUID(),
      branchId,
      employeeId,
      date,
      startTime,
      endTime,
      computeHours(startTime, endTime, 0),
      Boolean(argentinaNationalHoliday(date)),
      "Grilla base precargada",
      DEFAULT_SCHEDULE_SOURCE
    ]
  );
}

async function findShift(id: string, branchId: string) {
  return db.query<{ id: string }>(
    `select id from staff_shifts where id = $1 and branch_id = $2`,
    [id, branchId]
  );
}

async function upsertEmployee(queryable: Queryable, organizationId: string, employee: ParsedEmployee) {
  const socialCharges = computedSocialCharges(employee.onPayroll, employee.monthlyNetSalary);
  const employerCost = computedEmployerCost(employee.monthlyNetSalary, socialCharges);
  const existing = await queryable.query<{ id: string }>(
    `select id from employees where organization_id = $1 and lower(name) = lower($2)`,
    [organizationId, employee.name]
  );

  if (existing.rows[0]) {
    await queryable.query(
      `update employees
       set weekly_hours = $1,
           monthly_net_salary = $2,
           monthly_gross_salary = $3,
           employer_cost = $4,
           on_payroll = $5,
           active = true,
           source = 'google-sheet-schedule',
           updated_at = now()
       where id = $6`,
      [
        employee.weeklyHours,
        employee.monthlyNetSalary,
        socialCharges,
        employerCost,
        employee.onPayroll,
        existing.rows[0].id
      ]
    );
    return true;
  }

  await queryable.query(
    `insert into employees
      (id, organization_id, name, role, weekly_hours, monthly_net_salary,
       monthly_gross_salary, employer_cost, on_payroll, active, source)
     values ($1, $2, $3, null, $4, $5, $6, $7, $8, true, 'google-sheet-schedule')`,
    [
      randomUUID(),
      organizationId,
      employee.name,
      employee.weeklyHours,
      employee.monthlyNetSalary,
      socialCharges,
      employerCost,
      employee.onPayroll
    ]
  );
  return false;
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

function parseEmployees(workbook: XLSX.WorkBook): ParsedEmployee[] {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false
    });
    const headerIndex = rows.findIndex((row) => {
      const cells = row.map((cell) => normalize(cell));
      return cells.includes("neto") && cells.includes("bruto");
    });
    if (headerIndex < 0) continue;

    const header = rows[headerIndex].map((cell) => normalize(cell));
    const netIndex = header.findIndex((value) => value === "neto");
    const grossIndex = header.findIndex((value) => value === "bruto");
    const employerIndex = header.findIndex((value) => value.includes("nos sale"));
    const hoursIndex = header.findIndex((value) => value === "horas");
    const employees: ParsedEmployee[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < Math.min(rows.length, headerIndex + 24); rowIndex += 1) {
      const row = rows[rowIndex];
      const nameIndex = findEmployeeNameIndex(row, netIndex);
      if (nameIndex < 0) continue;

      const name = formatEmployeeName(toText(row[nameIndex]));
      const weeklyHours =
        toNumber(row[hoursIndex]) || firstNumberBetween(row, nameIndex + 1, Math.max(netIndex, nameIndex + 2), 1, 80);
      const monthlyNetSalary = toNumber(row[netIndex]);
      if (!name || weeklyHours <= 0 || monthlyNetSalary <= 0) continue;

      employees.push({
        name,
        weeklyHours,
        monthlyNetSalary,
        monthlyGrossSalary: toNumber(row[grossIndex]) || null,
        employerCost: toNumber(row[employerIndex]) || null,
        onPayroll: Boolean(toNumber(row[grossIndex]))
      });
    }

    if (employees.length > 0) return employees;
  }

  return [];
}

function findEmployeeNameIndex(row: unknown[], netIndex: number) {
  const lastIndex = netIndex > 0 ? netIndex : row.length;
  for (let index = 0; index < lastIndex; index += 1) {
    const text = toText(row[index]);
    if (isLikelyEmployeeName(text)) return index;
  }
  return -1;
}

function isLikelyEmployeeName(value: string) {
  const text = normalize(value);
  if (!text) return false;
  if (text.length < 3 || text.length > 30) return false;
  if (/\d/.test(text)) return false;
  const excluded = new Set([
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "semana",
    "horas",
    "neto",
    "bruto",
    "feriados",
    "domingos"
  ]);
  return !excluded.has(text) && !text.includes(" a ");
}

function firstNumberBetween(row: unknown[], from: number, to: number, min: number, max: number) {
  for (let index = from; index < to; index += 1) {
    const value = toNumber(row[index]);
    if (value >= min && value <= max) return value;
  }
  return 0;
}

function formatEmployee(row: EmployeeRow) {
  const weeklyHours = toNumber(row.weekly_hours);
  const monthlyNetSalary = toNumber(row.monthly_net_salary);
  const monthlyEmployerCost = toNumber(row.employer_cost) || monthlyNetSalary;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    weeklyHours,
    monthlyNetSalary,
    monthlyGrossSalary: row.monthly_gross_salary ? toNumber(row.monthly_gross_salary) : null,
    employerCost: row.employer_cost ? toNumber(row.employer_cost) : null,
    photoUrl: row.photo_url,
    onPayroll: row.on_payroll ?? false,
    hourlyCost: hourlyCostFor(monthlyEmployerCost, weeklyHours),
    active: row.active,
    source: row.source,
    color: row.color ?? defaultEmployeeColor(row.name)
  };
}

function formatEmployeeRecord(row: EmployeeRecordRow) {
  const employee = formatEmployee(row);
  const age = ageFor(row.birth_date);
  return {
    ...employee,
    address: row.address,
    cuil: row.cuil,
    contactPhone: row.contact_phone,
    birthDate: row.birth_date,
    age,
    ageRange: ageRangeFor(age),
    observations: row.observations,
    scheduleTemplate: parseScheduleTemplate(row.schedule_template)
  };
}

function parseScheduleTemplate(value: string | null): EmployeeScheduleTemplate {
  if (!value) return normalizeScheduleTemplate({});
  try {
    return normalizeScheduleTemplate(JSON.parse(value) as Partial<EmployeeScheduleTemplate>);
  } catch {
    return normalizeScheduleTemplate({});
  }
}

function normalizeScheduleTemplate(value: Partial<EmployeeScheduleTemplate>): EmployeeScheduleTemplate {
  const blocks = Array.isArray(value.fixedShifts) ? value.fixedShifts : [];
  return {
    mode: value.mode && ["fixed", "rotating", "custom"].includes(value.mode) ? value.mode : "fixed",
    label: toText(value.label).slice(0, 120),
    rotation:
      value.rotation && ["none", "diego", "vicky", "mica", "romi"].includes(value.rotation)
        ? value.rotation
        : "none",
    fixedShifts: blocks
      .filter((block) => block.days && block.startTime && block.endTime)
      .slice(0, 16)
      .map((block) => ({
        weeks: toText(block.weeks).slice(0, 80),
        days: toText(block.days).slice(0, 120),
        startTime: block.startTime,
        endTime: block.endTime
      })),
    notes: toText(value.notes).slice(0, 1000)
  };
}

function defaultScheduleTemplateFor(name: string): EmployeeScheduleTemplate {
  const key = normalize(name);
  if (key === "diego") {
    return {
      mode: "fixed",
      label: "Horario fijo Diego",
      rotation: "diego",
      fixedShifts: [
        { days: "Lunes a sabados", startTime: "06:30", endTime: "11:30" },
        { days: "Lunes a sabados", startTime: "16:30", endTime: "20:00" },
        { days: "Domingos", startTime: "06:30", endTime: "11:30" }
      ],
      notes: "Dueño. Horario base del local."
    };
  }
  if (key === "vicky") {
    return {
      mode: "rotating",
      label: "Rotacion Vicky",
      rotation: "vicky",
      fixedShifts: [
        { weeks: "Semanas 1 y 3", days: "Lunes a sabados", startTime: "13:00", endTime: "20:00" },
        { weeks: "Semanas 2 y 4", days: "Martes a sabados", startTime: "13:00", endTime: "20:00" },
        { weeks: "Semanas 2 y 4", days: "Domingos", startTime: "11:30", endTime: "19:30" }
      ],
      notes: "Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."
    };
  }
  if (key === "mica" || key === "micaela") {
    return {
      mode: "rotating",
      label: "Rotacion Mica",
      rotation: "mica",
      fixedShifts: [
        { weeks: "Semanas 1 y 3", days: "Martes a sabados", startTime: "06:30", endTime: "13:30" },
        { weeks: "Semanas 1 y 3", days: "Domingos", startTime: "11:30", endTime: "19:30" },
        { weeks: "Semanas 2 y 4", days: "Lunes a sabados", startTime: "06:30", endTime: "13:30" }
      ],
      notes: "Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."
    };
  }
  if (key === "romi") {
    return {
      mode: "fixed",
      label: "Horario fijo Romi",
      rotation: "romi",
      fixedShifts: [
        { days: "Miercoles a sabados", startTime: "13:00", endTime: "20:00" },
        { days: "Domingos", startTime: "07:30", endTime: "14:30" }
      ],
      notes: "Horario base cargado desde grilla."
    };
  }
  return {
    mode: "fixed",
    label: "",
    rotation: "none",
    fixedShifts: [],
    notes: ""
  };
}

function roleForEmployee(name: string, role: string | null | undefined) {
  if (normalize(name) === "diego") return "Dueño";
  const normalizedRole = toText(role);
  return normalizedRole || null;
}

function defaultEmployeeColor(name: string) {
  const key = normalize(name);
  const colors: Record<string, string> = {
    diego: "#2f66b3",
    vicky: "#c05a9e",
    mica: "#1f9d55",
    micaela: "#1f9d55",
    romi: "#f59e0b",
    franquera: "#64748b"
  };
  return colors[key] ?? "#64748b";
}

function ageFor(birthDate: string | null) {
  if (!birthDate) return null;
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;
  const [todayYear, todayMonthValue, todayDay] = todayArgentina().split("-").map(Number);
  let age = todayYear - birthYear;
  if (todayMonthValue < birthMonth || (todayMonthValue === birthMonth && todayDay < birthDay)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function ageRangeFor(age: number | null) {
  if (age === null) return "Sin fecha";
  if (age < 18) return "Menor de 18";
  if (age <= 24) return "18 a 24";
  if (age <= 34) return "25 a 34";
  if (age <= 44) return "35 a 44";
  if (age <= 54) return "45 a 54";
  return "55+";
}

function computeHours(startTime?: string | null, endTime?: string | null, breakMinutes = 0) {
  if (!startTime || !endTime) return 0;
  const start = minutes(startTime);
  let end = minutes(endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start - breakMinutes) / 60);
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function hourlyCostFor(monthlyNetSalary: number, weeklyHours: number) {
  if (monthlyNetSalary <= 0 || weeklyHours <= 0) return 0;
  return monthlyNetSalary / (weeklyHours * WEEKS_PER_MONTH);
}

function computedSocialCharges(onPayroll: boolean, monthlyNetSalary: number | null | undefined) {
  if (!onPayroll || !monthlyNetSalary || monthlyNetSalary <= 0) return 0;
  return Math.round(monthlyNetSalary * 0.35 * 100) / 100;
}

function computedEmployerCost(monthlyNetSalary: number | null | undefined, socialCharges: number | null | undefined) {
  const net = monthlyNetSalary && monthlyNetSalary > 0 ? monthlyNetSalary : 0;
  return Math.round((net + (socialCharges ?? 0)) * 100) / 100;
}

function readMonth(req: Request) {
  const value = typeof req.query.month === "string" ? req.query.month : "";
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(days).padStart(2, "0")}`
  };
}

function daysBetween(range: { from: string; to: string }) {
  const [year, month] = range.from.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  });
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const cursor = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);
  while (cursor <= end) {
    dates.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(value);
}

function weekdayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function scheduleRotationWeek(date: string) {
  const weeksSinceAnchor = Math.floor((utcDay(date) - utcDay(DEFAULT_SCHEDULE_WEEK_ONE_SUNDAY)) / 7);
  return modulo(weeksSinceAnchor, 4) + 1;
}

function scheduleHolidayMap(range: { from: string; to: string }, manualHolidays: ManualHolidayRow[]) {
  const holidays = new Map<string, ScheduleHoliday>();
  for (const date of daysBetween(range)) {
    const nationalHoliday = argentinaNationalHoliday(date);
    if (nationalHoliday) {
      holidays.set(date, {
        id: null,
        date,
        name: nationalHoliday.name,
        source: "national",
        kind: "holiday",
        hours: 0,
        people: 0,
        estimatedCost: 0,
        shiftCount: 0,
        isSaturday: weekdayNumber(date) === 6,
        closesAt: weekdayNumber(date) === 6 ? "14:00" : null
      });
    }
  }

  for (const holiday of manualHolidays) {
    const existing = holidays.get(holiday.holiday_date);
    if (existing && holiday.kind === "holiday") {
      holidays.set(holiday.holiday_date, {
        ...existing,
        id: holiday.id,
        closesAt: holiday.close_at ?? existing.closesAt
      });
      continue;
    }
    holidays.set(holiday.holiday_date, {
      id: holiday.id,
      date: holiday.holiday_date,
      name: holiday.name,
      source: "manual",
      kind: holiday.kind,
      hours: 0,
      people: 0,
      estimatedCost: 0,
      shiftCount: 0,
      isSaturday: weekdayNumber(holiday.holiday_date) === 6,
      closesAt: holiday.kind === "closure" ? null : holiday.close_at ?? (weekdayNumber(holiday.holiday_date) === 6 ? "14:00" : null)
    });
  }

  return holidays;
}

function scheduleHolidayForDate(date: string, holidays: Map<string, ScheduleHoliday>) {
  return holidays.get(date) ?? null;
}

function scheduleHolidaySummaries(holidays: Map<string, ScheduleHoliday>, shifts: Array<{
  date: string;
  hours: number;
  estimatedCost: number;
  isAbsence: boolean;
  employeeId: string;
}>) {
  return [...holidays.values()]
    .map((holiday) => {
      const holidayShifts = shifts.filter((shift) => shift.date === holiday.date);
      return {
        ...holiday,
        hours: sum(holidayShifts.map((shift) => shift.hours)),
        people: new Set(holidayShifts.filter((shift) => !shift.isAbsence && shift.hours > 0).map((shift) => shift.employeeId)).size,
        estimatedCost: sum(holidayShifts.map((shift) => shift.estimatedCost)),
        shiftCount: holidayShifts.length
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function argentinaNationalHoliday(date: string) {
  const year = date.slice(0, 4);
  return ARGENTINA_NATIONAL_HOLIDAYS[year]?.find((holiday) => holiday.date === date) ?? null;
}

function effectiveShiftTime(row: ShiftRow, holiday: ScheduleHoliday | null) {
  if (holiday?.kind === "closure" && isDefaultScheduleSource(row.source)) return null;
  if (!holiday?.closesAt || !isDefaultScheduleSource(row.source) || row.is_absence || !row.start_time || !row.end_time) {
    return { startTime: row.start_time, endTime: row.end_time };
  }

  const start = minutes(row.start_time);
  const end = minutes(row.end_time);
  const closing = minutes(holiday.closesAt);
  if (start >= closing) return null;

  return {
    startTime: row.start_time,
    endTime: end > closing ? holiday.closesAt : row.end_time
  };
}

function isDefaultScheduleSource(source: string) {
  return source.startsWith("default-schedule");
}

function defaultShiftForDate(date: string, startTime: string, endTime: string) {
  const saturdayHolidayClosesAt = "14:00";
  const isSaturdayHoliday = Boolean(argentinaNationalHoliday(date)) && weekdayNumber(date) === 6;
  if (!isSaturdayHoliday) return { startTime, endTime };

  const start = minutes(startTime);
  const end = minutes(endTime);
  const closing = minutes(saturdayHolidayClosesAt);
  if (start >= closing) return null;

  return {
    startTime,
    endTime: end > closing ? saturdayHolidayClosesAt : endTime
  };
}

function utcDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
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

function formatEmployeeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const cleaned = toText(value)
    .replace(/\$/g, "")
    .replace(/\s/g, "");
  if (!cleaned) return 0;

  const normalized = normalizeNumberText(cleaned);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNumberText(value: string) {
  if (value.includes(",")) {
    return value.replace(/\./g, "").replace(",", ".");
  }

  const dotCount = (value.match(/\./g) ?? []).length;
  if (dotCount > 1) return value.replace(/\./g, "");

  if (dotCount === 1) {
    const [integerPart, decimalPart] = value.split(".");
    if (decimalPart.length === 3 && integerPart.length <= 3) return value.replace(/\./g, "");
  }

  return value;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

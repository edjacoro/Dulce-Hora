import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, type ScheduleResponse, type ScheduleShift } from "../api";
import { downloadSchedulePdf } from "../reportPdf";

type EmployeeForm = {
  id: string;
  name: string;
  role: string;
  weeklyHours: string;
  monthlyNetSalary: string;
  monthlyGrossSalary: string;
  employerCost: string;
  active: boolean;
};

type ShiftForm = {
  id: string;
  employeeId: string;
  date: string;
  dateTo: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  isHoliday: boolean;
  isAbsence: boolean;
  notes: string;
};

type HolidayForm = {
  id: string;
  date: string;
  name: string;
  kind: "holiday" | "closure";
  closeAt: string;
};

const emptyEmployee = (): EmployeeForm => ({
  id: "",
  name: "",
  role: "",
  weeklyHours: "",
  monthlyNetSalary: "",
  monthlyGrossSalary: "",
  employerCost: "",
  active: true
});

const emptyShift = (): ShiftForm => ({
  id: "",
  employeeId: "",
  date: today(),
  dateTo: "",
  startTime: "07:00",
  endTime: "13:30",
  breakMinutes: "0",
  isHoliday: false,
  isAbsence: false,
  notes: ""
});

const emptyHoliday = (month?: string): HolidayForm => ({
  id: "",
  date: month ? `${month}-01` : today(),
  name: "",
  kind: "holiday",
  closeAt: ""
});

export function SchedulePage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() => emptyEmployee());
  const [shiftForm, setShiftForm] = useState<ShiftForm>(() => emptyShift());
  const [holidayForm, setHolidayForm] = useState<HolidayForm>(() => emptyHoliday());

  const schedule = useQuery({
    queryKey: ["schedule", month],
    queryFn: () => api<ScheduleResponse>(`/api/schedule?month=${month}`)
  });

  const importSchedule = useMutation({
    mutationFn: () =>
      api<{ employeesReceived: number; employeesCreated: number; employeesUpdated: number }>("/api/imports/schedule-sheet", {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["schedule"] })
  });

  const saveEmployee = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/schedule/employees", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setEmployeeForm(emptyEmployee());
      await queryClient.invalidateQueries({ queryKey: ["schedule"] });
    }
  });

  const saveShift = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/schedule/shifts", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setShiftForm((current) => ({ ...emptyShift(), employeeId: current.employeeId, date: current.date }));
      await queryClient.invalidateQueries({ queryKey: ["schedule"] });
    }
  });

  const deleteShift = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/schedule/shifts/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["schedule"] })
  });

  const saveHoliday = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/schedule/holidays", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setHolidayForm(emptyHoliday(month));
      await queryClient.invalidateQueries({ queryKey: ["schedule", month] });
    }
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/schedule/holidays/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["schedule", month] })
  });

  const data = schedule.data;
  const activeEmployees = useMemo(() => data?.employees.filter((employee) => employee.active) ?? [], [data?.employees]);
  const selectedEmployee = activeEmployees.find((employee) => employee.id === shiftForm.employeeId);
  const todayDate = useMemo(() => today(), []);

  return (
    <section className="page-section schedule-page">
      <div className="page-heading">
        <div>
          <h1>Grilla horaria</h1>
          <p>Turnos, suplencias, feriados, inasistencias y costo laboral estimado</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" disabled={importSchedule.isPending} onClick={() => importSchedule.mutate()} type="button">
            <FileSpreadsheet size={17} aria-hidden="true" />
            {importSchedule.isPending ? "Importando..." : "Importar grilla"}
          </button>
          <button
            className="secondary-button"
            disabled={!data}
            onClick={() => {
              if (data) void downloadSchedulePdf(data, monthName(month));
            }}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            PDF mensual
          </button>
          <MonthControls month={month} onMonth={setMonth} />
        </div>
      </div>

      {importSchedule.data ? (
        <div className="sync-result">
          <strong>{importSchedule.data.employeesReceived} personas leidas</strong>
          <span>{importSchedule.data.employeesCreated} nuevas</span>
          <span>{importSchedule.data.employeesUpdated} actualizadas</span>
        </div>
      ) : null}
      {importSchedule.error ? <p className="form-error">{importSchedule.error.message}</p> : null}

      <div className="kpi-grid">
        <Kpi icon={Users} label="Personas activas" value={data?.summary.employees ?? 0} tone="blue" />
        <Kpi icon={CalendarDays} label="Turnos" value={data?.summary.shifts ?? 0} tone="green" />
        <Kpi icon={Clock3} label="Horas del mes" value={formatNumber(data?.summary.hours ?? 0)} tone="slate" />
        <Kpi icon={Clock3} label="Horas feriado" value={formatNumber(data?.summary.holidayHours ?? 0)} tone="amber" />
        <Kpi icon={BadgeDollarSign} label="Costo estimado" value={formatCurrency(data?.summary.estimatedCost ?? 0)} tone="red" />
        <Kpi icon={Trash2} label="Inasistencias" value={data?.summary.absences ?? 0} tone="amber" />
      </div>

      <ScheduleCalendar data={data} month={month} todayDate={todayDate} />

      <div className="split-layout schedule-edit-layout">
        <section className="content-band compact-band">
          <h2>
            <UserPlus size={18} aria-hidden="true" />
            Persona
          </h2>
          <form
            className="form-grid dense-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveEmployee.mutate({
                id: employeeForm.id || null,
                name: employeeForm.name,
                role: employeeForm.role,
                weeklyHours: Number(employeeForm.weeklyHours || 0),
                monthlyNetSalary: Number(employeeForm.monthlyNetSalary || 0),
                monthlyGrossSalary: employeeForm.monthlyGrossSalary ? Number(employeeForm.monthlyGrossSalary) : null,
                employerCost: employeeForm.employerCost ? Number(employeeForm.employerCost) : null,
                active: employeeForm.active
              });
            }}
          >
            <label className="full">
              Nombre
              <input value={employeeForm.name} onChange={(event) => updateEmployee(setEmployeeForm, "name", event.target.value)} required />
            </label>
            <label>
              Horas semanales
              <input value={employeeForm.weeklyHours} onChange={(event) => updateEmployee(setEmployeeForm, "weeklyHours", event.target.value)} />
            </label>
            <label>
              Sueldo neto
              <input
                value={employeeForm.monthlyNetSalary}
                onChange={(event) => updateEmployee(setEmployeeForm, "monthlyNetSalary", event.target.value)}
              />
            </label>
            <label>
              Cargas sociales
              <input
                value={employeeForm.monthlyGrossSalary}
                onChange={(event) => updateEmployee(setEmployeeForm, "monthlyGrossSalary", event.target.value)}
              />
            </label>
            <label>
              Costo real empleado
              <input value={employeeForm.employerCost} onChange={(event) => updateEmployee(setEmployeeForm, "employerCost", event.target.value)} />
            </label>
            <label className="full checkbox-label">
              <input
                checked={employeeForm.active}
                onChange={(event) => updateEmployee(setEmployeeForm, "active", event.target.checked)}
                type="checkbox"
              />
              Activa
            </label>
            {saveEmployee.error ? <p className="form-error">{saveEmployee.error.message}</p> : null}
            <button className="primary-button full" disabled={saveEmployee.isPending} type="submit">
              <Plus size={17} aria-hidden="true" />
              {employeeForm.id ? "Actualizar persona" : "Guardar persona"}
            </button>
          </form>
        </section>

        <section className="content-band compact-band">
          <h2>
            <CalendarDays size={18} aria-hidden="true" />
            Turno, suplencia o ausencia
          </h2>
          <form
            className="form-grid dense-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveShift.mutate({
                id: shiftForm.id || null,
                employeeId: shiftForm.employeeId,
                date: shiftForm.date,
                dateTo: shiftForm.dateTo || null,
                startTime: shiftForm.isAbsence ? null : shiftForm.startTime,
                endTime: shiftForm.isAbsence ? null : shiftForm.endTime,
                breakMinutes: Number(shiftForm.breakMinutes || 0),
                isHoliday: shiftForm.isHoliday,
                isAbsence: shiftForm.isAbsence,
                notes: shiftForm.notes
              });
            }}
          >
            <label className="full">
              Persona
              <select value={shiftForm.employeeId} onChange={(event) => updateShift(setShiftForm, "employeeId", event.target.value)} required>
                <option value="">Seleccionar</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input value={shiftForm.date} onChange={(event) => updateShift(setShiftForm, "date", event.target.value)} type="date" />
            </label>
            <label>
              Hasta
              <input
                value={shiftForm.dateTo}
                disabled={!shiftForm.isAbsence}
                onChange={(event) => updateShift(setShiftForm, "dateTo", event.target.value)}
                type="date"
              />
            </label>
            <label>
              Entrada
              <input
                value={shiftForm.startTime}
                disabled={shiftForm.isAbsence}
                onChange={(event) => updateShift(setShiftForm, "startTime", event.target.value)}
                type="time"
              />
            </label>
            <label>
              Salida
              <input
                value={shiftForm.endTime}
                disabled={shiftForm.isAbsence}
                onChange={(event) => updateShift(setShiftForm, "endTime", event.target.value)}
                type="time"
              />
            </label>
            <label>
              Descanso min.
              <input value={shiftForm.breakMinutes} onChange={(event) => updateShift(setShiftForm, "breakMinutes", event.target.value)} />
            </label>
            <label className="checkbox-label">
              <input checked={shiftForm.isHoliday} onChange={(event) => updateShift(setShiftForm, "isHoliday", event.target.checked)} type="checkbox" />
              Feriado
            </label>
            <label className="checkbox-label">
              <input checked={shiftForm.isAbsence} onChange={(event) => updateShift(setShiftForm, "isAbsence", event.target.checked)} type="checkbox" />
              Ausencia / vacaciones
            </label>
            <label className="full">
              Nota
              <textarea value={shiftForm.notes} onChange={(event) => updateShift(setShiftForm, "notes", event.target.value)} rows={2} />
            </label>
            <div className="full shift-preview">
              <strong>{selectedEmployee ? formatCurrency(selectedEmployee.hourlyCost) : "-"} / hora</strong>
              <span>{shiftForm.isHoliday ? "Feriado se estima al doble" : "Costo normal estimado"}</span>
            </div>
            {saveShift.error ? <p className="form-error">{saveShift.error.message}</p> : null}
            <button className="primary-button full" disabled={saveShift.isPending} type="submit">
              <Plus size={17} aria-hidden="true" />
              {shiftForm.id ? "Actualizar turno" : "Guardar turno"}
            </button>
          </form>
        </section>
      </div>

      <div className="split-layout">
        <section className="content-band compact-band">
          <h2>
            <Users size={18} aria-hidden="true" />
            Costo por persona
          </h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Horas</th>
                  <th>Feriado</th>
                  <th>Aus.</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {(data?.employeeSummary ?? []).map((row) => (
                  <tr key={row.employeeId}>
                    <td>{row.employeeName}</td>
                    <td>{formatNumber(row.hours)}</td>
                    <td>{formatNumber(row.holidayHours)}</td>
                    <td>{row.absences}</td>
                    <td>{formatCurrency(row.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HolidayControlPanel
            holidays={data?.holidays ?? []}
            form={holidayForm}
            saving={saveHoliday.isPending}
            deleting={deleteHoliday.isPending}
            error={saveHoliday.error?.message ?? deleteHoliday.error?.message ?? null}
            onForm={setHolidayForm}
            onSave={() => {
              if (!holidayForm.date || !holidayForm.name.trim()) return;
              saveHoliday.mutate({
                id: holidayForm.id || null,
                date: holidayForm.date,
                name: holidayForm.name,
                kind: holidayForm.kind,
                closeAt: holidayForm.closeAt || null
              });
            }}
            onDelete={(id) => deleteHoliday.mutate(id)}
            onReset={() => setHolidayForm(emptyHoliday(month))}
          />
        </section>

        <section className="content-band compact-band">
          <h2>
            <CalendarDays size={18} aria-hidden="true" />
            Costo por dia
          </h2>
          <BarList
            rows={(data?.dailySummary ?? [])
              .filter((row) => row.hours > 0 || row.absences > 0)
              .map((row) => ({
                label: shortDate(row.date),
                total: String(row.estimatedCost),
                detail: `${formatNumber(row.hours)} hs - ${row.people} personas`
              }))}
          />
        </section>
      </div>

      <section className="content-band">
        <div className="table-heading">
          <h2>Turnos del mes</h2>
          <span className="period-chip">{monthName(month)}</span>
        </div>
        {schedule.isLoading ? <p className="muted-text">Cargando grilla...</p> : null}
        {schedule.error ? <p className="form-error">{schedule.error.message}</p> : null}
        {(data?.shifts ?? []).length === 0 ? (
          <div className="dashed-empty">Sin turnos cargados para este mes.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Persona</th>
                  <th>Horario</th>
                  <th>Horas</th>
                  <th>Costo</th>
                  <th>Marca</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.shifts ?? []).map((shift) => (
                  <tr key={shift.id}>
                    <td>
                      <strong>{shortDate(shift.date)}</strong>
                      <span className="cell-muted">{shift.weekday}</span>
                    </td>
                    <td>{shift.employeeName}</td>
                    <td>{shift.isAbsence ? "Inasistencia" : `${shift.startTime ?? "--"} a ${shift.endTime ?? "--"}`}</td>
                    <td>{formatNumber(shift.hours)}</td>
                    <td>{formatCurrency(shift.estimatedCost)}</td>
                    <td>
                      {shift.isHoliday ? <span className="signal-pill amber">Feriado nacional</span> : null}
                      {shift.holidayName ? <span className="cell-muted">{shift.holidayName}</span> : null}
                      {shift.isAbsence ? <span className="signal-pill red">Ausente</span> : null}
                      {!shift.isHoliday && !shift.isAbsence ? <span className="signal-pill slate">Normal</span> : null}
                    </td>
                    <td>
                      <button
                        className="icon-only-button"
                        disabled={deleteShift.isPending}
                        onClick={() => deleteShift.mutate(shift.id)}
                        type="button"
                        aria-label="Eliminar turno"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function ScheduleCalendar({
  data,
  month,
  todayDate
}: {
  data: ScheduleResponse | undefined;
  month: string;
  todayDate: string;
}) {
  const cells = useMemo(() => calendarCells(month), [month]);
  const shiftsByDate = useMemo(() => {
    const byDate = new Map<string, ScheduleShift[]>();
    for (const shift of data?.shifts ?? []) {
      const current = byDate.get(shift.date) ?? [];
      current.push(shift);
      byDate.set(
        shift.date,
        current.sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99") || left.employeeName.localeCompare(right.employeeName))
      );
    }
    return byDate;
  }, [data?.shifts]);
  const summaryByDate = useMemo(() => {
    return new Map((data?.dailySummary ?? []).map((summary) => [summary.date, summary]));
  }, [data?.dailySummary]);
  const holidayByDate = useMemo(() => {
    return new Map((data?.holidays ?? []).map((holiday) => [holiday.date, holiday]));
  }, [data?.holidays]);

  return (
    <section className="content-band schedule-calendar-band">
      <div className="table-heading">
        <h2>
          <CalendarDays size={18} aria-hidden="true" />
          Vista mensual
        </h2>
        <span className="period-chip">{monthName(month)}</span>
      </div>
      <div className="schedule-calendar">
        {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((weekday) => (
          <span className="schedule-weekday" key={weekday}>
            {weekday}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div className="schedule-day-cell placeholder" key={`empty-${index}`} />;
          const shifts = shiftsByDate.get(date) ?? [];
          const summary = summaryByDate.get(date);
          const holiday = holidayByDate.get(date);
          const isToday = date === todayDate;
          return (
            <article
              className={`schedule-day-cell ${isToday ? "is-today" : ""} ${shifts.length === 0 ? "is-quiet" : ""} ${
                holiday ? "is-holiday-day" : ""
              } ${holiday?.kind === "closure" ? "is-closed-day" : ""}`}
              key={date}
            >
              <div className="schedule-day-head">
                <strong>{Number(date.slice(8, 10))}</strong>
                {isToday ? <span>Hoy</span> : null}
              </div>
              {holiday ? (
                <small className="schedule-day-holiday">{holiday.kind === "closure" ? "Cierre" : holiday.name}</small>
              ) : null}
              <div className="schedule-day-meta">
                <span>{formatNumber(summary?.hours ?? 0)} hs</span>
                <span>{summary?.people ?? 0} pers.</span>
              </div>
              <div className="schedule-shift-list">
                {shifts.slice(0, 5).map((shift) => (
                  <span
                    className="schedule-shift-pill"
                    key={shift.id}
                    style={{
                      backgroundColor: shift.employeeColor,
                      color: textColorFor(shift.employeeColor)
                    }}
                  >
                    <b>{shift.employeeName}</b>
                    {shift.isAbsence ? "Ausente" : `${shift.startTime ?? "--"}-${shift.endTime ?? "--"}`}
                    {shift.holidayName ? <small>Feriado</small> : null}
                  </span>
                ))}
                {shifts.length > 5 ? <span className="schedule-more">+{shifts.length - 5} mas</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HolidayControlPanel({
  holidays,
  form,
  saving,
  deleting,
  error,
  onForm,
  onSave,
  onDelete,
  onReset
}: {
  holidays: ScheduleResponse["holidays"];
  form: HolidayForm;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onForm: React.Dispatch<React.SetStateAction<HolidayForm>>;
  onSave: () => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}) {
  const visibleHolidays = holidays.filter((holiday) => holiday.shiftCount > 0 || holiday.source === "manual");

  return (
    <div className="schedule-holiday-panel">
      <div className="table-heading compact-heading">
        <h3>Feriados contemplados</h3>
        <span className="period-chip">{visibleHolidays.length}</span>
      </div>
      <form
        className="holiday-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <input value={form.date} onChange={(event) => updateHoliday(onForm, "date", event.target.value)} type="date" />
        <select value={form.kind} onChange={(event) => updateHoliday(onForm, "kind", event.target.value as HolidayForm["kind"])}>
          <option value="holiday">Feriado</option>
          <option value="closure">Cierre</option>
        </select>
        <input
          value={form.name}
          onChange={(event) => updateHoliday(onForm, "name", event.target.value)}
          placeholder={form.kind === "closure" ? "Motivo del cierre" : "Feriado extra o ajuste"}
        />
        <input
          value={form.closeAt}
          disabled={form.kind === "closure"}
          onChange={(event) => updateHoliday(onForm, "closeAt", event.target.value)}
          type="time"
          title="Cierre horario"
        />
        <button className="secondary-button compact" disabled={saving} type="submit">
          <Plus size={16} aria-hidden="true" />
          {form.id ? "Actualizar" : "Sumar"}
        </button>
        {form.id ? (
          <button className="secondary-button compact" onClick={onReset} type="button">
            Limpiar
          </button>
        ) : null}
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      {visibleHolidays.length === 0 ? (
        <div className="dashed-empty">Sin feriados con horario activo en este mes.</div>
      ) : (
        <div className="holiday-list">
          {visibleHolidays.map((holiday) => (
            <div className="holiday-row" key={`${holiday.source}-${holiday.date}`}>
              <div>
                <strong>{shortDate(holiday.date)}</strong>
                <span>{holiday.name}</span>
                {holiday.kind === "closure" ? <small>Cierre: anula la grilla automatica</small> : null}
                {holiday.closesAt ? <small>Cierre horario {holiday.closesAt}</small> : null}
              </div>
              <div className="holiday-row-metrics">
                <span>{formatNumber(holiday.hours)} hs</span>
                <span>{holiday.people} pers.</span>
                <strong>{formatCurrency(holiday.estimatedCost)}</strong>
              </div>
              <span className={`signal-pill ${holiday.kind === "closure" ? "red" : holiday.source === "national" ? "amber" : "blue"}`}>
                {holiday.kind === "closure" ? "Cierre" : holiday.source === "national" ? "Oficial" : "Manual"}
              </span>
              {holiday.id ? (
                <div className="row-actions">
                  <button
                    className="icon-only-button"
                    onClick={() =>
                      onForm({
                        id: holiday.id ?? "",
                        date: holiday.date,
                        name: holiday.name,
                        kind: holiday.kind,
                        closeAt: holiday.closesAt ?? ""
                      })
                    }
                    type="button"
                    aria-label="Editar feriado"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-only-button"
                    disabled={deleting}
                    onClick={() => onDelete(holiday.id!)}
                    type="button"
                    aria-label="Eliminar feriado"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthControls({ month, onMonth }: { month: string; onMonth: (value: string) => void }) {
  return (
    <div className="day-nav month-only-nav">
      <button className="nav-button" onClick={() => onMonth(shiftMonth(month, -1))} type="button">
        <ArrowLeft size={17} aria-hidden="true" />
      </button>
      <div className="date-display">
        <strong>{monthName(month)}</strong>
        <input type="month" value={month} onChange={(event) => onMonth(event.target.value)} />
      </div>
      <button className="nav-button" onClick={() => onMonth(shiftMonth(month, 1))} type="button">
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "red" | "blue" | "green" | "amber" | "slate";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; total: string; detail: string }> }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total)));
  if (rows.length === 0) return <div className="dashed-empty">Sin turnos para graficar.</div>;
  return (
    <div className="bar-list">
      {rows.slice(0, 12).map((row) => {
        const value = Number(row.total);
        return (
          <div className="bar-row" key={row.label}>
            <span>
              {row.label}
              <small>{row.detail}</small>
            </span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <strong>{formatCurrency(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function updateEmployee<T extends keyof EmployeeForm>(
  setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>,
  key: T,
  value: EmployeeForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateShift<T extends keyof ShiftForm>(
  setForm: React.Dispatch<React.SetStateAction<ShiftForm>>,
  key: T,
  value: ShiftForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateHoliday<T extends keyof HolidayForm>(
  setForm: React.Dispatch<React.SetStateAction<HolidayForm>>,
  key: T,
  value: HolidayForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDate = new Date(year, monthNumber - 1, 1);
  const days = new Date(year, monthNumber, 0).getDate();
  const leadingEmptyCells = firstDate.getDay();
  const cells: Array<string | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= days; day += 1) {
    cells.push(`${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date).replace(".", "");
  return `${weekday} ${day}/${month}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value);
}

function textColorFor(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#fff";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.68 ? "#12212d" : "#fff";
}

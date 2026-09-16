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
import { api, type ScheduleChangesResponse, type ScheduleChangeValue, type ScheduleResponse, type ScheduleShift } from "../api";
import { ShiftEditorModal, type ShiftEditorValue } from "../components/ShiftEditorModal";
import { EmployeeFilters, ScheduleWeekView } from "../components/ScheduleWeekView";
import { downloadSchedulePdf, downloadScheduleWeekPdf } from "../reportPdf";

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

type ShiftForm = ShiftEditorValue;

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
  startTime: "",
  endTime: "",
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
  const [activeView, setActiveView] = useState<"month" | "week" | "changes">("month");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(today()));
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() => emptyEmployee());
  const [shiftForm, setShiftForm] = useState<ShiftForm>(() => emptyShift());
  const [holidayForm, setHolidayForm] = useState<HolidayForm>(() => emptyHoliday());

  const schedule = useQuery({
    queryKey: ["schedule", month],
    queryFn: () => api<ScheduleResponse>(`/api/schedule?month=${month}`)
  });
  const weekDates = useMemo(() => datesForWeek(weekAnchor), [weekAnchor]);
  const weekPrimaryMonth = weekDates[0].slice(0, 7);
  const weekSecondaryMonth = weekDates[weekDates.length - 1].slice(0, 7);
  const weekPrimarySchedule = useQuery({
    queryKey: ["schedule", weekPrimaryMonth],
    queryFn: () => api<ScheduleResponse>(`/api/schedule?month=${weekPrimaryMonth}`),
    enabled: activeView === "week"
  });
  const weekSecondarySchedule = useQuery({
    queryKey: ["schedule", weekSecondaryMonth],
    queryFn: () => api<ScheduleResponse>(`/api/schedule?month=${weekSecondaryMonth}`),
    enabled: activeView === "week" && weekSecondaryMonth !== weekPrimaryMonth
  });
  const changes = useQuery({
    queryKey: ["schedule-changes", month],
    queryFn: () => api<ScheduleChangesResponse>(`/api/schedule/changes?month=${month}`),
    enabled: activeView === "changes"
  });
  const weekData = useMemo(
    () => mergeScheduleData(weekPrimarySchedule.data, weekSecondaryMonth === weekPrimaryMonth ? undefined : weekSecondarySchedule.data),
    [weekPrimarySchedule.data, weekSecondaryMonth, weekPrimaryMonth, weekSecondarySchedule.data]
  );

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
      setEditorOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule-changes"] })
      ]);
    }
  });

  const deleteShift = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/schedule/shifts/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setEditorOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule-changes"] })
      ]);
    }
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
  const monthFilterEmployees = useMemo(
    () => (data?.employees ?? []).filter((employee) => employee.active || data?.shifts.some((shift) => shift.employeeId === employee.id)),
    [data?.employees, data?.shifts]
  );
  const weekFilterEmployees = useMemo(
    () => (weekData?.employees ?? activeEmployees).filter(
      (employee) => employee.active || weekData?.shifts.some((shift) => shift.employeeId === employee.id)
    ),
    [activeEmployees, weekData?.employees, weekData?.shifts]
  );
  const editorEmployees = useMemo(
    () => (activeView === "week" ? weekFilterEmployees : activeEmployees).filter((employee) => employee.active),
    [activeEmployees, activeView, weekFilterEmployees]
  );
  const monthEmployeeIds = useMemo(() => monthFilterEmployees.map((employee) => employee.id), [monthFilterEmployees]);
  const weekEmployeeIds = useMemo(() => weekFilterEmployees.map((employee) => employee.id), [weekFilterEmployees]);
  const visibleMonthEmployeeIds = useMemo(
    () => monthEmployeeIds.filter((id) => !hiddenEmployeeIds.includes(id)),
    [hiddenEmployeeIds, monthEmployeeIds]
  );
  const visibleWeekEmployeeIds = useMemo(
    () => weekEmployeeIds.filter((id) => !hiddenEmployeeIds.includes(id)),
    [hiddenEmployeeIds, weekEmployeeIds]
  );
  const visibleMonthData = useMemo(
    () => filterScheduleDataByEmployees(data, visibleMonthEmployeeIds),
    [data, visibleMonthEmployeeIds]
  );
  const todayDate = useMemo(() => today(), []);

  const updateVisibleEmployees = (scopeIds: string[], visibleIds: string[]) => {
    setHiddenEmployeeIds((current) => [
      ...current.filter((id) => !scopeIds.includes(id)),
      ...scopeIds.filter((id) => !visibleIds.includes(id))
    ]);
  };

  const openNewShift = (date?: string) => {
    setShiftForm({ ...emptyShift(), date: date ?? (weekDates.includes(todayDate) ? todayDate : weekDates[0]) });
    setEditorOpen(true);
  };

  const openShift = (shift: ScheduleShift) => {
    if (!isEditableMonth(shift.date)) return;
    setShiftForm({
      id: shift.id,
      employeeId: shift.employeeId,
      date: shift.date,
      dateTo: "",
      startTime: shift.startTime ?? "",
      endTime: shift.endTime ?? "",
      breakMinutes: String(shift.breakMinutes),
      isHoliday: shift.isHoliday,
      isAbsence: shift.isAbsence,
      notes: shift.notes ?? ""
    });
    setEditorOpen(true);
  };

  const submitShift = () => {
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
  };

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
          {activeView === "month" ? (
            <button
              className="secondary-button"
              disabled={!visibleMonthData}
              onClick={() => {
                if (visibleMonthData) void downloadSchedulePdf(visibleMonthData, monthName(month));
              }}
              type="button"
            >
              <Download size={17} aria-hidden="true" />
              PDF mensual
            </button>
          ) : null}
          {activeView !== "week" ? <MonthControls month={month} onMonth={setMonth} /> : null}
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

      <div className="schedule-view-tabs" role="tablist" aria-label="Vistas de grilla">
        <button className={activeView === "month" ? "active" : ""} onClick={() => setActiveView("month")} role="tab" type="button">
          Vista mensual
        </button>
        <button className={activeView === "week" ? "active" : ""} onClick={() => setActiveView("week")} role="tab" type="button">
          Grilla semanal
        </button>
        <button className={activeView === "changes" ? "active" : ""} onClick={() => setActiveView("changes")} role="tab" type="button">
          Cambios aprobados
        </button>
      </div>

      {activeView === "month" ? (
        <>
      <section className="content-band schedule-month-filters">
        <div className="table-heading">
          <div>
            <h2>Empleados visibles</h2>
            <p className="muted-text">La pantalla y el PDF incluyen solamente los empleados encendidos.</p>
          </div>
        </div>
        <EmployeeFilters
          employees={monthFilterEmployees}
          visibleEmployeeIds={visibleMonthEmployeeIds}
          onVisibleEmployeeIds={(ids) => updateVisibleEmployees(monthEmployeeIds, ids)}
        />
      </section>
      <div className="kpi-grid">
        <Kpi icon={Users} label="Personas activas" value={visibleMonthData?.summary.employees ?? 0} tone="blue" />
        <Kpi icon={CalendarDays} label="Turnos" value={visibleMonthData?.summary.shifts ?? 0} tone="green" />
        <Kpi icon={Clock3} label="Horas del mes" value={formatNumber(visibleMonthData?.summary.hours ?? 0)} tone="slate" />
        <Kpi icon={Clock3} label="Horas feriado" value={formatNumber(visibleMonthData?.summary.holidayHours ?? 0)} tone="amber" />
        <Kpi icon={BadgeDollarSign} label="Costo estimado" value={formatCurrency(visibleMonthData?.summary.estimatedCost ?? 0)} tone="red" />
        <Kpi icon={Trash2} label="Inasistencias" value={visibleMonthData?.summary.absences ?? 0} tone="amber" />
      </div>

      <ScheduleCalendar data={visibleMonthData} month={month} todayDate={todayDate} onAdd={openNewShift} onEdit={openShift} />

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
                {(visibleMonthData?.employeeSummary ?? []).map((row) => (
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
            rows={(visibleMonthData?.dailySummary ?? [])
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
        {(visibleMonthData?.shifts ?? []).length === 0 ? (
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
                {(visibleMonthData?.shifts ?? []).map((shift) => (
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
                      <div className="row-actions">
                        <button
                          className="icon-only-button"
                          disabled={!isEditableMonth(shift.date)}
                          onClick={() => openShift(shift)}
                          type="button"
                          aria-label="Editar turno"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-only-button"
                          disabled={deleteShift.isPending || !isEditableMonth(shift.date)}
                          onClick={() => {
                            if (window.confirm("¿Eliminar este turno? El cambio quedará registrado.")) deleteShift.mutate(shift.id);
                          }}
                          type="button"
                          aria-label="Eliminar turno"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      ) : null}

      {activeView === "week" ? (
        <ScheduleWeekView
          data={weekData}
          dates={weekDates}
          employees={weekFilterEmployees}
          visibleEmployeeIds={visibleWeekEmployeeIds}
          loading={weekPrimarySchedule.isLoading || (weekSecondaryMonth !== weekPrimaryMonth && weekSecondarySchedule.isLoading)}
          onVisibleEmployeeIds={(ids) => updateVisibleEmployees(weekEmployeeIds, ids)}
          onPreviousWeek={() => setWeekAnchor(shiftDate(weekAnchor, -7))}
          onNextWeek={() => setWeekAnchor(shiftDate(weekAnchor, 7))}
          onWeekDate={(date) => setWeekAnchor(startOfWeek(date))}
          onAdd={openNewShift}
          onEdit={openShift}
          onPdf={() => {
            if (weekData) void downloadScheduleWeekPdf(weekData, weekDates, visibleWeekEmployeeIds);
          }}
        />
      ) : null}

      {activeView === "changes" ? (
        <ScheduleChangesPanel response={changes.data} loading={changes.isLoading} error={changes.error?.message ?? null} />
      ) : null}

      <ShiftEditorModal
        open={editorOpen}
        value={shiftForm}
        employees={editorEmployees}
        saving={saveShift.isPending}
        deleting={deleteShift.isPending}
        error={saveShift.error?.message ?? deleteShift.error?.message ?? null}
        onChange={setShiftForm}
        onClose={() => setEditorOpen(false)}
        onSave={submitShift}
        onDuplicate={() => setShiftForm((current) => ({ ...current, id: "" }))}
        onDelete={() => {
          if (shiftForm.id) deleteShift.mutate(shiftForm.id);
        }}
      />
    </section>
  );
}

function ScheduleCalendar({
  data,
  month,
  todayDate,
  onAdd,
  onEdit
}: {
  data: ScheduleResponse | undefined;
  month: string;
  todayDate: string;
  onAdd: (date: string) => void;
  onEdit: (shift: ScheduleShift) => void;
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
                <div>
                  {isToday ? <span>Hoy</span> : null}
                  <button
                    className="schedule-day-add"
                    disabled={!isEditableMonth(date)}
                    onClick={() => onAdd(date)}
                    type="button"
                    aria-label={`Agregar turno el ${shortDate(date)}`}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
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
                  <button
                    className="schedule-shift-pill"
                    disabled={!isEditableMonth(shift.date)}
                    key={shift.id}
                    onClick={() => onEdit(shift)}
                    style={{
                      backgroundColor: shift.employeeColor,
                      color: textColorFor(shift.employeeColor)
                    }}
                    type="button"
                  >
                    <b>{shift.employeeName}</b>
                    {shift.isAbsence ? "Ausente" : `${shift.startTime ?? "--"}-${shift.endTime ?? "--"}`}
                    {shift.holidayName ? <small>Feriado</small> : null}
                  </button>
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

function ScheduleChangesPanel({
  response,
  loading,
  error
}: {
  response: ScheduleChangesResponse | undefined;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="content-band schedule-changes-panel">
      <div className="table-heading">
        <div>
          <h2>Cambios aprobados</h2>
          <p className="muted-text">{response ? monthName(response.month) : ""}</p>
        </div>
        <span className="signal-pill green">Aprobación inmediata</span>
      </div>
      {loading ? <p className="muted-text">Cargando cambios...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && (response?.changes.length ?? 0) === 0 ? <div className="dashed-empty">Sin cambios registrados en este mes.</div> : null}
      {(response?.changes.length ?? 0) > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table schedule-changes-table">
            <thead>
              <tr>
                <th>Operación</th>
                <th>Empleado</th>
                <th>Fecha</th>
                <th>Horario anterior</th>
                <th>Horario nuevo</th>
                <th>Modificación</th>
                <th>Usuario</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {response?.changes.map((change) => {
                const current = change.next?.employeeName ? change.next : change.previous;
                return (
                  <tr key={change.id}>
                    <td><strong>{operationLabel(change.operation)}</strong></td>
                    <td>{current?.employeeName ?? "-"}</td>
                    <td>{current?.date ? shortDate(current.date) : "-"}</td>
                    <td>{scheduleValueLabel(change.previous)}</td>
                    <td>{scheduleValueLabel(change.next)}</td>
                    <td>{formatDateTime(change.changedAt)}</td>
                    <td>{change.changedBy}</td>
                    <td><span className="signal-pill green">Aprobado</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
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

function shiftDate(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return shiftDate(value, -date.getDay());
}

function datesForWeek(start: string) {
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

function isEditableMonth(value: string) {
  return value.slice(0, 7) >= today().slice(0, 7);
}

function mergeScheduleData(primary: ScheduleResponse | undefined, secondary: ScheduleResponse | undefined) {
  if (!primary) return secondary;
  if (!secondary || secondary.month === primary.month) return primary;
  const dedupe = <T,>(rows: T[], key: (row: T) => string) => [...new Map(rows.map((row) => [key(row), row])).values()];
  const employees = dedupe([...primary.employees, ...secondary.employees], (row) => row.id);
  const shifts = dedupe([...primary.shifts, ...secondary.shifts], (row) => row.id);
  const employeeSummary = employees.map((employee) => {
    const employeeShifts = shifts.filter((shift) => shift.employeeId === employee.id);
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      hours: employeeShifts.reduce((sum, shift) => sum + shift.hours, 0),
      holidayHours: employeeShifts.filter((shift) => shift.isHoliday).reduce((sum, shift) => sum + shift.hours, 0),
      absences: employeeShifts.filter((shift) => shift.isAbsence).length,
      shifts: employeeShifts.length,
      hourlyCost: employee.hourlyCost,
      estimatedCost: employeeShifts.reduce((sum, shift) => sum + shift.estimatedCost, 0)
    };
  });
  const dailySummary = dedupe([...primary.dailySummary, ...secondary.dailySummary], (row) => row.date);
  return {
    ...primary,
    range: { from: primary.range.from, to: secondary.range.to },
    employees,
    shifts,
    employeeSummary,
    dailySummary,
    holidays: dedupe([...primary.holidays, ...secondary.holidays], (row) => `${row.source}:${row.date}`),
    businessHours: dedupe([...primary.businessHours, ...secondary.businessHours], (row) => row.date),
    summary: {
      employees: employees.filter((employee) => employee.active).length,
      shifts: shifts.length,
      hours: shifts.reduce((sum, shift) => sum + shift.hours, 0),
      holidayHours: shifts.filter((shift) => shift.isHoliday).reduce((sum, shift) => sum + shift.hours, 0),
      absences: shifts.filter((shift) => shift.isAbsence).length,
      estimatedCost: shifts.reduce((sum, shift) => sum + shift.estimatedCost, 0)
    }
  } satisfies ScheduleResponse;
}

function filterScheduleDataByEmployees(data: ScheduleResponse | undefined, employeeIds: string[]) {
  if (!data) return undefined;
  const visible = new Set(employeeIds);
  const employees = data.employees.filter((employee) => visible.has(employee.id));
  const shifts = data.shifts.filter((shift) => visible.has(shift.employeeId));
  const employeeSummary = data.employeeSummary.filter((row) => visible.has(row.employeeId));
  const dailySummary = data.dailySummary.map((row) => {
    const dayShifts = shifts.filter((shift) => shift.date === row.date);
    return {
      ...row,
      hours: dayShifts.reduce((sum, shift) => sum + shift.hours, 0),
      estimatedCost: dayShifts.reduce((sum, shift) => sum + shift.estimatedCost, 0),
      people: new Set(dayShifts.filter((shift) => !shift.isAbsence).map((shift) => shift.employeeId)).size,
      holidays: dayShifts.filter((shift) => shift.isHoliday).length,
      absences: dayShifts.filter((shift) => shift.isAbsence).length
    };
  });
  const holidays = data.holidays.map((holiday) => {
    const holidayShifts = shifts.filter((shift) => shift.date === holiday.date);
    return {
      ...holiday,
      hours: holidayShifts.reduce((sum, shift) => sum + shift.hours, 0),
      people: new Set(holidayShifts.filter((shift) => !shift.isAbsence).map((shift) => shift.employeeId)).size,
      estimatedCost: holidayShifts.reduce((sum, shift) => sum + shift.estimatedCost, 0),
      shiftCount: holidayShifts.length
    };
  });

  return {
    ...data,
    employees,
    shifts,
    employeeSummary,
    dailySummary,
    holidays,
    summary: {
      employees: employees.filter((employee) => employee.active).length,
      shifts: shifts.length,
      hours: shifts.reduce((sum, shift) => sum + shift.hours, 0),
      holidayHours: shifts.filter((shift) => shift.isHoliday).reduce((sum, shift) => sum + shift.hours, 0),
      absences: shifts.filter((shift) => shift.isAbsence).length,
      estimatedCost: shifts.reduce((sum, shift) => sum + shift.estimatedCost, 0)
    }
  } satisfies ScheduleResponse;
}

function operationLabel(operation: ScheduleChangesResponse["changes"][number]["operation"]) {
  if (operation === "created") return "Alta";
  if (operation === "reassigned") return "Reasignación";
  if (operation === "deleted") return "Eliminación";
  return "Edición";
}

function scheduleValueLabel(value: ScheduleChangeValue | null) {
  if (!value) return "-";
  if (value.isAbsence) return "Ausencia";
  if (!value.startTime || !value.endTime) return "-";
  return `${value.startTime} a ${value.endTime}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
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

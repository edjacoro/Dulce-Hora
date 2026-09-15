import { ArrowLeft, ArrowRight, CalendarPlus, Download } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import type { ScheduleResponse, ScheduleShift } from "../api";

type Props = {
  data: ScheduleResponse | undefined;
  dates: string[];
  employees: ScheduleResponse["employees"];
  visibleEmployeeIds: string[];
  loading: boolean;
  onVisibleEmployeeIds: (ids: string[]) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onWeekDate: (date: string) => void;
  onAdd: (date?: string) => void;
  onEdit: (shift: ScheduleShift) => void;
  onPdf: () => void;
};

const PIXELS_PER_HOUR = 44;

export function ScheduleWeekView({
  data,
  dates,
  employees,
  visibleEmployeeIds,
  loading,
  onVisibleEmployeeIds,
  onPreviousWeek,
  onNextWeek,
  onWeekDate,
  onAdd,
  onEdit,
  onPdf
}: Props) {
  const visibleIds = useMemo(() => new Set(visibleEmployeeIds), [visibleEmployeeIds]);
  const dateSet = useMemo(() => new Set(dates), [dates]);
  const shifts = useMemo(
    () => (data?.shifts ?? []).filter((shift) => dateSet.has(shift.date) && visibleIds.has(shift.employeeId)),
    [data?.shifts, dateSet, visibleIds]
  );
  const bounds = useMemo(() => timelineBounds(data, shifts, dates), [data, shifts, dates]);
  const timelineHeight = ((bounds.end - bounds.start) / 60) * PIXELS_PER_HOUR;
  const hourTicks = useMemo(() => hourTickValues(bounds.start, bounds.end), [bounds]);

  const toggleEmployee = (employeeId: string) => {
    onVisibleEmployeeIds(
      visibleIds.has(employeeId)
        ? visibleEmployeeIds.filter((id) => id !== employeeId)
        : [...visibleEmployeeIds, employeeId]
    );
  };

  return (
    <section className="schedule-week-view">
      <section className="content-band schedule-week-toolbar">
        <div className="schedule-week-heading">
          <div>
            <h2>Grilla semanal</h2>
            <p>{weekLabel(dates)}</p>
          </div>
          <div className="schedule-week-actions">
            <button className="secondary-button" disabled={!data} onClick={onPdf} type="button">
              <Download size={17} aria-hidden="true" />
              PDF semanal
            </button>
            <button className="primary-button" onClick={() => onAdd()} type="button">
              <CalendarPlus size={17} aria-hidden="true" />
              AGREGAR TURNO
            </button>
          </div>
        </div>

        <div className="schedule-week-nav">
          <button className="nav-button" onClick={onPreviousWeek} type="button" aria-label="Semana anterior">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <label className="date-display schedule-week-date">
            <strong>{weekLabel(dates)}</strong>
            <input value={dates[0]} onChange={(event) => onWeekDate(event.target.value)} type="date" aria-label="Elegir semana" />
          </label>
          <button className="nav-button" onClick={onNextWeek} type="button" aria-label="Semana siguiente">
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="employee-filter-row" aria-label="Filtrar empleados">
          <button
            className={`employee-filter ${visibleEmployeeIds.length === employees.length ? "active" : ""}`}
            onClick={() => onVisibleEmployeeIds(employees.map((employee) => employee.id))}
            type="button"
          >
            Todos
          </button>
          {employees.map((employee) => (
            <button
              className={`employee-filter ${visibleIds.has(employee.id) ? "active" : ""}`}
              key={employee.id}
              onClick={() => toggleEmployee(employee.id)}
              style={{ "--employee-color": employee.color } as CSSProperties}
              type="button"
            >
              <span aria-hidden="true" />
              {employee.name}
            </button>
          ))}
        </div>
      </section>

      <section className="content-band schedule-week-band">
        {loading ? <p className="muted-text">Cargando grilla...</p> : null}
        {!loading && shifts.length === 0 ? <div className="dashed-empty">No hay turnos visibles en esta semana.</div> : null}
        <div className="schedule-week-scroll">
          <div className="schedule-week-grid">
            <div className="schedule-week-corner">Hora</div>
            {dates.map((date) => {
              const dayShifts = shifts.filter((shift) => shift.date === date);
              const total = dayShifts.reduce((sum, shift) => sum + shift.hours, 0);
              const business = data?.businessHours.find((row) => row.date === date);
              return (
                <button className="schedule-week-day-head" key={date} onClick={() => onAdd(date)} type="button">
                  <span>{weekdayShort(date)}</span>
                  <strong>{shortDate(date)}</strong>
                  <small>{business?.active ? `${business.openTime}-${business.closeTime}` : "Cerrado"} · {formatHours(total)}</small>
                </button>
              );
            })}

            <div className="schedule-time-axis" style={{ height: timelineHeight }}>
              {hourTicks.map((minute) => (
                <span key={minute} style={{ top: ((minute - bounds.start) / 60) * PIXELS_PER_HOUR }}>
                  {formatClock(minute)}
                </span>
              ))}
            </div>
            {dates.map((date) => (
              <ScheduleDayTimeline
                bounds={bounds}
                businessHours={data?.businessHours.find((row) => row.date === date)}
                height={timelineHeight}
                key={date}
                onEdit={onEdit}
                shifts={shifts.filter((shift) => shift.date === date)}
              />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function ScheduleDayTimeline({
  shifts,
  businessHours,
  bounds,
  height,
  onEdit
}: {
  shifts: ScheduleShift[];
  businessHours: ScheduleResponse["businessHours"][number] | undefined;
  bounds: { start: number; end: number };
  height: number;
  onEdit: (shift: ScheduleShift) => void;
}) {
  const timed = layoutShifts(shifts.filter((shift) => !shift.isAbsence && shift.startTime && shift.endTime));
  const absences = shifts.filter((shift) => shift.isAbsence);
  const windowStart = businessHours?.openTime ? clockMinutes(businessHours.openTime) : null;
  const windowEnd = businessHours?.closeTime ? clockMinutes(businessHours.closeTime) : null;

  return (
    <div className="schedule-day-timeline" style={{ height }}>
      {businessHours?.active && windowStart !== null && windowEnd !== null ? (
        <div
          className="schedule-business-window"
          style={{
            top: ((windowStart - bounds.start) / 60) * PIXELS_PER_HOUR,
            height: ((windowEnd - windowStart) / 60) * PIXELS_PER_HOUR
          }}
        />
      ) : null}
      {absences.map((shift, index) => (
        <button
          className="schedule-absence-block"
          key={shift.id}
          onClick={() => onEdit(shift)}
          style={{ top: 4 + index * 24 }}
          type="button"
        >
          {shift.employeeName}: ausente
        </button>
      ))}
      {timed.map(({ shift, lane, laneCount }) => {
        const start = clockMinutes(shift.startTime!);
        let end = clockMinutes(shift.endTime!);
        if (end <= start) end += 24 * 60;
        const clippedStart = Math.max(bounds.start, start);
        const clippedEnd = Math.min(bounds.end, end);
        const left = (lane / laneCount) * 100;
        const width = 100 / laneCount;
        return (
          <button
            className="schedule-timeline-shift"
            key={shift.id}
            onClick={() => onEdit(shift)}
            style={{
              top: ((clippedStart - bounds.start) / 60) * PIXELS_PER_HOUR,
              height: Math.max(22, ((clippedEnd - clippedStart) / 60) * PIXELS_PER_HOUR),
              left: `calc(${left}% + 3px)`,
              width: `calc(${width}% - 6px)`,
              backgroundColor: shift.employeeColor,
              color: textColorFor(shift.employeeColor)
            }}
            type="button"
          >
            <strong>{shift.employeeName}</strong>
            <span>{shift.startTime}-{shift.endTime}</span>
          </button>
        );
      })}
    </div>
  );
}

function layoutShifts(shifts: ScheduleShift[]) {
  const sorted = [...shifts].sort((left, right) => (left.startTime ?? "").localeCompare(right.startTime ?? ""));
  const laneEnds: number[] = [];
  const placed = sorted.map((shift) => {
    const start = clockMinutes(shift.startTime!);
    let end = clockMinutes(shift.endTime!);
    if (end <= start) end += 24 * 60;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    return { shift, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);
  return placed.map((item) => ({ ...item, laneCount }));
}

function timelineBounds(data: ScheduleResponse | undefined, shifts: ScheduleShift[], dates: string[]) {
  const values: number[] = [];
  for (const row of data?.businessHours ?? []) {
    if (!dates.includes(row.date)) continue;
    if (row.openTime) values.push(clockMinutes(row.openTime));
    if (row.closeTime) values.push(clockMinutes(row.closeTime));
  }
  for (const shift of shifts) {
    if (shift.startTime) values.push(clockMinutes(shift.startTime));
    if (shift.endTime) values.push(clockMinutes(shift.endTime));
  }
  const start = Math.max(0, Math.floor((Math.min(...values, 7 * 60 + 30) - 60) / 30) * 30);
  const end = Math.min(24 * 60, Math.ceil((Math.max(...values, 19 * 60 + 30) + 60) / 30) * 30);
  return { start, end: Math.max(start + 60, end) };
}

function hourTickValues(start: number, end: number) {
  const first = Math.ceil(start / 60) * 60;
  const ticks: number[] = [];
  for (let minute = first; minute <= end; minute += 60) ticks.push(minute);
  return ticks;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatClock(minutes: number) {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:00`;
}

function weekLabel(dates: string[]) {
  return `${shortDate(dates[0])} al ${shortDate(dates[dates.length - 1])}`;
}

function weekdayShort(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(new Date(year, month - 1, day)).replace(".", "");
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} hs`;
}

function textColorFor(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#fff";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.68 ? "#12212d" : "#fff";
}

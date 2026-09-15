import { ArrowLeftRight, Clock3, Copy, Minus, Plus, Trash2, X } from "lucide-react";
import type { ScheduleEmployee } from "../api";

export type ShiftEditorValue = {
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

type Props = {
  open: boolean;
  value: ShiftEditorValue;
  employees: ScheduleEmployee[];
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onChange: (value: ShiftEditorValue) => void;
  onClose: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ShiftEditorModal({
  open,
  value,
  employees,
  saving,
  deleting,
  error,
  onChange,
  onClose,
  onSave,
  onDuplicate,
  onDelete
}: Props) {
  if (!open) return null;
  const duration = shiftDuration(value.startTime, value.endTime, Number(value.breakMinutes || 0));
  const canAdjust = !value.isAbsence && Boolean(value.startTime && value.endTime);

  const update = <K extends keyof ShiftEditorValue>(key: K, next: ShiftEditorValue[K]) => {
    onChange({ ...value, [key]: next });
  };

  const move = (minutes: number) => {
    if (!canAdjust) return;
    onChange({ ...value, startTime: shiftClock(value.startTime, minutes), endTime: shiftClock(value.endTime, minutes) });
  };

  const resize = (minutes: number) => {
    if (!canAdjust) return;
    const nextEnd = shiftClock(value.endTime, minutes);
    if (shiftDuration(value.startTime, nextEnd, Number(value.breakMinutes || 0)) <= 0) return;
    update("endTime", nextEnd);
  };

  return (
    <div className="schedule-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="shift-editor-title">
        <div className="schedule-modal-header">
          <div>
            <span className="eyebrow">GRILLA</span>
            <h2 id="shift-editor-title">{value.id ? "Editar turno" : "Agregar turno"}</h2>
          </div>
          <button className="icon-only-button" onClick={onClose} type="button" aria-label="Cerrar editor">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form
          className="form-grid dense-form schedule-modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="full">
            Empleado
            <select value={value.employeeId} onChange={(event) => update("employeeId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input value={value.date} onChange={(event) => update("date", event.target.value)} type="date" required />
          </label>
          <label>
            Hasta
            <input
              value={value.dateTo}
              disabled={!value.isAbsence}
              onChange={(event) => update("dateTo", event.target.value)}
              type="date"
            />
          </label>
          <label>
            Entrada
            <input
              value={value.startTime}
              disabled={value.isAbsence}
              onChange={(event) => update("startTime", event.target.value)}
              type="time"
              required={!value.isAbsence}
            />
          </label>
          <label>
            Salida
            <input
              value={value.endTime}
              disabled={value.isAbsence}
              onChange={(event) => update("endTime", event.target.value)}
              type="time"
              required={!value.isAbsence}
            />
          </label>
          <label>
            Descanso min.
            <input
              min="0"
              max="240"
              value={value.breakMinutes}
              onChange={(event) => update("breakMinutes", event.target.value)}
              type="number"
            />
          </label>
          <div className="shift-duration-card">
            <Clock3 size={17} aria-hidden="true" />
            <span>Duración</span>
            <strong>{canAdjust ? formatHours(duration) : "Por confirmar"}</strong>
          </div>

          <div className="full shift-adjust-grid">
            <div className="shift-adjust-group">
              <span>Mover turno</span>
              <div>
                <button className="secondary-button compact" disabled={!canAdjust} onClick={() => move(-30)} type="button">
                  <ArrowLeftRight size={15} aria-hidden="true" />
                  -30 min
                </button>
                <button className="secondary-button compact" disabled={!canAdjust} onClick={() => move(30)} type="button">
                  <ArrowLeftRight size={15} aria-hidden="true" />
                  +30 min
                </button>
              </div>
            </div>
            <div className="shift-adjust-group">
              <span>Duración</span>
              <div>
                <button className="secondary-button compact" disabled={!canAdjust} onClick={() => resize(-30)} type="button">
                  <Minus size={15} aria-hidden="true" />
                  30 min
                </button>
                <button className="secondary-button compact" disabled={!canAdjust} onClick={() => resize(30)} type="button">
                  <Plus size={15} aria-hidden="true" />
                  30 min
                </button>
              </div>
            </div>
          </div>

          <label className="checkbox-label">
            <input checked={value.isHoliday} onChange={(event) => update("isHoliday", event.target.checked)} type="checkbox" />
            Feriado
          </label>
          <label className="checkbox-label">
            <input checked={value.isAbsence} onChange={(event) => update("isAbsence", event.target.checked)} type="checkbox" />
            Ausencia / vacaciones
          </label>
          <label className="full">
            Nota
            <textarea value={value.notes} onChange={(event) => update("notes", event.target.value)} rows={2} />
          </label>

          {error ? <p className="form-error full">{error}</p> : null}
          <div className="full schedule-modal-actions">
            {value.id ? (
              <>
                <button className="secondary-button" onClick={onDuplicate} type="button">
                  <Copy size={17} aria-hidden="true" />
                  Duplicar
                </button>
                <button
                  className="danger-button"
                  disabled={deleting}
                  onClick={() => {
                    if (window.confirm("¿Eliminar este turno? El cambio quedará registrado.")) onDelete();
                  }}
                  type="button"
                >
                  <Trash2 size={17} aria-hidden="true" />
                  Eliminar
                </button>
              </>
            ) : null}
            <button className="primary-button schedule-save-button" disabled={saving} type="submit">
              <Plus size={17} aria-hidden="true" />
              {saving ? "Guardando..." : value.id ? "Guardar cambios" : "Guardar turno"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function shiftDuration(startTime: string, endTime: string, breakMinutes = 0) {
  if (!startTime || !endTime) return 0;
  const start = clockMinutes(startTime);
  let end = clockMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start - breakMinutes) / 60);
}

function shiftClock(value: string, delta: number) {
  const total = (clockMinutes(value) + delta + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} hs`;
}

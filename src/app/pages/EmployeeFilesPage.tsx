import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Cake, Clock3, FileDown, IdCard, ImagePlus, Plus, Save, UserRound, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type EmployeeRecord, type EmployeeScheduleTemplate, type EmployeesResponse } from "../api";
import { downloadEmployeeFilePdf } from "../reportPdf";

type EmployeeForm = {
  id: string;
  name: string;
  color: string;
  address: string;
  cuil: string;
  contactPhone: string;
  birthDate: string;
  role: string;
  observations: string;
  weeklyHours: string;
  monthlyNetSalary: string;
  monthlyGrossSalary: string;
  employerCost: string;
  photoUrl: string;
  onPayroll: boolean;
  active: boolean;
  scheduleTemplate: EmployeeScheduleTemplate;
};

const emptyTemplate = (): EmployeeScheduleTemplate => ({
  mode: "fixed",
  label: "",
  rotation: "none",
  fixedShifts: [],
  notes: ""
});

const emptyForm = (): EmployeeForm => ({
  id: "",
  name: "",
  color: "#64748b",
  address: "",
  cuil: "",
  contactPhone: "",
  birthDate: "",
  role: "",
  observations: "",
  weeklyHours: "",
  monthlyNetSalary: "",
  monthlyGrossSalary: "",
  employerCost: "",
  photoUrl: "",
  onPayroll: false,
  active: true,
  scheduleTemplate: emptyTemplate()
});

const templatePresets: Record<string, EmployeeScheduleTemplate> = {
  diego: {
    mode: "fixed",
    label: "Horario fijo Diego",
    rotation: "diego",
    fixedShifts: [
      { days: "Lunes a sabados", startTime: "06:30", endTime: "11:30" },
      { days: "Lunes a sabados", startTime: "16:30", endTime: "20:00" },
      { days: "Domingos", startTime: "06:30", endTime: "11:30" }
    ],
    notes: "Dueño. Horario base del local."
  },
  vicky: {
    mode: "rotating",
    label: "Rotacion Vicky",
    rotation: "vicky",
      fixedShifts: [
      { weeks: "Semanas 1 y 3", days: "Lunes a sabados", startTime: "13:00", endTime: "20:00" },
      { weeks: "Semanas 2 y 4", days: "Martes a sabados", startTime: "13:00", endTime: "20:00" },
      { weeks: "Semanas 2 y 4", days: "Domingos", startTime: "11:30", endTime: "19:30" }
    ],
    notes: "Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."
  },
  mica: {
    mode: "rotating",
    label: "Rotacion Mica",
    rotation: "mica",
    fixedShifts: [
      { weeks: "Semanas 1 y 3", days: "Martes a sabados", startTime: "06:30", endTime: "13:30" },
      { weeks: "Semanas 1 y 3", days: "Domingos", startTime: "11:30", endTime: "19:30" },
      { weeks: "Semanas 2 y 4", days: "Lunes a sabados", startTime: "06:30", endTime: "13:30" }
    ],
    notes: "Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."
  },
  romi: {
    mode: "fixed",
    label: "Horario fijo Romi",
    rotation: "romi",
    fixedShifts: [
      { days: "Miercoles a sabados", startTime: "13:00", endTime: "20:00" },
      { days: "Domingos", startTime: "07:30", endTime: "14:30" }
    ],
    notes: "Horario base cargado desde grilla."
  }
};

const employeeColors = ["#2f66b3", "#1f9d55", "#c05a9e", "#f59e0b", "#64748b", "#dc2626", "#0f766e", "#7c3aed"];

export function EmployeeFilesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmployeeForm>(() => emptyForm());
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<EmployeesResponse>("/api/employees")
  });

  const saveEmployee = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/employees", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (result) => {
      setForm((current) => ({ ...current, id: result.id }));
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["schedule"] });
    }
  });

  const selectedAge = useMemo(() => ageFor(form.birthDate), [form.birthDate]);
  const data = employees.data;
  const selectedEmployee = useMemo(
    () => data?.employees.find((employee) => employee.id === form.id) ?? null,
    [data?.employees, form.id]
  );
  const computedSocialCharges = useMemo(() => employeeSocialCharges(form), [form]);
  const computedCost = useMemo(() => employeeEmployerCost(form), [form]);
  const computedWeeklyHours = useMemo(() => scheduleWeeklyHours(form.scheduleTemplate), [form.scheduleTemplate]);
  const socialChargesInputValue = computedSocialCharges ? formatInputNumber(computedSocialCharges) : "";
  const costInputValue = computedCost ? formatInputNumber(computedCost) : "";
  const weeklyHoursInputValue = computedWeeklyHours > 0 ? formatInputNumber(computedWeeklyHours) : form.weeklyHours;

  return (
    <section className="page-section employee-files-page">
      <div className="page-heading">
        <div>
          <h1>Fichas</h1>
          <p>Datos personales, laborales y plantillas horarias del equipo</p>
        </div>
        <button className="secondary-button" onClick={() => setForm(emptyForm())} type="button">
          <Plus size={17} aria-hidden="true" />
          Nueva ficha
        </button>
        <button
          className="secondary-button"
          disabled={!selectedEmployee}
          onClick={() => {
            if (selectedEmployee) void downloadEmployeeFilePdf(selectedEmployee);
          }}
          type="button"
        >
          <FileDown size={17} aria-hidden="true" />
          PDF ficha
        </button>
      </div>

      <div className="kpi-grid">
        <Kpi icon={Users} label="Fichas" value={data?.summary.total ?? 0} tone="blue" />
        <Kpi icon={BadgeCheck} label="Activas" value={data?.summary.active ?? 0} tone="green" />
        <Kpi icon={IdCard} label="Sin CUIL" value={data?.summary.missingCuil ?? 0} tone="amber" />
        <Kpi icon={Cake} label="Sin nacimiento" value={data?.summary.missingBirthDate ?? 0} tone="red" />
      </div>

      <div className="employee-files-layout">
        <section className="content-band compact-band">
          <h2>
            <Users size={18} aria-hidden="true" />
            Equipo
          </h2>
          {employees.isLoading ? <p className="muted-text">Cargando fichas...</p> : null}
          {employees.error ? <p className="form-error">{employees.error.message}</p> : null}
          <div className="employee-list">
            {(data?.employees ?? []).map((employee) => (
              <button
                className={`employee-card ${form.id === employee.id ? "active" : ""}`}
                key={employee.id}
                onClick={() => setForm(employeeToForm(employee))}
                type="button"
              >
                <span className="employee-card-head">
                  <strong>
                    {employee.photoUrl ? (
                      <img className="employee-card-photo" src={employee.photoUrl} alt="" />
                    ) : (
                      <span className="employee-color-dot" style={{ backgroundColor: employee.color }} />
                    )}
                    {employee.name}
                  </strong>
                  <small className={`signal-pill ${employee.active ? "green" : "slate"}`}>
                    {employee.active ? "Activa" : "Inactiva"}
                  </small>
                </span>
                <span>{employee.role ?? "Sin rol"}</span>
                <small>
                  {employee.ageRange} · {employee.scheduleTemplate.label || modeLabel(employee.scheduleTemplate.mode)}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="content-band">
          <h2>
            <UserRound size={18} aria-hidden="true" />
            {form.id ? "Editar ficha" : "Nueva ficha"}
          </h2>
          <form
            className="form-grid dense-form employee-file-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim()) return;
              saveEmployee.mutate(employeePayload(form));
            }}
          >
            <div className="employee-photo-field full">
              <div className="employee-photo-preview">
                {form.photoUrl ? <img src={form.photoUrl} alt="" /> : <ImagePlus size={34} aria-hidden="true" />}
              </div>
              <div className="employee-photo-actions">
                <strong>Foto de ficha</strong>
                <label className="secondary-button compact">
                  <ImagePlus size={16} aria-hidden="true" />
                  Cargar foto
                  <input
                    accept="image/*"
                    hidden
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      updateForm(setForm, "photoUrl", await resizeImageFile(file));
                    }}
                    type="file"
                  />
                </label>
                {form.photoUrl ? (
                  <button className="secondary-button compact" onClick={() => updateForm(setForm, "photoUrl", "")} type="button">
                    <X size={16} aria-hidden="true" />
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>

            <label className="full">
              Nombre completo
              <input value={form.name} onChange={(event) => updateForm(setForm, "name", event.target.value)} required />
            </label>
            <label className="full">
              Direccion
              <input value={form.address} onChange={(event) => updateForm(setForm, "address", event.target.value)} />
            </label>
            <label>
              CUIL
              <input value={form.cuil} onChange={(event) => updateForm(setForm, "cuil", event.target.value)} placeholder="20-00000000-0" />
            </label>
            <label>
              Contacto
              <input value={form.contactPhone} onChange={(event) => updateForm(setForm, "contactPhone", event.target.value)} />
            </label>
            <label>
              Fecha nacimiento
              <input value={form.birthDate} onChange={(event) => updateForm(setForm, "birthDate", event.target.value)} type="date" />
            </label>
            <div className="age-preview">
              <Cake size={17} aria-hidden="true" />
              <span>
                <strong>{selectedAge.age === null ? "-" : `${selectedAge.age} anos`}</strong>
                <small>{selectedAge.range}</small>
              </span>
            </div>
            <label>
              Rol
              <input value={form.role} onChange={(event) => updateForm(setForm, "role", event.target.value)} placeholder="Ej. Atencion, produccion" />
            </label>
            <label>
              Color en grilla
              <input value={form.color} onChange={(event) => updateForm(setForm, "color", event.target.value)} type="color" />
            </label>
            <div className="color-palette">
              {employeeColors.map((color) => (
                <button
                  aria-label={`Elegir color ${color}`}
                  className={`color-swatch ${form.color.toLowerCase() === color.toLowerCase() ? "active" : ""}`}
                  key={color}
                  onClick={() => updateForm(setForm, "color", color)}
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </div>
            <label className="checkbox-label">
              <input checked={form.active} onChange={(event) => updateForm(setForm, "active", event.target.checked)} type="checkbox" />
              Activa
            </label>
            <label className="checkbox-label">
              <input checked={form.onPayroll} onChange={(event) => updateForm(setForm, "onPayroll", event.target.checked)} type="checkbox" />
              Con nomina
            </label>
            <label>
              Horas semanales
              <input
                readOnly={computedWeeklyHours > 0}
                value={weeklyHoursInputValue}
                onChange={(event) => updateForm(setForm, "weeklyHours", event.target.value)}
                inputMode="decimal"
              />
              <small className="field-hint">
                {computedWeeklyHours > 0 ? "Calculado desde las franjas laborales" : "Manual hasta cargar franjas"}
              </small>
            </label>
            <label>
              Sueldo neto
              <input
                value={form.monthlyNetSalary}
                onChange={(event) => updateForm(setForm, "monthlyNetSalary", event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              Cargas sociales
              <input
                readOnly
                value={socialChargesInputValue}
                inputMode="decimal"
              />
              <small className="field-hint">{form.onPayroll ? "35% del sueldo neto" : "Sin nomina: no aplica cargas"}</small>
            </label>
            <label>
              Costo real empleado
              <input
                readOnly
                value={costInputValue}
                inputMode="decimal"
              />
              <small className="field-hint">Sueldo neto + cargas sociales</small>
            </label>
            <label className="full">
              Observaciones
              <textarea value={form.observations} onChange={(event) => updateForm(setForm, "observations", event.target.value)} rows={3} />
            </label>

            <div className="schedule-template-editor full">
              <div className="table-heading">
                <h2>
                  <Clock3 size={18} aria-hidden="true" />
                  Franjas laborales
                </h2>
                <div className="template-preset-actions">
                  {Object.entries(templatePresets).map(([key, template]) => (
                    <button className="secondary-button compact" key={key} onClick={() => applyTemplate(setForm, template)} type="button">
                      {template.rotation === "diego" ? "Diego" : template.rotation === "mica" ? "Mica" : template.rotation === "vicky" ? "Vicky" : "Romi"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid dense-form">
                <label>
                  Tipo
                  <select
                    value={form.scheduleTemplate.mode}
                    onChange={(event) => updateTemplate(setForm, { mode: event.target.value as EmployeeScheduleTemplate["mode"] })}
                  >
                    <option value="fixed">Fijo</option>
                    <option value="rotating">Rotativo</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </label>
                <label>
                  Sistema
                  <select
                    value={form.scheduleTemplate.rotation}
                    onChange={(event) => updateTemplate(setForm, { rotation: event.target.value as EmployeeScheduleTemplate["rotation"] })}
                  >
                    <option value="none">Sin sistema</option>
                    <option value="diego">Diego fijo</option>
                    <option value="vicky">Rotacion Vicky</option>
                    <option value="mica">Rotacion Mica</option>
                    <option value="romi">Romi fijo</option>
                  </select>
                </label>
                <label className="full">
                  Nombre de plantilla
                  <input
                    value={form.scheduleTemplate.label}
                    onChange={(event) => updateTemplate(setForm, { label: event.target.value })}
                    placeholder="Ej. Tarde rotativa"
                  />
                </label>
              </div>

              <div className="template-row-list">
                {form.scheduleTemplate.fixedShifts.map((block, index) => (
                  <div className="template-row" key={`${index}-${block.days}`}>
                    <input
                      value={block.weeks ?? ""}
                      onChange={(event) => updateBlock(setForm, index, "weeks", event.target.value)}
                      placeholder="Semana"
                    />
                    <input value={block.days} onChange={(event) => updateBlock(setForm, index, "days", event.target.value)} placeholder="Dias" />
                    <input value={block.startTime} onChange={(event) => updateBlock(setForm, index, "startTime", event.target.value)} type="time" />
                    <input value={block.endTime} onChange={(event) => updateBlock(setForm, index, "endTime", event.target.value)} type="time" />
                    <button className="secondary-button compact" onClick={() => removeBlock(setForm, index)} type="button">
                      Quitar
                    </button>
                  </div>
                ))}
                <button className="secondary-button" onClick={() => addBlock(setForm)} type="button">
                  <Plus size={17} aria-hidden="true" />
                  Agregar franja
                </button>
              </div>
              <label className="full template-notes">
                Nota de la plantilla
                <textarea
                  value={form.scheduleTemplate.notes}
                  onChange={(event) => updateTemplate(setForm, { notes: event.target.value })}
                  rows={2}
                />
              </label>
            </div>

            {saveEmployee.error ? <p className="form-error">{saveEmployee.error.message}</p> : null}
            {saveEmployee.isSuccess ? <p className="form-success">Ficha guardada.</p> : null}
            <button className="primary-button full" disabled={saveEmployee.isPending} type="submit">
              <Save size={17} aria-hidden="true" />
              {saveEmployee.isPending ? "Guardando..." : "Guardar ficha"}
            </button>
          </form>
        </section>
      </div>
    </section>
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

function employeeToForm(employee: EmployeeRecord): EmployeeForm {
  return {
    id: employee.id,
    name: employee.name,
    color: employee.color,
    address: employee.address ?? "",
    cuil: employee.cuil ?? "",
    contactPhone: employee.contactPhone ?? "",
    birthDate: employee.birthDate ?? "",
    role: employee.role ?? "",
    observations: employee.observations ?? "",
    weeklyHours: String(employee.weeklyHours || ""),
    monthlyNetSalary: String(employee.monthlyNetSalary || ""),
    monthlyGrossSalary: employee.monthlyGrossSalary ? String(employee.monthlyGrossSalary) : "",
    employerCost: employee.employerCost ? String(employee.employerCost) : "",
    photoUrl: employee.photoUrl ?? "",
    onPayroll: employee.onPayroll,
    active: employee.active,
    scheduleTemplate: employee.scheduleTemplate ?? emptyTemplate()
  };
}

function employeePayload(form: EmployeeForm) {
  const socialCharges = employeeSocialCharges(form);
  const employerCost = employeeEmployerCost(form);
  const computedWeeklyHours = scheduleWeeklyHours(form.scheduleTemplate);
  return {
    id: form.id || null,
    name: form.name,
    color: form.color,
    address: form.address,
    cuil: form.cuil,
    contactPhone: form.contactPhone,
    birthDate: form.birthDate || null,
    role: form.role,
    observations: form.observations,
    weeklyHours: computedWeeklyHours > 0 ? computedWeeklyHours : numberFromInput(form.weeklyHours),
    monthlyNetSalary: numberFromInput(form.monthlyNetSalary),
    monthlyGrossSalary: socialCharges,
    employerCost,
    photoUrl: form.photoUrl || null,
    onPayroll: form.onPayroll,
    active: form.active,
    scheduleTemplate: {
      ...form.scheduleTemplate,
      fixedShifts: form.scheduleTemplate.fixedShifts.filter((block) => block.days && block.startTime && block.endTime)
    }
  };
}

function updateForm<T extends keyof EmployeeForm>(
  setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>,
  key: T,
  value: EmployeeForm[T]
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateTemplate(setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>, value: Partial<EmployeeScheduleTemplate>) {
  setForm((current) => ({
    ...current,
    scheduleTemplate: {
      ...current.scheduleTemplate,
      ...value
    }
  }));
}

function updateBlock(
  setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>,
  index: number,
  key: "weeks" | "days" | "startTime" | "endTime",
  value: string
) {
  setForm((current) => ({
    ...current,
    scheduleTemplate: {
      ...current.scheduleTemplate,
      fixedShifts: current.scheduleTemplate.fixedShifts.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [key]: value } : block
      )
    }
  }));
}

function addBlock(setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>) {
  setForm((current) => ({
    ...current,
    scheduleTemplate: {
      ...current.scheduleTemplate,
      fixedShifts: [...current.scheduleTemplate.fixedShifts, { weeks: "", days: "", startTime: "07:00", endTime: "13:00" }]
    }
  }));
}

function removeBlock(setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>, index: number) {
  setForm((current) => ({
    ...current,
    scheduleTemplate: {
      ...current.scheduleTemplate,
      fixedShifts: current.scheduleTemplate.fixedShifts.filter((_, blockIndex) => blockIndex !== index)
    }
  }));
}

function applyTemplate(setForm: React.Dispatch<React.SetStateAction<EmployeeForm>>, template: EmployeeScheduleTemplate) {
  setForm((current) => ({
    ...current,
    role: current.name.toLowerCase() === "diego" || template.rotation === "diego" ? "Dueño" : current.role,
    color: defaultColorForRotation(template.rotation, current.color),
    scheduleTemplate: structuredClone(template)
  }));
}

function defaultColorForRotation(rotation: EmployeeScheduleTemplate["rotation"], fallback: string) {
  const colors: Record<EmployeeScheduleTemplate["rotation"], string> = {
    none: fallback,
    diego: "#2f66b3",
    vicky: "#c05a9e",
    mica: "#1f9d55",
    romi: "#f59e0b"
  };
  return colors[rotation];
}

function ageFor(value: string) {
  if (!value) return { age: null, range: "Sin fecha" };
  const [birthYear, birthMonth, birthDay] = value.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth || (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay)) age -= 1;
  return { age, range: ageRange(age) };
}

function ageRange(age: number | null) {
  if (age === null || !Number.isFinite(age)) return "Sin fecha";
  if (age < 18) return "Menor de 18";
  if (age <= 24) return "18 a 24";
  if (age <= 34) return "25 a 34";
  if (age <= 44) return "35 a 44";
  if (age <= 54) return "45 a 54";
  return "55+";
}

function numberFromInput(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function employeeEmployerCost(form: EmployeeForm) {
  const netSalary = numberFromInput(form.monthlyNetSalary);
  if (!netSalary) return null;
  return Math.round((netSalary + employeeSocialCharges(form)) * 100) / 100;
}

function employeeSocialCharges(form: EmployeeForm) {
  const netSalary = numberFromInput(form.monthlyNetSalary);
  if (!form.onPayroll || !netSalary) return 0;
  return Math.round(netSalary * 0.35 * 100) / 100;
}

function formatInputNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function scheduleWeeklyHours(template: EmployeeScheduleTemplate) {
  return Math.round(
    template.fixedShifts.reduce((total, block) => {
      const hours = hoursBetween(block.startTime, block.endTime);
      const days = dayCountFor(block.days);
      const factor = weekFactorFor(block.weeks ?? "");
      return total + hours * days * factor;
    }, 0) * 100
  ) / 100;
}

function hoursBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function dayCountFor(value: string) {
  const text = normalizeScheduleText(value);
  const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const rangeMatch = text.match(/(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?\s+a\s+(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?/);
  if (rangeMatch) {
    const start = dayNames.indexOf(rangeMatch[1]);
    const end = dayNames.indexOf(rangeMatch[2]);
    if (start >= 0 && end >= 0) return end >= start ? end - start + 1 : dayNames.length - start + end + 1;
  }
  const found = dayNames.filter((day) => text.includes(day));
  return new Set(found).size;
}

function weekFactorFor(value: string) {
  const text = normalizeScheduleText(value);
  if (!text) return 1;
  const weeks = [...new Set([...text.matchAll(/[1-4]/g)].map((match) => match[0]))];
  if (weeks.length > 0) return weeks.length / 4;
  if (text.includes("altern")) return 0.5;
  return 1;
}

function normalizeScheduleText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function resizeImageFile(file: File) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxSide = 720;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen"));
    image.src = source;
  });
}

function modeLabel(mode: EmployeeScheduleTemplate["mode"]) {
  const labels = {
    fixed: "Horario fijo",
    rotating: "Rotativo",
    custom: "Personalizado"
  };
  return labels[mode];
}

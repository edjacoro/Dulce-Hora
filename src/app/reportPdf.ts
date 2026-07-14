import { jsPDF } from "jspdf";
import type {
  EmployeeRecord,
  ProductPerformance,
  SalesDocument,
  SalesSummary,
  ScheduleResponse,
  WasteRecord,
  WasteSummary
} from "./api";
import { dulceHoraLogo } from "./brand";

type Metric = {
  label: string;
  value: string;
  tone?: "red" | "blue" | "green" | "amber" | "slate";
};

type BarRow = {
  label: string;
  value: number;
  detail?: string;
};

type TableRow = Array<string | number>;

const page = {
  width: 210,
  height: 297,
  margin: 14
};

const colors = {
  red: [201, 18, 34] as const,
  redDark: [135, 13, 25] as const,
  blue: [31, 82, 100] as const,
  green: [0, 157, 128] as const,
  amber: [176, 112, 20] as const,
  slate: [77, 89, 102] as const,
  text: [24, 25, 27] as const,
  muted: [105, 114, 125] as const,
  line: [221, 226, 232] as const,
  soft: [246, 247, 248] as const
};

let logoDataUrlPromise: Promise<string | null> | null = null;

export async function downloadSalesPdf(summary: SalesSummary, documents: SalesDocument[], periodLabel: string) {
  const report = await createReport("Ventas", periodLabel, "Ventas sincronizadas desde Dulce Hora");
  report.metrics([
    { label: "Venta neta", value: formatCurrency(summary.summary.netSales), tone: "red" },
    { label: "Tickets", value: formatInteger(summary.summary.tickets), tone: "blue" },
    { label: "Ticket promedio", value: formatCurrency(summary.summary.averageTicket), tone: "green" },
    { label: "Articulos/ticket", value: formatNumber(summary.summary.unitsPerTicket), tone: "amber" },
    { label: "Cafes", value: formatNumber(summary.summary.coffeeCount), tone: "green" }
  ]);
  report.bars(
    "Medios de pago",
    summary.byPayment.map((row) => ({ label: row.label, value: Number(row.total), detail: `${row.documents} tickets` })),
    formatCurrency
  );
  report.bars(
    "Venta por hora",
    summary.byHour.map((row) => ({
      label: row.label === "Sin hora" ? row.label : `${row.label}:00`,
      value: Number(row.total),
      detail: `${row.documents} tickets`
    })),
    formatCurrency
  );
  report.table(
    "Top productos",
    ["Producto", "Unidades", "Venta"],
    summary.topProducts.slice(0, 12).map((row) => [row.label, formatNumber(Number(row.quantity)), formatCurrency(Number(row.total))])
  );
  report.table(
    "Comprobantes",
    ["Fecha", "Medio", "Items", "Total"],
    documents.slice(0, 24).map((row) => [
      `${row.sale_date}${row.sale_time ? ` ${row.sale_time.slice(0, 5)}` : ""}`,
      paymentLabel(row.payment_method),
      row.item_count,
      formatCurrency(Number(row.total))
    ])
  );
  report.save(`ventas-${filenamePeriod(periodLabel)}.pdf`);
}

export async function downloadWastePdf(summary: WasteSummary, records: WasteRecord[], periodLabel: string) {
  const report = await createReport("Mermas", periodLabel, "Desperdicio valorizado y porcentaje sobre venta");
  report.metrics([
    { label: "Costo de merma", value: formatCurrency(summary.summary.totalCost), tone: "red" },
    { label: "Lineas", value: formatInteger(summary.summary.records), tone: "blue" },
    { label: "Registros", value: formatInteger(summary.summary.events), tone: "green" },
    { label: "Productos", value: formatInteger(summary.summary.products), tone: "amber" }
  ]);
  report.bars(
    "Merma por dia",
    summary.byDate.map((row) => ({
      label: shortDate(row.label),
      value: Number(row.total),
      detail: row.wastePercent === null ? "sin venta" : `${formatPercent(row.wastePercent)} sobre venta`
    })),
    formatCurrency
  );
  report.bars(
    "Productos con mayor merma",
    summary.topProducts.map((row) => ({
      label: row.label,
      value: Number(row.total),
      detail: `${formatNumber(Number(row.quantity))} un. - ${row.category}`
    })),
    formatCurrency
  );
  report.table(
    "Detalle de mermas",
    ["Fecha", "Producto", "Cant.", "Total"],
    records.slice(0, 28).map((row) => [
      row.date,
      row.product_name ?? "Sin producto",
      formatNumber(Number(row.quantity)),
      formatCurrency(Number(row.total_cost ?? 0))
    ])
  );
  report.save(`mermas-${filenamePeriod(periodLabel)}.pdf`);
}

export async function downloadProductsPdf(data: ProductPerformance, periodLabel: string) {
  const report = await createReport("Productos", periodLabel, "Ranking de venta, rotacion y merma cruzada");
  report.metrics([
    { label: "Venta productos", value: formatCurrency(data.summary.revenue), tone: "blue" },
    { label: "Unidades", value: formatNumber(data.summary.quantitySold), tone: "green" },
    { label: "Tickets", value: formatInteger(data.summary.tickets), tone: "slate" },
    { label: "Merma asociada", value: formatCurrency(data.summary.wasteCost), tone: "red" },
    { label: "Merma/venta", value: formatPercent(data.summary.wasteRate), tone: data.summary.wasteRate >= 3 ? "red" : "green" }
  ]);
  report.bars(
    "Productos por venta",
    data.products.slice(0, 10).map((row) => ({
      label: row.label,
      value: row.revenue,
      detail: `${formatPercent(row.share)} de venta - ${formatNumber(row.quantitySold)} un.`
    })),
    formatCurrency
  );
  report.bars(
    "Alertas de merma",
    [...data.products]
      .sort((a, b) => b.wasteCost - a.wasteCost)
      .slice(0, 10)
      .map((row) => ({
        label: row.label,
        value: row.wasteCost,
        detail: `${formatPercent(row.wasteRate)} - ${formatNumber(row.wasteQuantity)} un.`
      })),
    formatCurrency
  );
  report.table(
    "Estado por producto",
    ["Producto", "Venta", "Unid.", "Tickets", "Merma %", "Neto", "Senal"],
    data.products.slice(0, 30).map((row) => [
      row.label,
      formatCurrency(row.revenue),
      formatNumber(row.quantitySold),
      formatInteger(row.tickets),
      formatPercent(row.wasteRate),
      formatCurrency(row.netAfterWaste),
      row.signal
    ])
  );
  report.save(`productos-${filenamePeriod(periodLabel)}.pdf`);
}

export async function downloadSchedulePdf(data: ScheduleResponse, monthLabel: string) {
  const report = await createReport("Grilla horaria", monthLabel, "Horas, costo estimado, feriados e inasistencias");
  report.metrics([
    { label: "Personas activas", value: formatInteger(data.summary.employees), tone: "blue" },
    { label: "Turnos", value: formatInteger(data.summary.shifts), tone: "green" },
    { label: "Horas", value: formatNumber(data.summary.hours), tone: "slate" },
    { label: "Horas feriado", value: formatNumber(data.summary.holidayHours), tone: "amber" },
    { label: "Costo estimado", value: formatCurrency(data.summary.estimatedCost), tone: "red" }
  ]);
  report.bars(
    "Costo por persona",
    data.employeeSummary.map((row) => ({
      label: row.employeeName,
      value: row.estimatedCost,
      detail: `${formatNumber(row.hours)} hs - feriado ${formatNumber(row.holidayHours)} hs`
    })),
    formatCurrency
  );
  report.bars(
    "Costo por dia",
    data.dailySummary
      .filter((row) => row.hours > 0 || row.absences > 0)
      .map((row) => ({
        label: shortDate(row.date),
        value: row.estimatedCost,
        detail: `${formatNumber(row.hours)} hs - ${row.people} pers.`
      })),
    formatCurrency
  );
  report.table(
    "Resumen por persona",
    ["Persona", "Horas", "Feriado", "Aus.", "Costo"],
    data.employeeSummary.map((row) => [
      row.employeeName,
      formatNumber(row.hours),
      formatNumber(row.holidayHours),
      formatInteger(row.absences),
      formatCurrency(row.estimatedCost)
    ])
  );
  report.table(
    "Turnos del mes",
    ["Fecha", "Persona", "Horario", "Hs", "Marca"],
    data.shifts.slice(0, 42).map((row) => [
      shortDate(row.date),
      row.employeeName,
      row.isAbsence ? "Inasistencia" : `${row.startTime ?? "--"} a ${row.endTime ?? "--"}`,
      formatNumber(row.hours),
      row.isHoliday ? row.holidayName ?? "Feriado" : row.isAbsence ? "Ausente" : ""
    ])
  );
  report.save(`grilla-horaria-${data.month}.pdf`);
}

export async function downloadEmployeeFilePdf(employee: EmployeeRecord) {
  const report = await createReport("Ficha de empleado", employee.name, "Datos personales, laborales y plantilla horaria");
  const photoDataUrl = employee.photoUrl ? await loadImageDataUrl(employee.photoUrl) : null;
  report.profile(employee, photoDataUrl);
  report.metrics([
    { label: "Rol", value: employee.role ?? "Sin rol", tone: "blue" },
    { label: "Estado", value: employee.active ? "Activa" : "Inactiva", tone: employee.active ? "green" : "slate" },
    { label: "Edad", value: employee.age === null ? "Sin fecha" : `${employee.age} anos`, tone: "amber" },
    { label: "Horas semanales", value: formatNumber(employee.weeklyHours), tone: "slate" }
  ]);
  report.table("Datos personales", ["Campo", "Detalle"], [
    ["Nombre completo", employee.name],
    ["Direccion", employee.address ?? "-"],
    ["CUIL", employee.cuil ?? "-"],
    ["Contacto", employee.contactPhone ?? "-"],
    ["Fecha nacimiento", employee.birthDate ?? "-"],
    ["Rango de edad", employee.ageRange]
  ]);
  report.table("Datos laborales", ["Campo", "Detalle"], [
    ["Rol", employee.role ?? "-"],
    ["Horas semanales", formatNumber(employee.weeklyHours)],
    ["Sueldo neto", formatCurrency(employee.monthlyNetSalary)],
    ["Plantilla", employee.scheduleTemplate.label || modeLabel(employee.scheduleTemplate.mode)]
  ]);
  report.table(
    "Franjas laborales",
    ["Semana", "Dias", "Horario"],
    employee.scheduleTemplate.fixedShifts.length
      ? employee.scheduleTemplate.fixedShifts.map((block) => [
          block.weeks || "-",
          block.days,
          `${block.startTime} a ${block.endTime}`
        ])
      : [["-", "Sin franjas cargadas", "-"]]
  );
  if (employee.observations) {
    report.table("Observaciones", ["Detalle"], [[employee.observations]]);
  }
  report.save(`ficha-${filenamePeriod(employee.name)}.pdf`);
}

async function createReport(title: string, periodLabel: string, subtitle: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await loadLogoDataUrl();
  let y = 14;
  drawHeader(doc, title, subtitle, periodLabel, logoDataUrl);
  y = 44;

  function ensureSpace(height: number) {
    if (y + height <= page.height - 18) return;
    doc.addPage();
    drawHeader(doc, title, subtitle, periodLabel, logoDataUrl);
    y = 44;
  }

  return {
    profile(employee: EmployeeRecord, photoDataUrl: string | null) {
      ensureSpace(46);
      drawEmployeeProfile(doc, y, employee, photoDataUrl);
      y += 50;
    },
    metrics(metrics: Metric[]) {
      ensureSpace(34);
      const gap = 4;
      const columns = metrics.length > 4 ? 3 : 2;
      const cardWidth = (page.width - page.margin * 2 - gap * (columns - 1)) / columns;
      const cardHeight = 22;
      metrics.forEach((metric, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        drawMetric(doc, page.margin + col * (cardWidth + gap), y + row * (cardHeight + gap), cardWidth, cardHeight, metric);
      });
      y += Math.ceil(metrics.length / columns) * (cardHeight + gap) + 6;
    },
    bars(titleText: string, rows: BarRow[], formatter: (value: number) => string) {
      const visible = rows.filter((row) => row.value > 0).slice(0, 10);
      ensureSpace(visible.length * 8 + 24);
      sectionTitle(doc, titleText, y);
      y += 8;
      if (visible.length === 0) {
        mutedText(doc, "Sin datos para graficar en este periodo.", page.margin, y);
        y += 10;
        return;
      }
      const max = Math.max(1, ...visible.map((row) => row.value));
      visible.forEach((row) => {
        const label = trim(row.label, 28);
        setText(doc, colors.text, 8, "bold");
        doc.text(label, page.margin, y + 4);
        setText(doc, colors.muted, 7, "normal");
        if (row.detail) doc.text(trim(row.detail, 30), page.margin, y + 8);
        doc.setFillColor(...colors.soft);
        doc.roundedRect(74, y, 76, 4, 2, 2, "F");
        doc.setFillColor(...colors.red);
        doc.roundedRect(74, y, Math.max(3, (row.value / max) * 76), 4, 2, 2, "F");
        setText(doc, colors.text, 8, "bold");
        doc.text(formatter(row.value), 194, y + 4, { align: "right" });
        y += 9;
      });
      y += 4;
    },
    table(titleText: string, headers: string[], rows: TableRow[]) {
      const visible = rows.slice(0, 42);
      ensureSpace(Math.min(visible.length, 18) * 7 + 22);
      sectionTitle(doc, titleText, y);
      y += 8;
      if (visible.length === 0) {
        mutedText(doc, "Sin filas para mostrar.", page.margin, y);
        y += 10;
        return;
      }
      const widths = distributeWidths(headers.length);
      y = drawTable(doc, y, headers, visible, widths, () => {
        doc.addPage();
        drawHeader(doc, title, subtitle, periodLabel, logoDataUrl);
        return 44;
      });
      y += 5;
    },
    save(filename: string) {
      drawFooter(doc);
      doc.save(filename);
    }
  };
}

async function loadLogoDataUrl() {
  logoDataUrlPromise ??= fetch(dulceHoraLogo)
    .then(async (response) => {
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => null);
  return logoDataUrlPromise;
}

async function loadImageDataUrl(source: string) {
  if (source.startsWith("data:")) return source;
  return fetch(source)
    .then(async (response) => {
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => null);
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, periodLabel: string, logoDataUrl: string | null) {
  doc.setFillColor(...colors.red);
  doc.rect(0, 0, page.width, 24, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(page.margin, 4.5, 15, 15, 3, 3, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", page.margin + 1.2, 5.7, 12.6, 12.6);
  } else {
    doc.setTextColor(...colors.red);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DH", page.margin + 7.5, 14, { align: "center" });
  }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(title, page.margin + 20, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, page.margin + 20, 18);
  doc.text(periodLabel, page.width - page.margin, 12, { align: "right" });
  doc.text(`Generado ${formatDateTime(new Date())}`, page.width - page.margin, 18, { align: "right" });
}

function drawEmployeeProfile(doc: jsPDF, y: number, employee: EmployeeRecord, photoDataUrl: string | null) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 42, 3, 3, "FD");
  doc.setFillColor(...colors.soft);
  doc.roundedRect(page.margin + 5, y + 5, 32, 32, 3, 3, "F");

  if (photoDataUrl) {
    doc.addImage(photoDataUrl, imageFormat(photoDataUrl), page.margin + 5, y + 5, 32, 32);
  } else {
    setText(doc, colors.red, 14, "bold");
    doc.text(initials(employee.name), page.margin + 21, y + 24, { align: "center" });
  }

  setText(doc, colors.text, 16, "bold");
  doc.text(employee.name, page.margin + 43, y + 13);
  setText(doc, colors.muted, 8, "bold");
  doc.text(employee.role ?? "Sin rol", page.margin + 43, y + 20);
  doc.text(employee.contactPhone ?? "Sin contacto", page.margin + 43, y + 27);
  doc.text(employee.cuil ? `CUIL ${employee.cuil}` : "CUIL sin cargar", page.margin + 43, y + 34);

  const statusColor = employee.active ? colors.green : colors.slate;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(page.width - page.margin - 30, y + 8, 24, 8, 4, 4, "F");
  setText(doc, [255, 255, 255] as const, 7, "bold");
  doc.text(employee.active ? "ACTIVA" : "INACTIVA", page.width - page.margin - 18, y + 13.3, { align: "center" });
}

function drawMetric(doc: jsPDF, x: number, y: number, width: number, height: number, metric: Metric) {
  const tone = colors[metric.tone ?? "slate"];
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");
  doc.setFillColor(tone[0], tone[1], tone[2]);
  doc.roundedRect(x, y, 3, height, 2, 2, "F");
  setText(doc, colors.muted, 7, "bold");
  doc.text(metric.label, x + 7, y + 7);
  setText(doc, colors.text, 12, "bold");
  doc.text(metric.value, x + 7, y + 16, { maxWidth: width - 10 });
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  setText(doc, colors.text, 10, "bold");
  doc.text(title, page.margin, y);
  doc.setDrawColor(...colors.line);
  doc.line(page.margin, y + 3, page.width - page.margin, y + 3);
}

function drawTable(
  doc: jsPDF,
  yStart: number,
  headers: string[],
  rows: TableRow[],
  widths: number[],
  pageBreak: () => number
) {
  let y = yStart;
  drawTableHeader(doc, y, headers, widths);
  y += 7;
  rows.forEach((row) => {
    if (y + 10 > page.height - 18) {
      y = pageBreak();
      drawTableHeader(doc, y, headers, widths);
      y += 7;
    }
    let x = page.margin;
    doc.setDrawColor(...colors.line);
    doc.line(page.margin, y + 3.8, page.width - page.margin, y + 3.8);
    row.forEach((cell, index) => {
      setText(doc, index === row.length - 1 ? colors.text : colors.muted, 7, index === 0 ? "bold" : "normal");
      doc.text(trim(String(cell), 34), x + 1, y, { maxWidth: widths[index] - 2 });
      x += widths[index];
    });
    y += 6.5;
  });
  return y;
}

function drawTableHeader(doc: jsPDF, y: number, headers: string[], widths: number[]) {
  doc.setFillColor(...colors.soft);
  doc.rect(page.margin, y - 5, page.width - page.margin * 2, 7, "F");
  let x = page.margin;
  headers.forEach((header, index) => {
    setText(doc, colors.slate, 7, "bold");
    doc.text(header.toUpperCase(), x + 1, y, { maxWidth: widths[index] - 2 });
    x += widths[index];
  });
}

function distributeWidths(columns: number) {
  const total = page.width - page.margin * 2;
  if (columns === 3) return [total * 0.48, total * 0.22, total * 0.3];
  if (columns === 4) return [total * 0.24, total * 0.36, total * 0.16, total * 0.24];
  if (columns === 5) return [total * 0.18, total * 0.26, total * 0.26, total * 0.12, total * 0.18];
  if (columns === 7) return [total * 0.25, total * 0.14, total * 0.11, total * 0.11, total * 0.12, total * 0.13, total * 0.14];
  return Array.from({ length: columns }, () => total / columns);
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let index = 1; index <= pageCount; index += 1) {
    doc.setPage(index);
    doc.setDrawColor(...colors.line);
    doc.line(page.margin, 286, page.width - page.margin, 286);
    setText(doc, colors.muted, 7, "normal");
    doc.text("Dulce Hora Control", page.margin, 291);
    doc.text(`Pagina ${index} de ${pageCount}`, page.width - page.margin, 291, { align: "right" });
  }
}

function setText(doc: jsPDF, color: readonly [number, number, number], size: number, weight: "normal" | "bold") {
  doc.setTextColor(...color);
  doc.setFont("helvetica", weight);
  doc.setFontSize(size);
}

function mutedText(doc: jsPDF, text: string, x: number, y: number) {
  setText(doc, colors.muted, 8, "normal");
  doc.text(text, x, y);
}

function paymentLabel(value: string | null) {
  const labels: Record<string, string> = {
    virtual: "Transferencias",
    credito: "Posnet",
    debito: "Cuenta DNI",
    efectivo: "efectivo"
  };
  return value ? labels[value.toLowerCase()] ?? value : "Sin dato";
}

function shortDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date).replace(".", "");
  return `${weekday} ${Number(match[3])}/${Number(match[2])}`;
}

function filenamePeriod(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function imageFormat(dataUrl: string) {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "D") + (parts[1]?.[0] ?? "H");
}

function modeLabel(mode: EmployeeRecord["scheduleTemplate"]["mode"]) {
  const labels = {
    fixed: "Horario fijo",
    rotating: "Rotativo",
    custom: "Personalizado"
  };
  return labels[mode];
}

function trim(value: string, length: number) {
  return value.length > length ? `${value.slice(0, Math.max(0, length - 1))}.` : value;
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

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}

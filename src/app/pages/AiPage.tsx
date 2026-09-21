import { useQuery } from "@tanstack/react-query";
import { BarChart3, BrainCircuit, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type AnalysisDashboard, type HourPerformance, type ProductPerformance } from "../api";

type AiBar = {
  label: string;
  value: number;
  detail: string;
};

type AiAnswer = {
  title: string;
  text: string;
  metricLabel: string;
  bars: AiBar[];
};

const suggestions = [
  "Top 10 productos del mes",
  "Que productos no se vendieron en este mes",
  "Cual es la hora y el dia mas fuerte",
  "Como fue el ticket promedio y los articulos por ticket",
  "Comparar ventas por empleado"
];

export function AiPage() {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState(suggestions[0]);
  const [from, setFrom] = useState(() => monthStart(today()));
  const [to, setTo] = useState(() => today());

  const products = useQuery({
    queryKey: ["product-performance", from, to, "ai"],
    queryFn: () => api<ProductPerformance>(`/api/products/performance?from=${from}&to=${to}&limit=200`)
  });
  const hours = useQuery({
    queryKey: ["hour-performance", from, to, "ai"],
    queryFn: () => api<HourPerformance>(`/api/hours/performance?from=${from}&to=${to}`)
  });
  const employees = useQuery({
    queryKey: ["analysis-sales", "employee", "revenue", from, to, "ai"],
    queryFn: () =>
      api<AnalysisDashboard>(
        `/api/analysis/sales?report=employee&metric=revenue&from=${from}&to=${to}&weekday=all&hourFrom=0&hourTo=23&employeeId=all`
      )
  });

  const answer = useMemo(
    () => buildAnswer(askedQuestion, products.data, hours.data, employees.data),
    [askedQuestion, employees.data, hours.data, products.data]
  );
  const loading = products.isLoading || hours.isLoading || employees.isLoading;
  const error = products.error ?? hours.error ?? employees.error;

  return (
    <section className="page-section ai-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Consulta local verificada</span>
          <h1>Asistente de datos</h1>
          <p>Consulta ventas, productos, horarios y empleados usando exclusivamente los datos guardados en Neon.</p>
        </div>
        <div className="ai-range-controls">
          <label>
            Desde
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      <section className="ai-panel">
        <div className="ai-prompt-head">
          <div>
            <BrainCircuit size={22} aria-hidden="true" />
            <strong>Pregunta sobre el negocio</strong>
            <small>Interpreta palabras y sinonimos; no completa datos faltantes.</small>
          </div>
        </div>
        <form
          className="ai-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = question.trim();
            if (trimmed) setAskedQuestion(trimmed);
          }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ej: Cuantos pan de queso se vendieron y en que horario?"
            rows={3}
          />
          <button className="primary-button" type="submit">
            <Send size={17} aria-hidden="true" />
            Consultar
          </button>
        </form>
        <div className="ai-suggestion-list">
          {suggestions.map((suggestion) => (
            <button
              className={askedQuestion === suggestion ? "active" : ""}
              key={suggestion}
              onClick={() => {
                setQuestion(suggestion);
                setAskedQuestion(suggestion);
              }}
              type="button"
            >
              {suggestionLabel(suggestion, from, to)}
            </button>
          ))}
        </div>
      </section>

      {loading ? <section className="content-band"><p className="muted-text">Leyendo datos para responder...</p></section> : null}
      {error ? <p className="form-error">{error.message}</p> : null}

      {answer ? (
        <section className="ai-answer-grid">
          <article className="content-band ai-answer-card">
            <div className="table-heading">
              <h2>
                <Sparkles size={18} aria-hidden="true" />
                {answer.title}
              </h2>
              <span className="period-chip">{answer.metricLabel}</span>
            </div>
            <p>{answer.text}</p>
          </article>
          <article className="content-band ai-chart-card">
            <h2>
              <BarChart3 size={18} aria-hidden="true" />
              Grafico de respuesta
            </h2>
            <AiBars bars={answer.bars} />
          </article>
        </section>
      ) : null}
    </section>
  );
}

function suggestionLabel(suggestion: string, from: string, to: string) {
  if (from === monthStart(today()) && to === today()) return suggestion;
  return suggestion.replace("del mes", "del rango").replace("este mes", "este rango");
}

function buildAnswer(
  rawQuestion: string,
  products: ProductPerformance | undefined,
  hours: HourPerformance | undefined,
  employees: AnalysisDashboard | undefined
): AiAnswer | null {
  if (!products || !hours || !employees) return null;

  const question = normalize(rawQuestion);

  if (
    question.includes("no se vend") ||
    question.includes("sin venta") ||
    question.includes("sin movimiento") ||
    question.includes("descontinu") ||
    question.includes("baja rotacion")
  ) {
    const rows = employees.noSaleProducts.slice(0, 12);
    return {
      title: "Productos sin movimiento",
      metricLabel: "Sin ventas en el rango",
      text: rows.length
        ? `Hay ${formatInteger(employees.noSaleProducts.length)} productos del catalogo sin ventas en el periodo. Los primeros del listado son los que conviene revisar antes de discontinuar o activar con una accion comercial.`
        : "Todos los productos activos del catalogo tuvieron alguna venta en el periodo seleccionado.",
      bars: rows.map((row, index) => ({
        label: row.label,
        value: Math.max(1, rows.length - index),
        detail: row.lastSaleDate ? `Ultima venta: ${shortDate(row.lastSaleDate)}` : "Sin venta historica visible"
      }))
    };
  }

  if (question.includes("articulo por ticket") || question.includes("articulos por ticket") || question.includes("unidades por ticket")) {
    return {
      title: "Articulos por ticket",
      metricLabel: "Promedio del rango",
      text: `Se registraron ${formatNumber(employees.summary.unitsPerTicket)} articulos por ticket sobre ${formatInteger(employees.summary.tickets)} comprobantes con la cobertura disponible.`,
      bars: hours.weekdays.filter((row) => row.tickets > 0).map((row) => ({
        label: row.label,
        value: row.unitsPerTicket,
        detail: `${formatInteger(row.tickets)} tickets`
      }))
    };
  }

  if (question.includes("ticket promedio") || question.includes("promedio por ticket") || question.includes("gasto promedio")) {
    return {
      title: "Ticket promedio",
      metricLabel: "Importe promedio",
      text: `El ticket promedio del periodo es ${formatCurrency(employees.summary.averageTicket)}, calculado sobre ${formatInteger(employees.summary.tickets)} tickets.`,
      bars: hours.weekdays.filter((row) => row.tickets > 0).map((row) => ({
        label: row.label,
        value: row.averageTicket,
        detail: `${formatInteger(row.tickets)} tickets`
      }))
    };
  }

  if (question.includes("comprobante") || question.includes("pedido") || question.includes("ticket")) {
    return {
      title: "Comprobantes y pedidos",
      metricLabel: "Tickets",
      text: `En el rango hay ${formatInteger(employees.summary.documents)} comprobantes y ${formatInteger(employees.summary.tickets)} tickets de venta activos.`,
      bars: hours.weekdays.filter((row) => row.tickets > 0).map((row) => ({
        label: row.label,
        value: row.tickets,
        detail: formatCurrency(row.revenue)
      }))
    };
  }

  if (question.includes("empleado") || question.includes("persona") || question.includes("turno")) {
    const rows = employees.segments.filter((row) => row.tickets > 0).slice(0, 8);
    const leader = rows[0];
    return {
      title: "Venta por empleado",
      metricLabel: "Venta atribuida por grilla",
      text: leader
        ? `${leader.label} lidera el periodo con ${formatCurrency(leader.revenue)} y ${formatInteger(leader.tickets)} tickets. Si hay turnos superpuestos, la venta se atribuye completa a cada persona que estaba trabajando en esa hora.`
        : "No hay ventas atribuidas a empleados en el periodo actual.",
      bars: rows.map((row) => ({
        label: row.label,
        value: row.revenue,
        detail: `${formatInteger(row.tickets)} tickets`
      }))
    };
  }

  if (question.includes("hora") || question.includes("horario")) {
    const rows = [...hours.hours].filter((row) => row.tickets > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const leader = rows[0];
    return {
      title: "Horas fuertes",
      metricLabel: "Venta por hora",
      text: leader
        ? `La hora mas fuerte es ${leader.label}, con ${formatCurrency(leader.revenue)} y ${formatInteger(leader.tickets)} tickets. Para dimensionar demanda, tambien mira tickets/dia: ${formatNumber(leader.ticketsPerDay)}.`
        : "No hay ventas con hora cargada para este periodo.",
      bars: rows.map((row) => ({
        label: row.label,
        value: row.revenue,
        detail: `${formatInteger(row.tickets)} tickets`
      }))
    };
  }

  if (question.includes("dia") || question.includes("semana") || question.includes("fecha")) {
    const rows = [...hours.weekdays].filter((row) => row.tickets > 0).sort((a, b) => b.revenuePerDay - a.revenuePerDay);
    const leader = rows[0];
    return {
      title: "Dias fuertes",
      metricLabel: "Venta promedio por dia",
      text: leader
        ? `${leader.label} es el dia de semana mas fuerte, con ${formatCurrency(leader.revenuePerDay)} de venta promedio y ${formatNumber(leader.ticketsPerDay)} tickets por jornada observada.`
        : "No hay dias con ventas suficientes en el periodo.",
      bars: rows.map((row) => ({
        label: row.label,
        value: row.revenuePerDay,
        detail: `${formatNumber(row.ticketsPerDay)} tickets/dia`
      }))
    };
  }

  if (question.includes("merma") || question.includes("desperdicio")) {
    const rows = [...products.products]
      .filter((row) => row.wasteCost > 0 || row.wasteRate > 0)
      .sort((a, b) => b.wasteCost - a.wasteCost || b.wasteRate - a.wasteRate)
      .slice(0, 8);
    const leader = rows[0];
    return {
      title: "Productos con merma",
      metricLabel: "Costo de merma",
      text: leader
        ? `${leader.label} es el producto con mas merma asociada: ${formatCurrency(leader.wasteCost)} (${formatPercent(leader.wasteRate)} sobre venta).`
        : "No aparecen mermas asociadas a productos en el periodo actual.",
      bars: rows.map((row) => ({
        label: row.label,
        value: row.wasteCost,
        detail: `${formatPercent(row.wasteRate)} merma/venta`
      }))
    };
  }

  if (question.includes("cafe") || question.includes("cafes") || question.includes("café") || question.includes("cafés")) {
    const rows = products.products
      .filter((row) => normalize(row.label).includes("cafe"))
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
      .slice(0, 8);
    const total = rows.reduce((sum, row) => sum + row.quantitySold, 0);
    return {
      title: "Cafe vendido",
      metricLabel: "Unidades",
      text: rows.length
        ? `En el periodo se registran ${formatNumber(total)} unidades en productos que contienen la palabra cafe. El mas vendido es ${rows[0].label}.`
        : "No encontre productos con la palabra cafe en el detalle cargado del periodo.",
      bars: rows.map((row) => ({
        label: row.label,
        value: row.quantitySold,
        detail: formatCurrency(row.revenue)
      }))
    };
  }

  const mentionedProducts = products.products
    .filter((row) => {
      const label = normalize(row.label);
      return label.length >= 4 && question.includes(label);
    })
    .sort((a, b) => b.label.length - a.label.length)
    .slice(0, question.includes("compar") ? 5 : 1);
  if (mentionedProducts.length > 0) {
    const totalUnits = mentionedProducts.reduce((total, row) => total + row.quantitySold, 0);
    const totalRevenue = mentionedProducts.reduce((total, row) => total + row.revenue, 0);
    return {
      title: mentionedProducts.length > 1 ? "Comparacion de productos" : mentionedProducts[0].label,
      metricLabel: "Articulos vendidos",
      text: mentionedProducts.length > 1
        ? `Los productos encontrados suman ${formatNumber(totalUnits)} articulos y ${formatCurrency(totalRevenue)} de venta en el rango.`
        : `${mentionedProducts[0].label} registro ${formatNumber(totalUnits)} articulos, ${formatCurrency(totalRevenue)} de venta y presencia en ${formatInteger(mentionedProducts[0].tickets)} tickets.`,
      bars: mentionedProducts.map((row) => ({
        label: row.label,
        value: row.quantitySold,
        detail: `${formatCurrency(row.revenue)} - ${formatInteger(row.tickets)} tickets`
      }))
    };
  }

  const rows = [...products.products].filter((row) => row.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const leader = rows[0];
  return {
    title: "Top productos",
    metricLabel: "Venta",
    text: leader
      ? `${leader.label} lidera el ranking con ${formatCurrency(leader.revenue)}, ${formatNumber(leader.quantitySold)} unidades y ${formatInteger(leader.tickets)} tickets.`
      : "Todavia no hay productos vendidos en el periodo actual.",
    bars: rows.map((row) => ({
      label: row.label,
      value: row.revenue,
      detail: `${formatNumber(row.quantitySold)} unidades`
    }))
  };
}

function AiBars({ bars }: { bars: AiBar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  if (bars.length === 0) return <p className="muted-text">Sin datos suficientes para graficar.</p>;

  return (
    <div className="ai-bars">
      {bars.map((bar) => (
        <div className="ai-bar-row" key={bar.label}>
          <span>{bar.label}</span>
          <div>
            <i style={{ width: `${Math.max(4, (bar.value / max) * 100)}%` }} />
          </div>
          <strong>{formatCompact(bar.value)}</strong>
          <small>{bar.detail}</small>
        </div>
      ))}
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

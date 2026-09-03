import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Clock3,
  Database,
  FileSpreadsheet,
  Store,
  Trash2,
  TrendingUp,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, type DashboardOverview, type FinanceDashboard, type MeResponse, type SalesSummary } from "../api";

export function DashboardPage() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeResponse>("/api/auth/me")
  });
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => api<DashboardOverview>("/api/dashboard/overview")
  });
  const day = today();
  const month = day.slice(0, 7);
  const todaySales = useQuery({
    queryKey: ["sales-summary", day, day],
    queryFn: () => api<SalesSummary>(`/api/sales/summary?from=${day}&to=${day}`)
  });
  const finance = useQuery({
    queryKey: ["finance-dashboard", month, day],
    queryFn: () => api<FinanceDashboard>(`/api/finance/dashboard?month=${month}&date=${day}`)
  });

  const counts = overview.data?.counts;
  const user = me.data?.user;
  const branchName = branchDisplayName(me.data?.branches[0]?.name);
  const daySummary = todaySales.data?.summary;
  const ticketsPerHour = ticketsPerOperatingHour(day, daySummary?.tickets ?? 0);
  const projection = finance.data?.summary.projection ?? 0;

  return (
    <section className="page-section dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">Panel operativo</span>
          <h1>{user ? `Hola, ${user.name}` : "Inicio"}</h1>
          <p>{longDate(day)} - {overview.data?.dataStatus ?? "Datos operativos conectados"}</p>
        </div>
        <div className="dashboard-branch-panel">
          <span>Sucursal activa</span>
          <div className="branch-selector">
            <label>
              <select value="juramento" onChange={() => undefined}>
                <option value="juramento">{branchName}</option>
              </select>
            </label>
          </div>
          <small>ARS - Base online</small>
        </div>
      </div>

      <div className="kpi-grid dashboard-priority-grid">
        <Kpi icon={BadgeDollarSign} label="Venta hoy" value={formatCurrency(daySummary?.netSales ?? 0)} tone="red" />
        <Kpi icon={Clock3} label="Tickets por hora" value={formatNumber(ticketsPerHour)} tone="blue" />
        <Kpi icon={BarChart3} label="Ticket promedio" value={formatCurrency(daySummary?.averageTicket ?? 0)} tone="green" />
        <Kpi icon={TrendingUp} label="Proyeccion mes" value={formatCurrency(projection)} tone="amber" />
      </div>

      <div className="dashboard-action-grid">
        <QuickLink to="/ventas" icon={BadgeDollarSign} label="Ver ventas" detail="Dia, productos y horarios" />
        <QuickLink to="/gastos" icon={FileSpreadsheet} label="Cargar gastos" detail="Pagos, pendientes y retiros" />
        <QuickLink to="/cashflow" icon={BarChart3} label="Cashflow" detail="Saldos y movimientos" />
        <QuickLink to="/importaciones" icon={Database} label="Importar" detail="Dulce Hora y portales" />
      </div>

      <div className="content-band dashboard-status-band">
        <div>
          <h2>Estado de datos</h2>
          <p className="muted-text">Lectura rapida de la base online.</p>
        </div>
        <div className="dashboard-status-grid">
          <Status icon={Store} label="Sucursales" value={counts?.branches ?? 0} />
          <Status icon={Users} label="Usuarios" value={counts?.users ?? 0} />
          <Status icon={Database} label="Comprobantes" value={counts?.salesDocuments ?? 0} />
          <Status icon={FileSpreadsheet} label="Importaciones" value={counts?.imports ?? 0} />
          <Status icon={Trash2} label="Mermas" value={counts?.wasteRecords ?? 0} />
        </div>
      </div>
    </section>
  );
}

type KpiProps = {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "red" | "blue" | "green" | "amber" | "slate";
};

function Kpi({ icon: Icon, label, value, tone }: KpiProps) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  detail
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  detail: string;
}) {
  return (
    <Link className="dashboard-action-card" to={to}>
      <Icon size={20} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

function Status({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <span className="dashboard-status-item">
      <Icon size={17} aria-hidden="true" />
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function branchDisplayName(name: string | undefined) {
  if (!name) return "JURAMENTO - Villa Urquiza";
  return name.toLowerCase().includes("juramento") ? name : `JURAMENTO - ${name}`;
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

function longDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function ticketsPerOperatingHour(value: string, tickets: number) {
  const elapsed = operatingHoursElapsed(value);
  return elapsed > 0 ? tickets / elapsed : 0;
}

function operatingHoursElapsed(value: string) {
  const { open, close } = businessHoursForDate(value);
  const todayValue = today();
  if (value > todayValue) return 0;
  if (value < todayValue) return Math.max(0, (close - open) / 60);

  const now = currentArgentinaMinutes();
  const current = Math.min(close, Math.max(open, now));
  return Math.max(0, (current - open) / 60);
}

function businessHoursForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 ? { open: 8 * 60, close: 19 * 60 } : { open: 7 * 60 + 30, close: 19 * 60 + 30 };
}

function currentArgentinaMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

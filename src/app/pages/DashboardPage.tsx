import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Database,
  FileSpreadsheet,
  ReceiptText,
  Store,
  Trash2,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, type DashboardOverview, type MeResponse, type SalesSummary } from "../api";
import { dulceHoraLogo } from "../brand";

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
  const monthFrom = monthStart(day);
  const todaySales = useQuery({
    queryKey: ["sales-summary", day, day],
    queryFn: () => api<SalesSummary>(`/api/sales/summary?from=${day}&to=${day}`)
  });
  const monthSales = useQuery({
    queryKey: ["sales-summary", monthFrom, day],
    queryFn: () => api<SalesSummary>(`/api/sales/summary?from=${monthFrom}&to=${day}`)
  });

  const counts = overview.data?.counts;
  const user = me.data?.user;
  const branchName = branchDisplayName(me.data?.branches[0]?.name);
  const daySummary = todaySales.data?.summary;
  const monthSummary = monthSales.data?.summary;

  return (
    <section className="page-section dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">Dulce Hora Control</span>
          <h1>{user ? `Hola, ${user.name}` : "Inicio"}</h1>
          <p>{overview.data?.dataStatus ?? "Datos operativos conectados"}</p>
          <div className="branch-selector">
            <label>
              Sucursal
              <select value="juramento" onChange={() => undefined}>
                <option value="juramento">{branchName}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="dashboard-logo-panel">
          <img src={dulceHoraLogo} alt="" />
          <strong>JURAMENTO</strong>
          <span>Villa Urquiza</span>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi icon={BadgeDollarSign} label="Venta hoy" value={formatCurrency(daySummary?.netSales ?? 0)} tone="red" />
        <Kpi icon={ReceiptText} label="Tickets hoy" value={daySummary?.tickets ?? 0} tone="blue" />
        <Kpi icon={BarChart3} label="Ticket promedio" value={formatCurrency(daySummary?.averageTicket ?? 0)} tone="green" />
        <Kpi icon={CalendarDays} label="Venta mes" value={formatCurrency(monthSummary?.netSales ?? 0)} tone="amber" />
        <Kpi
          icon={Database}
          label="Detalle productos"
          value={`${Math.round((daySummary?.itemDetailCoverage ?? 1) * 100)}%`}
          tone="slate"
        />
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

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

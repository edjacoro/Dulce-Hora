import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database, FileSpreadsheet, Store, Trash2, Users } from "lucide-react";
import { api, type DashboardOverview } from "../api";

export function DashboardPage() {
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => api<DashboardOverview>("/api/dashboard/overview")
  });

  const counts = overview.data?.counts;

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Inicio</h1>
          <p>{overview.data?.dataStatus ?? "Cargando estado"}</p>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi icon={Store} label="Sucursales" value={counts?.branches ?? 0} tone="red" />
        <Kpi icon={Users} label="Usuarios" value={counts?.users ?? 0} tone="blue" />
        <Kpi
          icon={Database}
          label="Comprobantes"
          value={counts?.salesDocuments ?? 0}
          tone="green"
        />
        <Kpi icon={FileSpreadsheet} label="Importaciones" value={counts?.imports ?? 0} tone="amber" />
        <Kpi icon={Trash2} label="Mermas" value={counts?.wasteRecords ?? 0} tone="slate" />
      </div>

      <div className="content-band">
        <div className="empty-state">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <h2>Datos operativos</h2>
            <p>Importaciones sincroniza facturacion y mermas desde el panel de Dulce Hora.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type KpiProps = {
  icon: React.ElementType;
  label: string;
  value: number;
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

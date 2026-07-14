import { useQuery } from "@tanstack/react-query";
import { Building2, ListChecks, Users } from "lucide-react";
import { api } from "../api";

type SettingsResponse = {
  users: Array<{ id: string; name: string; email: string; role: string; active: boolean; avatar_url: string | null }>;
  branches: Array<{ id: string; name: string; address: string | null; external_code: string | null }>;
  categories: Array<{ id: string; name: string; target_margin: string | null; active: boolean }>;
  expenseCategories: Array<{ id: string; name: string; pnl_group: string }>;
  auditLogs: Array<{ action: string; entity: string; entity_id: string; created_at: string }>;
};

export function SettingsPage() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsResponse>("/api/settings")
  });

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Ajustes</h1>
          <p>Base local inicial</p>
        </div>
      </div>

      <div className="settings-grid">
        <Panel title="Sucursales" icon={Building2}>
          {settings.data?.branches.map((branch) => (
            <div className="list-row" key={branch.id}>
              <strong>{branch.name}</strong>
              <span>{branch.external_code ?? "Sin codigo externo"}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Usuarios" icon={Users}>
          {settings.data?.users.map((user) => (
            <div className="list-row" key={user.id}>
              <div className="settings-user-row">
                {user.avatar_url ? <img className="user-avatar" src={user.avatar_url} alt="" /> : <Users size={22} />}
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    {user.email} - {user.role}
                  </small>
                </span>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Categorias de producto" icon={ListChecks}>
          {settings.data?.categories.map((category) => (
            <div className="list-row" key={category.id}>
              <strong>{category.name}</strong>
              <span>{category.active ? "Activa" : "Inactiva"}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Categorias de gasto" icon={ListChecks}>
          {settings.data?.expenseCategories.map((category) => (
            <div className="list-row" key={category.id}>
              <strong>{category.name}</strong>
              <span>{category.pnl_group}</span>
            </div>
          ))}
        </Panel>
      </div>
    </section>
  );
}

function Panel({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="content-band compact-band">
      <h2>
        <Icon size={18} aria-hidden="true" />
        {title}
      </h2>
      <div className="list-stack">{children}</div>
    </section>
  );
}

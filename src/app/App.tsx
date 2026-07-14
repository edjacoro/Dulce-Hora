import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Home,
  Landmark,
  LineChart,
  LogOut,
  PackageSearch,
  IdCard,
  Settings,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api, type MeResponse, type SetupStatus } from "./api";
import { dulceHoraLogo } from "./brand";
import { DashboardPage } from "./pages/DashboardPage";
import { CashflowPage } from "./pages/CashflowPage";
import { EmployeeFilesPage } from "./pages/EmployeeFilesPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { FinancePage } from "./pages/FinancePage";
import { HoursPage } from "./pages/HoursPage";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SalesPage } from "./pages/SalesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { WastePage } from "./pages/WastePage";

const navItems = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: BadgeDollarSign },
  { to: "/productos", label: "Productos", icon: PackageSearch },
  { to: "/horarios", label: "Horarios", icon: BarChart3 },
  { to: "/grilla", label: "Grilla", icon: CalendarDays },
  { to: "/fichas", label: "Fichas", icon: IdCard },
  { to: "/gastos", label: "Gastos", icon: ClipboardList },
  { to: "/mermas", label: "Mermas", icon: Trash2 },
  { to: "/finanzas", label: "Finanzas", icon: LineChart },
  { to: "/cashflow", label: "Cashflow", icon: Landmark },
  { to: "/importaciones", label: "Importaciones", icon: FileSpreadsheet },
  { to: "/ajustes", label: "Ajustes", icon: Settings }
];

export function App() {
  const queryClient = useQueryClient();
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => api<SetupStatus>("/api/setup/status")
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeResponse>("/api/auth/me"),
    enabled: setup.data?.required === false,
    retry: false
  });

  const logout = useMutation({
    mutationFn: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  if (setup.isLoading) {
    return <Splash text="Preparando Dulce Hora Control" />;
  }

  if (setup.isError) {
    return <Splash text="No se pudo conectar con el backend local" />;
  }

  if (setup.data?.required) {
    return <SetupPage />;
  }

  if (me.isLoading) {
    return <Splash text="Verificando sesion" />;
  }

  if (!me.data) {
    return <LoginPage />;
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={dulceHoraLogo} alt="" />
          <span>
            <strong>Dulce Hora</strong>
            <small>Control</small>
          </span>
        </div>

        <nav className="nav-list" aria-label="Principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            {me.data.user.avatar_url ? (
              <img className="user-avatar" src={me.data.user.avatar_url} alt="" />
            ) : (
              <ShieldCheck size={18} aria-hidden="true" />
            )}
            <span>
              <strong>{me.data.user.name}</strong>
              <small>{roleLabel(me.data.user.role)}</small>
            </span>
          </div>
          <button className="icon-text-button" onClick={() => logout.mutate()} type="button">
            <LogOut size={18} aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <img className="topbar-logo" src={dulceHoraLogo} alt="" />
          <div>
            <strong>{me.data.organization.name}</strong>
            <small>
              {me.data.branches[0]?.name ?? "Sin sucursal"} - {me.data.organization.currency}
            </small>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/horarios" element={<HoursPage />} />
          <Route path="/grilla" element={<SchedulePage />} />
          <Route path="/fichas" element={<EmployeeFilesPage />} />
          <Route path="/gastos" element={<ExpensesPage />} />
          <Route path="/mermas" element={<WastePage />} />
          <Route path="/finanzas" element={<FinancePage />} />
          <Route path="/cashflow" element={<CashflowPage />} />
          <Route path="/importaciones" element={<IntegrationPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div className="auth-screen">
      <div className="auth-panel compact">
        <img className="auth-logo compact-logo" src={dulceHoraLogo} alt="" />
        <p>{text}</p>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: "Dueno",
    administrator: "Administrador",
    manager: "Encargado",
    viewer: "Lectura"
  };
  return labels[role] ?? role;
}

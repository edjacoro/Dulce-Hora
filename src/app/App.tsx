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
import { useEffect } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api, type DashboardOverview, type MeResponse, type ScheduleResponse, type SetupStatus } from "./api";
import { dulceHoraLogo } from "./brand";
import { AnalysisPage } from "./pages/AnalysisPage";
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
import { canRunDulceHoraDateSyncFromThisHost } from "./runtime";
import { hydrateDulceHoraDetailsUntilDone, invalidateDulceHoraReporting } from "./dulceHoraDetails";
import { DulceHoraImportJobBanner, DulceHoraImportJobProvider } from "./dulceHoraImportJob";

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
  { to: "/analisis", label: "Analisis", icon: BarChart3 },
  { to: "/importaciones", label: "Importaciones", icon: FileSpreadsheet },
  { to: "/ajustes", label: "Ajustes", icon: Settings }
];

const EXPENSES_IMPORT_SESSION_KEY = "dulce-hora-auto-expenses-import-started-v2";

export function App() {
  const queryClient = useQueryClient();
  const canRunDulceHoraTodaySync = canRunDulceHoraDateSyncFromThisHost(todayArgentina());
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
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => api<DashboardOverview>("/api/dashboard/overview"),
    enabled: setup.data?.required === false && Boolean(me.data),
    retry: false
  });
  useQuery({
    queryKey: ["schedule-bootstrap", currentMonthArgentina()],
    queryFn: () => api<ScheduleResponse>(`/api/schedule?month=${currentMonthArgentina()}`),
    enabled: setup.data?.required === false && Boolean(me.data),
    retry: false,
    staleTime: 5 * 60 * 1000
  });

  const logout = useMutation({
    mutationFn: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });
  const autoExpensesImport = useMutation({
    mutationFn: () =>
      api<{ rowsReceived: number; rowsCreated: number; rowsUpdated: number }>("/api/imports/expenses-sheet", {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["expense-categories"] })
      ]);
    },
    onError: () => {
      window.sessionStorage.removeItem(EXPENSES_IMPORT_SESSION_KEY);
    }
  });

  useEffect(() => {
    if (!me.data || !overview.data || overview.data.counts.expenses > 0) return;
    if (autoExpensesImport.status !== "idle" || window.sessionStorage.getItem(EXPENSES_IMPORT_SESSION_KEY)) return;
    window.sessionStorage.setItem(EXPENSES_IMPORT_SESSION_KEY, "true");
    autoExpensesImport.mutate();
  }, [autoExpensesImport, me.data, overview.data]);

  useEffect(() => {
    if (!canRunDulceHoraTodaySync || !me.data) return;

    let cancelled = false;
    let running = false;

    const syncToday = async () => {
      if (running) return;
      running = true;
      const syncDate = todayArgentina();
      try {
        await api("/api/integration/dulce-hora/sync-date", {
          method: "POST",
          body: JSON.stringify({ date: syncDate, includeWaste: false, includeStatistics: false })
        });
        if (!cancelled) {
          await invalidateDulceHoraReporting(queryClient);
        }
        void hydrateDulceHoraDetailsUntilDone({
          date: syncDate,
          queryClient,
          limit: 3,
          maxRuns: 8,
          shouldContinue: () => !cancelled
        }).catch((error) => {
          console.warn("[dulce-hora] No se pudo completar productos automaticamente", error);
        });
      } catch (error) {
        console.warn("[dulce-hora] No se pudo sincronizar automaticamente el dia", error);
      } finally {
        running = false;
      }
    };

    void syncToday();
    const intervalId = window.setInterval(() => {
      void syncToday();
    }, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canRunDulceHoraTodaySync, me.data, queryClient]);

  if (setup.isLoading) {
    return <Splash text="Preparando Dulce Hora Control" />;
  }

  if (setup.isError) {
    return <Splash text="No se pudo conectar con el backend de la app" />;
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
        <DulceHoraImportJobProvider>
          <header className="topbar">
            <img className="topbar-logo" src={dulceHoraLogo} alt="" />
            <div>
              <strong>{me.data.organization.name}</strong>
              <small>
                {me.data.branches[0]?.name ?? "Sin sucursal"} - {me.data.organization.currency}
              </small>
            </div>
          </header>

          <div className="main-content">
            <DulceHoraImportJobBanner />

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
              <Route path="/analisis" element={<AnalysisPage />} />
              <Route path="/importaciones" element={<IntegrationPage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </DulceHoraImportJobProvider>
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

function currentMonthArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Home,
  Landmark,
  LineChart,
  LogOut,
  IdCard,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, type DashboardOverview, type MeResponse, type ScheduleResponse, type SetupStatus } from "./api";
import { dulceHoraLogo } from "./brand";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DulceHoraImportJobBanner, DulceHoraImportJobProvider } from "./dulceHoraImportJob";
import { BranchScopeProvider, formatBranchName, useBranchScope } from "./branchScope";

const AiPage = lazy(() => import("./pages/AiPage").then((module) => ({ default: module.AiPage })));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage").then((module) => ({ default: module.AnalysisPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const CashflowPage = lazy(() => import("./pages/CashflowPage").then((module) => ({ default: module.CashflowPage })));
const EmployeeFilesPage = lazy(() => import("./pages/EmployeeFilesPage").then((module) => ({ default: module.EmployeeFilesPage })));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage").then((module) => ({ default: module.ExpensesPage })));
const FinancePage = lazy(() => import("./pages/FinancePage").then((module) => ({ default: module.FinancePage })));
const HoursPage = lazy(() => import("./pages/HoursPage").then((module) => ({ default: module.HoursPage })));
const IntegrationPage = lazy(() => import("./pages/IntegrationPage").then((module) => ({ default: module.IntegrationPage })));
const ProductsPage = lazy(() => import("./pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const SchedulePage = lazy(() => import("./pages/SchedulePage").then((module) => ({ default: module.SchedulePage })));
const SalesPage = lazy(() => import("./pages/SalesPage").then((module) => ({ default: module.SalesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const WastePage = lazy(() => import("./pages/WastePage").then((module) => ({ default: module.WastePage })));

const navItems = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: BadgeDollarSign },
  { to: "/grilla", label: "Grilla", icon: CalendarDays },
  { to: "/fichas", label: "Fichas", icon: IdCard },
  { to: "/gastos", label: "Gastos", icon: ClipboardList },
  { to: "/mermas", label: "Mermas", icon: Trash2 },
  { to: "/finanzas", label: "Finanzas", icon: LineChart },
  { to: "/cashflow", label: "Cashflow", icon: Landmark },
  { to: "/analisis", label: "Analisis", icon: BarChart3 },
  { to: "/ia", label: "Asistente", icon: BrainCircuit },
  { to: "/importaciones", label: "Importaciones", icon: FileSpreadsheet },
  { to: "/ajustes", label: "Ajustes", icon: Settings }
];

const mobilePrimaryNavItems = navItems.filter((item) => ["/", "/ventas", "/finanzas", "/grilla"].includes(item.to));
const mobileMoreNavItems = navItems.filter((item) => !mobilePrimaryNavItems.some((primary) => primary.to === item.to));

const EXPENSES_IMPORT_SESSION_KEY = "dulce-hora-auto-expenses-import-started-v2";

export function App() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
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
    <BranchScopeProvider branches={me.data.branches}>
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
              className={({ isActive }) =>
                `nav-item ${isActive || isSalesSectionActive(item.to, location.pathname) ? "active" : ""}`
              }
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
              <BranchScopeLabel currency={me.data.organization.currency} />
            </div>
            <BranchScopeSelector />
          </header>

          <div className="main-content">
            <DulceHoraImportJobBanner />

            <Suspense fallback={<PageLoading />}>
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
              <Route path="/ia" element={<AiPage />} />
              <Route path="/importaciones" element={<IntegrationPage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </div>
        </DulceHoraImportJobProvider>
      </main>

      {mobileMoreOpen ? (
        <>
          <button
            aria-label="Cerrar menu mobile"
            className="mobile-more-backdrop"
            onClick={() => setMobileMoreOpen(false)}
            type="button"
          />
          <section className="mobile-more-sheet" role="dialog" aria-label="Mas secciones">
            <div className="mobile-more-header">
              <div>
                <strong>Mas secciones</strong>
                <small>{formatBranchName(me.data.branches[0]?.name)}</small>
              </div>
              <button className="icon-only-button" onClick={() => setMobileMoreOpen(false)} type="button" aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mobile-more-grid">
              {mobileMoreNavItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `mobile-more-item ${isActive || isSalesSectionActive(item.to, location.pathname) ? "active" : ""}`
                  }
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="mobile-more-footer">
              <div className="user-chip mobile-user-chip">
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
          </section>
        </>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="Navegacion mobile">
        {mobilePrimaryNavItems.map((item) => (
          <NavLink
            className={() => `mobile-bottom-item ${isMobileNavActive(item.to, location.pathname) ? "active" : ""}`}
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setMobileMoreOpen(false)}
          >
            <item.icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          className={`mobile-bottom-item ${mobileMoreOpen || isMobileMoreActive(location.pathname) ? "active" : ""}`}
          onClick={() => setMobileMoreOpen((current) => !current)}
          type="button"
        >
          <MoreHorizontal size={19} aria-hidden="true" />
          <span>Mas</span>
        </button>
      </nav>
    </div>
    </BranchScopeProvider>
  );
}

function BranchScopeLabel({ currency }: { currency: string }) {
  const { branchName } = useBranchScope();
  return <small>{branchName} - {currency}</small>;
}

function BranchScopeSelector() {
  const { branchId, branches, setBranchId } = useBranchScope();
  return (
    <label className="branch-scope-selector">
      <span>Sucursal</span>
      <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{formatBranchName(branch.name)}</option>
        ))}
        {branches.length < 2 ? <option value="pending" disabled>Segunda sucursal - pendiente</option> : null}
        <option value="all">Consolidado</option>
      </select>
    </label>
  );
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando seccion...</div>;
}

function isSalesSectionActive(itemPath: string, currentPath: string) {
  return itemPath === "/ventas" && ["/ventas", "/productos", "/horarios"].some((path) => currentPath.startsWith(path));
}

function isMobileNavActive(itemPath: string, currentPath: string) {
  if (itemPath === "/") return currentPath === "/";
  if (itemPath === "/ventas") return ["/ventas", "/productos", "/horarios"].some((path) => currentPath.startsWith(path));
  return currentPath.startsWith(itemPath);
}

function isMobileMoreActive(currentPath: string) {
  return !mobilePrimaryNavItems.some((item) => isMobileNavActive(item.to, currentPath));
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

import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { to: "/ventas", label: "General" },
  { to: "/productos", label: "Productos" },
  { to: "/horarios", label: "Horarios" }
];

export function SalesSectionTabs() {
  const location = useLocation();

  return (
    <nav className="sales-section-tabs" aria-label="Ventas">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={{ pathname: tab.to, search: location.search }}
          className={({ isActive }) => `sales-section-tab ${isActive ? "active" : ""}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

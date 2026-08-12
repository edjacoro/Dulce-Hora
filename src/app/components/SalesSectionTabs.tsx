import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/ventas", label: "General" },
  { to: "/productos", label: "Productos" },
  { to: "/horarios", label: "Horarios" }
];

export function SalesSectionTabs() {
  return (
    <nav className="sales-section-tabs" aria-label="Ventas">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `sales-section-tab ${isActive ? "active" : ""}`}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

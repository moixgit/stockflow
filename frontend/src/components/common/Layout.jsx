import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TruckIcon,
  Warehouse,
  Users,
  Store,
  BarChart3,
  Tag,
  QrCode,
  LogOut,
  ChevronRight,
  Bell,
  Search,
  User,
  Menu,
  X,
  Boxes,
  Sparkles,
  Settings,
} from "lucide-react";

const navItems = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    roles: ["admin", "inventory_manager", "salesperson"],
    section: "main",
  },
  {
    to: "/pos",
    icon: ShoppingCart,
    label: "Point of Sale",
    roles: ["admin", "inventory_manager", "salesperson"],
    section: "main",
  },
  {
    to: "/products",
    icon: Package,
    label: "Products",
    roles: ["admin", "inventory_manager", "salesperson"],
    section: "inventory",
  },
  {
    to: "/inventory",
    icon: Boxes,
    label: "Inventory",
    roles: ["admin", "inventory_manager"],
    section: "inventory",
  },
  {
    to: "/categories",
    icon: Tag,
    label: "Categories",
    roles: ["admin", "inventory_manager"],
    section: "inventory",
  },
  {
    to: "/brands",
    icon: Sparkles,
    label: "Brands",
    roles: ["admin", "inventory_manager"],
    section: "inventory",
  },
  {
    to: "/warehouses",
    icon: Warehouse,
    label: "Warehouses",
    roles: ["admin", "inventory_manager"],
    section: "inventory",
  },
  {
    to: "/purchases",
    icon: TruckIcon,
    label: "Purchases",
    roles: ["admin", "inventory_manager"],
    section: "purchasing",
  },
  {
    to: "/vendors",
    icon: Store,
    label: "Vendors",
    roles: ["admin", "inventory_manager"],
    section: "purchasing",
  },
  {
    to: "/barcode",
    icon: QrCode,
    label: "Barcodes",
    roles: ["admin", "inventory_manager", "salesperson"],
    section: "tools",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    roles: ["admin", "inventory_manager"],
    section: "tools",
  },
  {
    to: "/users",
    icon: Users,
    label: "Users",
    roles: ["admin"],
    section: "admin",
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Store Settings",
    roles: ["admin"],
    section: "admin",
  },
];

const sections = [
  { id: "main", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "purchasing", label: "Purchasing" },
  { id: "tools", label: "Tools" },
  { id: "admin", label: "Administration" },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user?.role),
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="nav-logo">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img style={{ width: "220px" }} src="./logo-light.png" />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {sections.map((section) => {
            const items = visibleItems.filter((i) => i.section === section.id);
            if (!items.length) return null;
            return (
              <div key={section.id} className="nav-section">
                <div className="nav-section-label">{section.label}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                  >
                    <item.icon size={16} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-elevated)",
              marginBottom: 8,
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}
            >
              {user?.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {user?.role?.replace("_", " ")}
            </div>
          </div>
          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ color: "var(--red)" }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        <header className="header">
          <div className="flex-between w-full">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Welcome back,{" "}
                <span style={{ color: "var(--text)", fontWeight: 500 }}>
                  {user?.name}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--green)",
                    animation: "pulse 2s infinite",
                  }}
                />
                System Online
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {user?.name?.[0]}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

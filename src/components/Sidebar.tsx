import { useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: "diagnostic", label: "Diagnóstico", icon: "🔍" },
  { id: "output", label: "Resultados", icon: "📋" },
  { id: "settings", label: "Configuración", icon: "⚙️" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [active, setActive] = useState("diagnostic");

  return (
    <aside
      className={`flex flex-col bg-base-200 border-r border-base-300 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center h-14 px-3 border-b border-base-300">
        <button
          onClick={onToggle}
          className="btn btn-ghost btn-sm btn-square"
          aria-label="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        {!collapsed && (
          <span className="ml-3 font-semibold text-sm truncate text-secondary">
            MDA Toolkit
          </span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
              active === item.id
                ? "bg-primary/20 text-primary font-medium"
                : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-base-300">
        <div className={`text-xs text-base-content/40 truncate text-center ${collapsed ? "" : "px-2"}`}>
          {collapsed ? "v0.1" : "v0.1.0"}
        </div>
      </div>
    </aside>
  );
}

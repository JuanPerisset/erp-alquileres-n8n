import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV } from "./navConfig";

export const Marca = () => (
  <div className="flex items-center gap-3 px-5 py-6">
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brass font-display text-lg font-extrabold text-ink">P</div>
    <div className="leading-tight">
      <p className="font-display text-[15px] font-bold text-white">Perisset</p>
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Inmobiliaria</p>
    </div>
  </div>
);

export const SidebarNav = ({ onNavigate }) => (
  <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" data-testid="sidebar-nav">
    {NAV.map((g) => (
      <div key={g.grupo}>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/70">{g.grupo}</p>
        <ul className="space-y-0.5">
          {g.items.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                data-testid={`nav-link-${to === "/" ? "inicio" : to.slice(1)}`}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "border-brass bg-white/[0.07] font-medium text-white"
                    : "border-transparent text-ink-soft hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

export const Sidebar = () => (
  <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink lg:flex" data-testid="sidebar">
    <Marca />
    <SidebarNav />
    <p className="border-t border-ink-line px-5 py-4 text-[11px] text-ink-soft/70">Carcarañá · Rosario · Santa Fe</p>
  </aside>
);

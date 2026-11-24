import {
  LayoutDashboard, FileSpreadsheet, HandCoins, Printer, MessageSquareText, FileSignature,
  Users, UserRound, Building2, TrendingUp, Settings,
} from "lucide-react";

export const NAV = [
  { grupo: "General", items: [{ to: "/", label: "Panel", icon: LayoutDashboard, end: true }] },
  {
    grupo: "Gestión mensual",
    items: [
      { to: "/liquidaciones", label: "Liquidaciones", icon: FileSpreadsheet },
      { to: "/pagos-propietarios", label: "Pagos a propietarios", icon: HandCoins },
      { to: "/impresion", label: "Centro de impresión", icon: Printer },
      { to: "/comunicaciones", label: "Comunicaciones", icon: MessageSquareText },
    ],
  },
  {
    grupo: "Cartera",
    items: [
      { to: "/contratos", label: "Contratos", icon: FileSignature },
      { to: "/inquilinos", label: "Inquilinos", icon: Users },
      { to: "/propietarios", label: "Propietarios", icon: UserRound },
      { to: "/propiedades", label: "Propiedades", icon: Building2 },
      { to: "/actualizaciones", label: "Actualizaciones", icon: TrendingUp },
    ],
  },
  { grupo: "Sistema", items: [{ to: "/configuracion", label: "Configuración", icon: Settings }] },
];

export const SECCIONES_PENDIENTES = {};

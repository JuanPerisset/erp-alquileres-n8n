import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Sidebar, SidebarNav, Marca } from "./Sidebar";

const ROL_LABEL = { administrador: "Administrador/a", operadora: "Operadora" };

const UserBox = () => {
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium" data-testid="current-user-name">{user.nombre}</p>
        <p className="text-xs text-muted-foreground" data-testid="current-user-role">{ROL_LABEL[user.rol]}</p>
      </div>
      <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button" className="active:scale-95">
        <LogOut className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Salir</span>
      </Button>
    </div>
  );
};

export default function AppLayout() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar />
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="left" className="flex w-64 flex-col border-none bg-ink p-0" data-testid="mobile-sidebar">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <Marca />
          <SidebarNav onNavigate={() => setAbierto(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md sm:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setAbierto(true)}
            aria-label="Abrir menú" data-testid="mobile-menu-button">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="hidden font-display text-sm font-semibold text-muted-foreground lg:block">Administración de alquileres</span>
          <UserBox />
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

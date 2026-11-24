import { useLocation } from "react-router-dom";
import { Hammer, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SECCIONES_PENDIENTES } from "@/components/layout/navConfig";

export default function EnConstruccion() {
  const { pathname } = useLocation();
  const s = SECCIONES_PENDIENTES[pathname];
  return (
    <div>
      <PageHeader eyebrow={`Etapa ${s.etapa}`} titulo={s.titulo} />
      <div className="max-w-2xl rounded-lg border bg-card p-6 fade-up" data-testid="seccion-pendiente">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Hammer className="h-4 w-4 text-brass" /> Esta pantalla se construye en la Etapa {s.etapa}.
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {s.incluye.map((i) => (
            <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

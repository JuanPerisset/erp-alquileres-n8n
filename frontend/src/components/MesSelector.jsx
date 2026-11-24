import { useSearchParams } from "react-router-dom";
import { addMonths, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMes } from "@/lib/format";

const mesActual = () => format(new Date(), "yyyy-MM-01");

export function useMes() {
  const [params, setParams] = useSearchParams();
  const p = params.get("mes") || "";
  const mes = /^\d{4}-\d{2}-01$/.test(p) ? p : mesActual();
  return [mes, (m) => setParams({ mes: m })];
}

export const MesSelector = ({ mes, onChange }) => {
  const mover = (n) => onChange(format(addMonths(parseISO(mes), n), "yyyy-MM-01"));
  return (
    <div className="flex items-center gap-1 rounded-md border bg-white p-1" data-testid="mes-selector">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(-1)} aria-label="Mes anterior" data-testid="mes-prev"><ChevronLeft className="h-4 w-4" /></Button>
      <span className="min-w-[140px] text-center font-display text-sm font-semibold" data-testid="mes-actual">{fmtMes(mes)}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(1)} aria-label="Mes siguiente" data-testid="mes-next"><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
};

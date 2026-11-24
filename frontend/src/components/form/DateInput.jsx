import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { es } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtFecha } from "@/lib/format";

const mascara = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
};

const aIso = (t) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
};

const texto = (iso) => (iso ? fmtFecha(iso) : "");

// Siempre muestra dd/mm/aaaa; emite ISO (AAAA-MM-DD) o "" si está vacío/incompleto/fuera de rango (min/max ISO opcional).
export function DateInput({ value, onChange, testId, disabled, min, max }) {
  const [t, setT] = useState(texto(value));
  const [invalida, setInvalida] = useState("");
  const validar = (txt) => {
    if (!txt) return "";
    const iso = aIso(txt);
    if (!iso) return "Fecha inválida (dd/mm/aaaa)";
    if (min && iso < min) return `La fecha no puede ser anterior al ${fmtFecha(min)}`;
    return max && iso > max ? `La fecha no puede ser posterior al ${fmtFecha(max)}` : "";
  };
  const [abierto, setAbierto] = useState(false);
  const emitido = useRef(value);

  useEffect(() => {
    if (value !== emitido.current) { emitido.current = value; setT(texto(value)); setInvalida(""); }
  }, [value]);

  const emitir = (v) => { emitido.current = v; onChange(v); };

  const cambiar = (e) => {
    const nuevo = mascara(e.target.value);
    setT(nuevo);
    const err = nuevo.length === 10 ? validar(nuevo) : "";
    setInvalida(err);
    emitir(nuevo.length === 10 && !err ? aIso(nuevo) : "");
  };

  const elegir = (fecha) => {
    if (!fecha) return;
    const iso = format(fecha, "yyyy-MM-dd");
    setT(texto(iso)); setInvalida(""); emitir(iso); setAbierto(false);
  };

  return (
    <div>
      <div className="flex gap-1.5">
        <Input value={t} onChange={cambiar} onBlur={() => setInvalida(validar(t))} placeholder="dd/mm/aaaa"
          inputMode="numeric" disabled={disabled} data-testid={testId} className={invalida ? "border-red-400" : ""} />
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={disabled}
              aria-label="Abrir calendario" data-testid={testId ? `${testId}-calendario` : undefined}>
              <CalendarDays className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto bg-white p-0" align="end">
            <Calendar mode="single" locale={es} selected={value ? parseISO(value) : undefined}
              defaultMonth={value ? parseISO(value) : undefined} onSelect={elegir} initialFocus
              disabled={{
                ...(min ? { before: parseISO(min) } : {}),
                ...(max ? { after: parseISO(max) } : {}),
              }} />
          </PopoverContent>
        </Popover>
      </div>
      {invalida && <p className="mt-1 text-xs text-red-700" data-testid={testId ? `${testId}-error` : undefined}>{invalida}</p>}
    </div>
  );
}

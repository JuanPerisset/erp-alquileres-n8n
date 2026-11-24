import { cn } from "@/lib/utils";

export const VARIANTES = {
  verde: "bg-green-100 text-green-800 border-green-200",
  amarillo: "bg-amber-100 text-amber-800 border-amber-200",
  azul: "bg-blue-100 text-blue-800 border-blue-200",
  rojo: "bg-red-100 text-red-800 border-red-200",
  gris: "bg-slate-100 text-slate-800 border-slate-200",
};

// El texto siempre viene de las tablas de catálogo; acá solo se elige el color.
const COLOR_POR_NOMBRE = {
  pagado: "verde", pagada: "verde", cobrado: "verde", activo: "verde", alquilada: "verde", enviado: "verde",
  pendiente: "amarillo", borrador: "amarillo", cargado: "amarillo",
  confirmada: "azul", confirmado: "azul", disponible: "azul",
  moroso: "rojo", vencido: "rojo", vencida: "rojo", error: "rojo", fallido: "rojo",
  inactivo: "gris", inactiva: "gris",
};

export const StatusBadge = ({ nombre, variante, className, testId }) => {
  const color = variante || COLOR_POR_NOMBRE[String(nombre || "").trim().toLowerCase()] || "gris";
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize leading-5",
        VARIANTES[color], className
      )}
    >
      {nombre || "—"}
    </span>
  );
};

import { addMonths, format, parseISO } from "date-fns";

export const INDICES = ["IPC", "ICL", "Casa Propia"];
export const MONEDAS = ["ARS", "USD"];

export function diasHasta(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const hoy = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
}

export const idEstado = (lista, nombre) => lista?.find((e) => e.nombre.toLowerCase() === nombre)?.id;

export const sumarMeses = (iso, n) => format(addMonths(parseISO(iso), Number(n)), "yyyy-MM-dd");

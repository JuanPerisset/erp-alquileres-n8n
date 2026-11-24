import { parsePhoneNumberFromString } from "libphonenumber-js";

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoneda(valor, moneda = "ARS") {
  const n = Number(valor || 0);
  const prefijo = moneda === "USD" ? "US$" : "$";
  return `${n < 0 ? "-" : ""}${prefijo} ${nf.format(Math.abs(n))}`;
}

export function fmtNumero(valor, decimales = 2) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    .format(Number(valor || 0));
}

export function fmtFecha(valor) {
  if (!valor) return "—";
  const [y, m, d] = String(valor).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtFechaHora(valor) {
  if (!valor) return "—";
  const s = String(valor);
  return `${fmtFecha(s)} ${s.slice(11, 16)}`;
}

export function fmtMes(valor) {
  if (!valor) return "—";
  const [y, m] = String(valor).slice(0, 7).split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function fmtCelular(valor) {
  if (!valor) return "—";
  const p = parsePhoneNumberFromString(`+${String(valor).replace(/\D/g, "")}`);
  return p?.isValid() ? p.formatInternational() : valor;
}

export function nombresAgrupados(personas = []) {
  return [...personas]
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es"))
    .map((p) => `${p.apellido} ${p.nombre}`)
    .join(" y ");
}

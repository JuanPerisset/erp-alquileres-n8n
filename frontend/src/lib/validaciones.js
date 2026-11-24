const digitos = (v) => String(v || "").replace(/\D/g, "");

// original: valores guardados; el celular solo se valida si cambió (los ya cargados no se transforman).
export function validarPersona(f, original = {}) {
  const e = {};
  if (!f.nombre?.trim()) e.nombre = "Obligatorio";
  if (!f.apellido?.trim()) e.apellido = "Obligatorio";
  if (f.dni && ![7, 8].includes(digitos(f.dni).length)) e.dni = "El DNI debe tener 7 u 8 dígitos";
  if (f.cuit && digitos(f.cuit).length !== 11) e.cuit = "El CUIT/CUIL debe tener 11 dígitos";
  if (f.celular && f.celular !== original.celular && !/^\d{10,15}$/.test(f.celular.replace(/[\s\-().+]/g, "")))
    e.celular = "Solo dígitos con código de país y de área (ej. 5493415551234)";
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "Email inválido";
  if (f.numero !== "" && f.numero != null && Number(f.numero) < 0) e.numero = "Número inválido";
  return e;
}

export function validarPropiedad(f) {
  const e = {};
  if (!f.calle?.trim()) e.calle = "Obligatorio";
  if (f.numero !== "" && f.numero != null && Number(f.numero) < 0) e.numero = "Número inválido";
  return e;
}

export const erroresDeApi = (err) => err?.response?.data?.detail?.campos || {};

export function validarContrato(f) {
  const e = {};
  if (!f.id_propiedad) e.id_propiedad = "Elegí la propiedad";
  if (!f.inquilinos.length) e.inquilinos = "Elegí al menos un inquilino";
  if (!f.desde) e.desde = "Obligatorio";
  if (!f.hasta) e.hasta = "Obligatorio";
  if (f.desde && f.hasta && f.hasta <= f.desde) e.hasta = "Debe ser posterior a la fecha desde";
  if (!(Number(f.alquiler_actual) > 0)) e.alquiler_actual = "Debe ser mayor a 0";
  if (!f.id_estado_contrato) e.id_estado_contrato = "Obligatorio";
  if (f.frecuencia_de_actualizacion !== "" && f.frecuencia_de_actualizacion != null && Number(f.frecuencia_de_actualizacion) < 1)
    e.frecuencia_de_actualizacion = "Al menos 1 mes";
  const h = f.porcentaje_honorarios;
  if (h !== "" && h != null && (Number(h) < 0 || Number(h) > 100)) e.porcentaje_honorarios = "Entre 0 y 100";
  return e;
}

// Convierte "" en null y strings numéricos en número para los campos indicados.
export function limpiar(f, numericos = []) {
  const out = {};
  Object.entries(f).forEach(([k, v]) => {
    if (v === "" || v === undefined) out[k] = null;
    else if (numericos.includes(k)) out[k] = Number(v);
    else out[k] = v;
  });
  return out;
}

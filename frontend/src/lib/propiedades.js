export const AMBIENTES = [
  ["dormitorio", "Dormitorios", "dorm."], ["baño", "Baños", "baño"], ["cocina", "Cocinas", "coc."],
  ["living", "Living", "living"], ["comedor", "Comedor", "com."], ["garage", "Garage", "garage"],
  ["patio", "Patio", "patio"], ["lavadero", "Lavadero", "lav."], ["oficina", "Oficinas", "ofic."],
  ["local", "Locales", "local"], ["galpon", "Galpón", "galpón"], ["alerje", "Alerje", "alerje"],
  ["consultorio", "Consultorios", "consult."],
];

export const MEDIDAS = [
  ["superficie_total", "Superficie total (m²)"], ["superficie_cubierta", "Sup. cubierta (m²)"],
  ["superficie_libre", "Sup. libre (m²)"], ["frente", "Frente (m)"], ["fondo", "Fondo (m)"],
];

export const direccion = (p) => [p.calle, p.numero].filter((x) => x !== null && x !== undefined && x !== "").join(" ") || "Sin dirección";

export const resumenAmbientes = (p) =>
  AMBIENTES.filter(([k]) => p[k] > 0).slice(0, 4).map(([k, , c]) => `${p[k]} ${c}`).join(" · ") || "—";

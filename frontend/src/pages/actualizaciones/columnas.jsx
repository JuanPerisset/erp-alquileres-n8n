import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtFecha, fmtFechaHora, fmtMoneda, fmtNumero, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";

// comunicaciones.aprobado tal cual está guardado: true / false / sin respuesta.
export const APROBADO = { true: ["Sí", "verde"], false: ["No", "rojo"], null: ["Pendiente", "amarillo"] };
export const aprobadoClave = (v) => String(v ?? null);

export const AprobadoBadge = ({ valor, testId }) => {
  const [txt, color] = APROBADO[aprobadoClave(valor)];
  return <StatusBadge nombre={txt} variante={color} testId={testId} />;
};

const contrato = (pre) => ({
  key: "id_contrato", label: "Contrato", className: "whitespace-nowrap",
  render: (f) => <Link to={`/contratos/${f.id_contrato}`} className="font-medium underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()} data-testid={`${pre}-contrato-${f.id}`}>#{f.id_contrato}</Link>,
});
const partes = {
  key: "inquilinos", label: "Inquilinos / propiedad", ordenar: (f) => nombresAgrupados(f.inquilinos),
  render: (f) => <div><p className="font-medium">{nombresAgrupados(f.inquilinos) || "—"}</p><p className="text-xs text-muted-foreground">{direccion(f)}</p></div>,
};
const indice = { key: "indice_de_actualizacion", label: "Índice", render: (f) => f.indice_de_actualizacion || "—" };

export const colVencidas = [
  contrato("act-venc"), partes,
  { ...indice, render: (f) => <div><p>{f.indice_de_actualizacion || "—"}</p>{f.frecuencia_de_actualizacion && <p className="text-xs text-muted-foreground">Cada {f.frecuencia_de_actualizacion} meses</p>}</div> },
  { key: "alquiler_actual", label: "Alquiler actual", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.alquiler_actual, f.moneda) },
  { key: "proxima_actualizacion", label: "Correspondía el", className: "num whitespace-nowrap",
    render: (f) => <div><p>{fmtFecha(f.proxima_actualizacion)}</p><p className="text-xs text-red-700">{f.dias_vencida === 0 ? "Vence hoy" : `Hace ${f.dias_vencida} días`}</p></div> },
  { key: "ultima_actualizacion", label: "Última actualización", className: "hidden lg:table-cell num", render: (f) => fmtFecha(f.ultima_actualizacion) },
  { key: "pendiente_aprobacion", label: "Situación", render: (f) => f.pendiente_aprobacion
    ? <StatusBadge nombre="Pedido pendiente en Telegram" variante="amarillo" testId={`act-venc-situacion-${f.id}`} />
    : <StatusBadge nombre="Vencida" variante="rojo" testId={`act-venc-situacion-${f.id}`} /> },
];

export const colHistorial = [
  { key: "fecha_de_actualizacion", label: "Fecha", className: "num whitespace-nowrap", render: (f) => fmtFechaHora(f.fecha_de_actualizacion) },
  contrato("act-hist"), partes, indice,
  { key: "porcentaje_aplicado", label: "% aplicado", className: "text-right num", render: (f) => (f.porcentaje_aplicado != null ? `${fmtNumero(f.porcentaje_aplicado)} %` : "—") },
  { key: "alquiler_anterior", label: "Anterior", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.alquiler_anterior, f.moneda) },
  { key: "alquiler_nuevo", label: "Nuevo", className: "text-right num font-semibold whitespace-nowrap", render: (f) => fmtMoneda(f.alquiler_nuevo, f.moneda) },
  { key: "aprobado", label: "Aprobado", ordenar: (f) => aprobadoClave(f.aprobado), render: (f) => <AprobadoBadge valor={f.aprobado} testId={`act-hist-aprobado-${f.id}`} /> },
];

export const colTelegram = [
  { key: "fecha_envio", label: "Enviado", className: "num whitespace-nowrap", render: (f) => fmtFechaHora(f.fecha_envio) },
  contrato("act-tg"),
  { key: "mensaje", label: "Mensaje", ordenable: false, render: (f) => <p className="max-w-xl whitespace-normal text-sm">{f.mensaje || "—"}</p> },
  { key: "aprobado", label: "Aprobado", ordenar: (f) => aprobadoClave(f.aprobado), render: (f) => <AprobadoBadge valor={f.aprobado} testId={`act-tg-aprobado-${f.id}`} /> },
];

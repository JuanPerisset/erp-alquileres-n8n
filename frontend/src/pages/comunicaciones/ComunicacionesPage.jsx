import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { MesSelector, useMes } from "@/components/MesSelector";
import { SelectSimple } from "@/components/form/Campo";
import { useApi } from "@/hooks/useApi";
import { fmtCelular, fmtFechaHora, fmtMes } from "@/lib/format";
import { direccion } from "@/lib/propiedades";

const up = (v) => String(v || "").trim().toUpperCase();
const legible = (v) => String(v || "—").replace(/_/g, " ");
const destinatario = (f) => (f.destinatario ? `${f.destinatario.apellido} ${f.destinatario.nombre}` : "");

const columnas = [
  { key: "fecha_envio", label: "Fecha de envío", className: "num whitespace-nowrap", render: (f) => fmtFechaHora(f.fecha_envio) },
  { key: "destinatario", label: "Destinatario", ordenar: destinatario,
    render: (f) => <div><p className="font-medium">{destinatario(f) || "—"}</p><p className="text-xs text-muted-foreground">{f.tipo_destinatario}</p></div> },
  { key: "celular_destino", label: "Celular", className: "num whitespace-nowrap", render: (f) => fmtCelular(f.celular_destino) },
  { key: "tipo_mensaje", label: "Tipo de mensaje", render: (f) => <span className="text-sm">{legible(f.tipo_mensaje)}</span> },
  { key: "id_liquidacion", label: "Liquidación", className: "hidden lg:table-cell",
    render: (f) => (f.id_liquidacion ? (
      <Link to={`/liquidaciones/${f.id_liquidacion}`} className="hover:underline" data-testid={`com-liq-${f.id}`}>
        <p>{fmtMes(f["mes_año"])} · Contrato #{f.id_contrato}</p><p className="text-xs text-muted-foreground">{direccion(f)}</p>
      </Link>) : "—") },
  { key: "estado_envio", label: "Estado", render: (f) => <StatusBadge nombre={f.estado_envio} testId={`com-estado-${f.id}`} /> },
  { key: "detalles_error", label: "Error", ordenable: false,
    render: (f) => (f.detalles_error ? <p className="max-w-xs whitespace-normal text-xs text-red-700" data-testid={`com-error-${f.id}`}>{f.detalles_error}</p> : <span className="text-muted-foreground">—</span>) },
];

const opciones = (filas, campo, todos) => [["todos", todos], ...[...new Set(filas.map((f) => up(f[campo])).filter(Boolean))].sort().map((v) => [v, legible(v)])];

const Resumen = ({ filas }) => {
  const errores = filas.filter((f) => up(f.estado_envio) === "ERROR").length;
  return (
    <div className="mb-4 flex flex-wrap gap-3 text-sm" data-testid="com-resumen">
      <span className="rounded-md border bg-white px-3 py-1.5">Total: <b className="num" data-testid="com-total">{filas.length}</b></span>
      <span className="rounded-md border bg-white px-3 py-1.5">Con error: <b className={`num ${errores ? "text-red-700" : ""}`} data-testid="com-errores">{errores}</b></span>
    </div>
  );
};

export default function ComunicacionesPage() {
  const [mes, setMes] = useMes();
  const [estado, setEstado] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const { data, error, recargar } = useApi(`/comunicaciones?mes=${mes}`);
  const filas = useMemo(() => (data || []).filter((f) => (estado === "todos" || up(f.estado_envio) === estado) && (tipo === "todos" || up(f.tipo_mensaje) === tipo)), [data, estado, tipo]);

  return (
    <div>
      <PageHeader eyebrow="Gestión mensual" titulo="Comunicaciones con inquilinos"
        descripcion="Registro de mensajes que n8n envió a los inquilinos (comunicaciones_externas). Solo lectura." />
      <div className="mb-4 flex items-center gap-3"><MesSelector mes={mes} onChange={setMes} /><span className="text-xs text-muted-foreground">Según la fecha de envío</span></div>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          <Resumen filas={filas} />
          <DataTable testId="com-table" columnas={columnas} filas={filas} ordenInicial={{ key: "fecha_envio", dir: "desc" }}
            buscar={(f) => `${destinatario(f)} ${f.celular_destino} ${direccion(f)} ${f.detalles_error || ""}`} placeholder="Buscar por inquilino, celular o dirección"
            vacio={`No hay comunicaciones en ${fmtMes(mes)} con estos filtros.`}
            filtros={<>
              <SelectSimple value={estado} onChange={setEstado} opciones={opciones(data, "estado_envio", "Todos los estados")} className="w-44" testId="com-filtro-estado" />
              <SelectSimple value={tipo} onChange={setTipo} opciones={opciones(data, "tipo_mensaje", "Todos los tipos")} className="w-56" testId="com-filtro-tipo" />
            </>} />
        </>
      )}
    </div>
  );
}

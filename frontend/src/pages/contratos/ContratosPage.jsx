import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { AccionesFila } from "@/components/AccionesFila";
import { SelectCatalogo, SelectSimple } from "@/components/form/Campo";
import { useApi } from "@/hooks/useApi";
import { useCatalogos } from "@/hooks/useCatalogos";
import { fmtFecha, fmtMoneda, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import { diasHasta } from "@/lib/contratos";
import ContratoDialog from "./ContratoDialog";
import { EstadoContrato } from "./EstadoContrato";

const VENC = [["todos", "Todos los vencimientos"], ["60", "Vence en 60 días"], ["90", "Vence en 90 días"], ["pasado", "Fecha de fin pasada"]];
const ACT = [["todas", "Todas las actualizaciones"], ["vencida", "Actualización vencida"], ["30", "Actualiza en 30 días"]];
const MON = [["todas", "Todas las monedas"], ["ARS", "ARS"], ["USD", "USD"]];

const Vigencia = ({ f }) => {
  const d = diasHasta(f.hasta);
  return (
    <div className="whitespace-nowrap num">
      <p>{fmtFecha(f.desde)} → {fmtFecha(f.hasta)}</p>
      {d != null && d >= 0 && d <= 90 && <p className="text-xs text-amber-700">Vence en {d} días</p>}
    </div>
  );
};

const columnas = (acciones) => [
  { key: "id", label: "#", className: "num w-12" },
  { key: "inquilinos", label: "Inquilinos", ordenar: (f) => nombresAgrupados(f.inquilinos),
    render: (f) => <span className="font-medium">{nombresAgrupados(f.inquilinos) || "—"}</span> },
  { key: "calle", label: "Propiedad", ordenar: (f) => direccion(f),
    render: (f) => <div><p>{direccion(f)}</p><p className="text-xs text-muted-foreground">{f.ciudad}</p></div> },
  { key: "propietarios", label: "Propietarios", className: "hidden xl:table-cell", ordenar: (f) => nombresAgrupados(f.propietarios),
    render: (f) => nombresAgrupados(f.propietarios) || "—" },
  { key: "alquiler_actual", label: "Alquiler", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.alquiler_actual, f.moneda) },
  { key: "hasta", label: "Vigencia", render: (f) => <Vigencia f={f} /> },
  { key: "proxima_actualizacion", label: "Próx. actualización", className: "hidden md:table-cell whitespace-nowrap num",
    render: (f) => <span className={f.actualizacion_vencida ? "font-medium text-red-700" : ""}>{fmtFecha(f.proxima_actualizacion)}{f.actualizacion_vencida && " · vencida"}</span> },
  { key: "estado", label: "Estado", render: (f) => <EstadoContrato c={f} /> },
  { key: "acciones", label: "", ordenable: false, render: acciones },
];

function filtrar(filas, { estado, moneda, venc, act }) {
  return filas.filter((f) => {
    const dv = diasHasta(f.hasta);
    const da = diasHasta(f.proxima_actualizacion);
    if (estado != null && f.id_estado_contrato !== estado) return false;
    if (moneda !== "todas" && f.moneda !== moneda) return false;
    if (venc === "pasado" && !(dv != null && dv < 0)) return false;
    if (["60", "90"].includes(venc) && !(dv != null && dv >= 0 && dv <= Number(venc))) return false;
    if (act === "vencida" && !f.actualizacion_vencida) return false;
    if (act === "30" && !(da != null && da > 0 && da <= 30)) return false;
    return true;
  });
}

export default function ContratosPage() {
  const navigate = useNavigate();
  const cat = useCatalogos();
  const { data, error, recargar } = useApi("/contratos");
  const [editando, setEditando] = useState(undefined);
  const [fil, setFil] = useState({ estado: null, moneda: "todas", venc: "todos", act: "todas" });
  const setF = (k) => (v) => setFil((p) => ({ ...p, [k]: v }));
  const filas = useMemo(() => filtrar(data || [], fil), [data, fil]);

  const acciones = (f) => (
    <AccionesFila testId={`contrato-${f.id}`} onEditar={() => setEditando(f)}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/contratos/${f.id}`)} aria-label="Ver detalle"
        data-testid={`contrato-${f.id}-ver`}><Eye className="h-4 w-4" /></Button>
    </AccionesFila>
  );

  const filtros = (
    <>
      <div className="w-44"><SelectCatalogo value={fil.estado} onChange={setF("estado")} items={cat?.estados_contrato || []} vacio="Todos los estados" testId="filtro-estado-contrato" /></div>
      <SelectSimple value={fil.moneda} onChange={setF("moneda")} opciones={MON} className="w-40" testId="filtro-moneda" />
      <SelectSimple value={fil.venc} onChange={setF("venc")} opciones={VENC} className="w-48" testId="filtro-vencimiento" />
      <SelectSimple value={fil.act} onChange={setF("act")} opciones={ACT} className="w-52" testId="filtro-actualizacion" />
    </>
  );

  return (
    <div>
      <PageHeader eyebrow="Cartera" titulo="Contratos" descripcion="Contratos de alquiler con sus partes, vigencia y condiciones de actualización.">
        <Button onClick={() => setEditando(null)} className="active:scale-95" data-testid="contratos-nuevo-button">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo contrato
        </Button>
      </PageHeader>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-80" />}
      {data && (
        <DataTable testId="contratos-table" columnas={columnas(acciones)} filas={filas} filtros={filtros}
          onFila={(f) => navigate(`/contratos/${f.id}`)} ordenInicial={{ key: "id", dir: "asc" }}
          placeholder="Buscar por inquilino, propietario o dirección"
          buscar={(f) => `${nombresAgrupados(f.inquilinos)} ${nombresAgrupados(f.propietarios)} ${direccion(f)} ${f.ciudad}`}
          vacio="Todavía no hay contratos cargados." />
      )}
      {editando !== undefined && (
        <ContratoDialog contrato={editando} onClose={() => setEditando(undefined)}
          onGuardado={() => { setEditando(undefined); recargar(); }} />
      )}
    </div>
  );
}

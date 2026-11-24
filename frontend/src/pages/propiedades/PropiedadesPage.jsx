import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { BajaDialog } from "@/components/BajaDialog";
import { AccionesFila } from "@/components/AccionesFila";
import { SelectCatalogo } from "@/components/form/Campo";
import { useApi } from "@/hooks/useApi";
import { useCatalogos } from "@/hooks/useCatalogos";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { nombresAgrupados } from "@/lib/format";
import { direccion, resumenAmbientes } from "@/lib/propiedades";
import PropiedadDialog from "./PropiedadDialog";

const columnas = (acciones) => [
  { key: "calle", label: "Dirección", ordenar: (f) => direccion(f),
    render: (f) => <div><p className="font-medium">{direccion(f)}</p><p className="text-xs text-muted-foreground">{f.barrio || "Sin barrio"}</p></div> },
  { key: "ciudad", label: "Ciudad", className: "hidden md:table-cell" },
  { key: "tipo", label: "Tipo" },
  { key: "ambientes", label: "Ambientes", ordenable: false, className: "hidden lg:table-cell text-muted-foreground", render: resumenAmbientes },
  { key: "propietarios", label: "Propietarios", ordenar: (f) => nombresAgrupados(f.propietarios), render: (f) => nombresAgrupados(f.propietarios) || "—" },
  { key: "estado", label: "Estado", render: (f) => <StatusBadge nombre={f.estado} /> },
  { key: "acciones", label: "", ordenable: false, render: acciones },
];

export default function PropiedadesPage() {
  const navigate = useNavigate();
  const cat = useCatalogos();
  const { data, error, recargar } = useApi("/propiedades");
  const [editando, setEditando] = useState(undefined);
  const [baja, setBaja] = useState(null);
  const [estado, setEstado] = useState(null);
  const [tipo, setTipo] = useState(null);

  const filas = useMemo(() => (data || []).filter((f) =>
    (estado == null || f.id_estado_propiedad === estado) && (tipo == null || f.id_tipo === tipo)), [data, estado, tipo]);

  const pedirBaja = (f) => {
    const nombre = direccion(f);
    if (f.contratos === 0) {
      return setBaja({ nombre, eliminar: () => accion(() => api.delete(`/propiedades/${f.id}`), "Propiedad eliminada", recargar) });
    }
    if (String(f.estado).toLowerCase() === "inactiva") return setBaja({ bloqueo: "Tiene contratos asociados y ya está inactiva." });
    setBaja({ alternativa: {
      titulo: `¿Pasar ${nombre} a inactiva?`, confirmar: "Pasar a inactiva",
      descripcion: "Tiene contratos asociados, así que no se puede eliminar. Va a quedar con estado inactiva.",
      run: () => accion(() => api.post(`/propiedades/${f.id}/inactivar`), `${nombre} quedó inactiva`, recargar),
    } });
  };

  const acciones = (f) => (
    <AccionesFila testId={`propiedad-${f.id}`} onEditar={() => setEditando(f)} onEliminar={() => pedirBaja(f)}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/propiedades/${f.id}`)} aria-label="Ver ficha"
        data-testid={`propiedad-${f.id}-ver`}><Eye className="h-4 w-4" /></Button>
    </AccionesFila>
  );

  const filtros = (
    <>
      <div className="w-44"><SelectCatalogo value={estado} onChange={setEstado} items={cat?.estados_propiedad || []} vacio="Todos los estados" testId="filtro-estado-propiedad" /></div>
      <div className="w-44"><SelectCatalogo value={tipo} onChange={setTipo} items={cat?.tipos_propiedad || []} vacio="Todos los tipos" testId="filtro-tipo-propiedad" /></div>
    </>
  );

  return (
    <div>
      <PageHeader eyebrow="Cartera" titulo="Propiedades" descripcion="Inmuebles administrados, con sus ambientes, estado y propietarios.">
        <Button onClick={() => setEditando(null)} className="active:scale-95" data-testid="propiedades-nuevo-button">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva propiedad
        </Button>
      </PageHeader>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-80" />}
      {data && (
        <DataTable testId="propiedades-table" columnas={columnas(acciones)} filas={filas} filtros={filtros}
          onFila={(f) => navigate(`/propiedades/${f.id}`)} ordenInicial={{ key: "calle", dir: "asc" }}
          placeholder="Buscar por dirección, barrio, ciudad o propietario"
          buscar={(f) => `${direccion(f)} ${f.barrio} ${f.ciudad} ${nombresAgrupados(f.propietarios)}`}
          vacio="Todavía no hay propiedades cargadas." />
      )}
      {editando !== undefined && (
        <PropiedadDialog propiedad={editando} onClose={() => setEditando(undefined)}
          onGuardado={() => { setEditando(undefined); recargar(); }} />
      )}
      <BajaDialog baja={baja} onClose={() => setBaja(null)} testId="propiedad-baja-dialog" />
    </div>
  );
}

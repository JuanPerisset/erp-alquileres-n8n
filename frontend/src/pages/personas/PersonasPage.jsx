import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { BajaDialog } from "@/components/BajaDialog";
import { AccionesFila } from "@/components/AccionesFila";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { fmtCelular } from "@/lib/format";
import PersonaDialog from "./PersonaDialog";

export const CONFIG = {
  inquilinos: { titulo: "Inquilinos", singular: "inquilino", relacion: "contratos", relLabel: "Contratos", estado: true },
  propietarios: { titulo: "Propietarios", singular: "propietario", relacion: "propiedades", relLabel: "Propiedades" },
};

const columnas = (cfg, acciones) => [
  { key: "apellido", label: "Apellido y nombre", render: (f) => <span className="font-medium">{f.apellido} {f.nombre}</span>,
    ordenar: (f) => `${f.apellido} ${f.nombre}` },
  { key: "dni", label: "DNI", className: "num" },
  { key: "cuit", label: "CUIT/CUIL", className: "hidden num md:table-cell" },
  { key: "celular", label: "Celular", className: "num whitespace-nowrap", render: (f) => fmtCelular(f.celular) },
  { key: "email", label: "Email", className: "hidden xl:table-cell" },
  { key: "ciudad", label: "Ciudad", className: "hidden lg:table-cell" },
  ...(cfg.estado ? [{ key: "estado", label: "Estado", render: (f) => <StatusBadge nombre={f.estado} /> }] : []),
  { key: cfg.relacion, label: cfg.relLabel, className: "text-right num" },
  { key: "acciones", label: "", ordenable: false, render: acciones },
];

const FiltroRelacion = ({ cfg, value, onChange }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-48 bg-white" data-testid="filtro-relacion"><SelectValue /></SelectTrigger>
    <SelectContent className="bg-white">
      <SelectItem value="todos">Todos</SelectItem>
      <SelectItem value="con">Con {cfg.relacion}</SelectItem>
      <SelectItem value="sin">Sin {cfg.relacion}</SelectItem>
    </SelectContent>
  </Select>
);

export default function PersonasPage({ tipo }) {
  const cfg = CONFIG[tipo];
  const { data, error, recargar } = useApi(`/${tipo}`);
  const [editando, setEditando] = useState(undefined);
  const [baja, setBaja] = useState(null);
  const [rel, setRel] = useState("todos");

  const filas = useMemo(() => (data || []).filter((f) =>
    rel === "todos" || (rel === "con" ? f[cfg.relacion] > 0 : f[cfg.relacion] === 0)), [data, rel, cfg.relacion]);

  const pedirBaja = (f) => {
    const nombre = `${f.apellido} ${f.nombre}`;
    if (f[cfg.relacion] === 0) {
      return setBaja({ nombre, eliminar: () => accion(() => api.delete(`/${tipo}/${f.id}`), `Se eliminó a ${nombre}`, recargar) });
    }
    if (tipo === "propietarios") return setBaja({ bloqueo: "Tiene propiedades asociadas; desvinculalo primero." });
    if (f.estado === "inactivo") return setBaja({ bloqueo: "Tiene contratos asociados y ya está inactivo." });
    setBaja({ alternativa: {
      titulo: `¿Pasar a ${nombre} a inactivo?`, confirmar: "Pasar a inactivo",
      descripcion: "Tiene contratos asociados, así que no se puede eliminar. Va a quedar con estado inactivo.",
      run: () => accion(() => api.post(`/inquilinos/${f.id}/inactivar`), `${nombre} quedó inactivo`, recargar),
    } });
  };

  const acciones = (f) => (
    <AccionesFila testId={`${tipo}-${f.id}`} onEditar={() => setEditando(f)} onEliminar={() => pedirBaja(f)} />
  );

  return (
    <div>
      <PageHeader eyebrow="Cartera" titulo={cfg.titulo} descripcion={`Alta, edición y búsqueda de ${tipo}.`}>
        <Button onClick={() => setEditando(null)} className="active:scale-95" data-testid={`${tipo}-nuevo-button`}>
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo {cfg.singular}
        </Button>
      </PageHeader>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-80" />}
      {data && (
        <DataTable testId={`${tipo}-table`} columnas={columnas(cfg, acciones)} filas={filas} onFila={setEditando}
          ordenInicial={{ key: "apellido", dir: "asc" }} placeholder="Buscar por nombre, DNI, CUIT, celular o email"
          buscar={(f) => `${f.apellido} ${f.nombre} ${f.dni} ${f.cuit} ${f.celular} ${f.email} ${f.ciudad}`}
          filtros={<FiltroRelacion cfg={cfg} value={rel} onChange={setRel} />}
          vacio={`Todavía no hay ${tipo} cargados.`} />
      )}
      {editando !== undefined && (
        <PersonaDialog tipo={tipo} persona={editando} onClose={() => setEditando(undefined)}
          onGuardado={() => { setEditando(undefined); recargar(); }} />
      )}
      <BajaDialog baja={baja} onClose={() => setBaja(null)} testId={`${tipo}-baja-dialog`} />
    </div>
  );
}

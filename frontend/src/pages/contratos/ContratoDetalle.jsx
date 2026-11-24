import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarX2, Pencil, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EstadoError } from "@/components/EstadoVacio";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BajaDialog } from "@/components/BajaDialog";
import { useApi } from "@/hooks/useApi";
import { useCatalogos } from "@/hooks/useCatalogos";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import { idEstado } from "@/lib/contratos";
import ContratoDialog from "./ContratoDialog";
import { EstadoContrato } from "./EstadoContrato";
import { Condiciones, Historial, Liquidaciones, Partes } from "./ContratoSecciones";

export default function ContratoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cat = useCatalogos();
  const { data: c, error, recargar } = useApi(`/contratos/${id}`);
  const [editando, setEditando] = useState(false);
  const [vencer, setVencer] = useState(false);
  const [baja, setBaja] = useState(null);

  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!c) return <Skeleton className="h-96" />;

  const estados = cat?.estados_contrato;
  const cambiarEstado = (nombre, ok) => accion(() => api.patch(`/contratos/${c.id}/estado`, { id_estado_contrato: idEstado(estados, nombre) }), ok, recargar);
  const inactivo = c.estado?.toLowerCase() === "inactivo";

  const pedirBaja = () => {
    if (!c.liquidaciones && !c.otros_vinculos) {
      return setBaja({ nombre: `el contrato #${c.id}`, eliminar: () => accion(() => api.delete(`/contratos/${c.id}`), "Contrato eliminado", () => navigate("/contratos")) });
    }
    setBaja({ alternativa: {
      titulo: `¿Pasar el contrato #${c.id} a inactivo?`, confirmar: "Pasar a inactivo",
      descripcion: "Tiene liquidaciones o historial, así que no se puede eliminar. Va a quedar con estado inactivo.",
      run: () => cambiarEstado("inactivo", "El contrato quedó inactivo"),
    } });
  };

  return (
    <div>
      <Link to="/contratos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="contrato-volver">
        <ArrowLeft className="h-4 w-4" /> Contratos
      </Link>
      <PageHeader eyebrow={`${direccion(c)}${c.ciudad ? ` · ${c.ciudad}` : ""}`} titulo={`Contrato #${c.id}`}
        descripcion={nombresAgrupados(c.inquilinos)}>
        <EstadoContrato c={c} />
        <Button variant="outline" onClick={() => setEditando(true)} data-testid="contrato-editar-button"><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>
        {c.vencido_sugerido && (
          <Button variant="outline" className="border-red-200 text-red-800 hover:bg-red-50" onClick={() => setVencer(true)} data-testid="contrato-marcar-vencido-button">
            <CalendarX2 className="mr-1.5 h-4 w-4" />Marcar como vencido
          </Button>
        )}
        {!inactivo && c.liquidaciones > 0 && (
          <Button variant="outline" onClick={pedirBaja} data-testid="contrato-inactivar-button"><PowerOff className="mr-1.5 h-4 w-4" />Pasar a inactivo</Button>
        )}
        {!c.liquidaciones && !c.otros_vinculos && (
          <Button variant="outline" className="text-red-700" onClick={pedirBaja} data-testid="contrato-eliminar-button"><Trash2 className="mr-1.5 h-4 w-4" />Eliminar</Button>
        )}
      </PageHeader>
      <div className="space-y-4 fade-up">
        <Partes c={c} />
        <Condiciones c={c} />
        <Historial c={c} />
        <Liquidaciones c={c} />
      </div>
      {editando && <ContratoDialog contrato={c} onClose={() => setEditando(false)} onGuardado={() => { setEditando(false); recargar(); }} />}
      <ConfirmDialog open={vencer} onOpenChange={setVencer} testId="contrato-vencer-dialog" confirmar="Marcar como vencido"
        titulo={`¿Marcar el contrato #${c.id} como vencido?`}
        descripcion="La fecha de fin ya pasó y el estado sigue activo. Se cambia el estado del contrato a vencido; no se modifica nada más."
        onConfirm={() => cambiarEstado("vencido", "El contrato quedó vencido")} />
      <BajaDialog baja={baja} onClose={() => setBaja(null)} testId="contrato-baja-dialog" />
    </div>
  );
}

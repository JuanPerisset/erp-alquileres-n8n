import { useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, apiError } from "@/lib/api";

export function EjecutarActualizacion({ vencidas, onEjecutado }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const sinPedido = (vencidas || []).filter((f) => !f.pendiente_aprobacion).length;
  const conPedido = (vencidas || []).length - sinPedido;

  const ejecutar = async () => {
    setError("");
    try {
      const { data } = await api.post("/actualizaciones/ejecutar");
      const n = data.respuesta?.procesados;
      toast.success(`Actualización enviada a n8n${n != null ? `: ${n} contrato${n === 1 ? "" : "s"} procesado${n === 1 ? "" : "s"}` : ""}. El alquiler cambia recién cuando se aprueba en Telegram.`);
      onEjecutado();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    }
  };

  return (
    <>
      <Button onClick={() => { setError(""); setAbierto(true); }} disabled={!vencidas || sinPedido === 0} data-testid="act-ejecutar-btn">
        <Play className="mr-1.5 h-4 w-4" />Ejecutar actualización
      </Button>
      <ConfirmDialog open={abierto} onOpenChange={setAbierto} testId="act-ejecutar-dialog" confirmar="Ejecutar" onConfirm={ejecutar}
        titulo="Ejecutar actualización de alquileres"
        descripcion="Se dispara el flujo A de n8n: busca los contratos activos con la actualización vencida, calcula el índice y envía el pedido de aprobación por Telegram.">
        <div className="space-y-2 text-sm">
          <p data-testid="act-ejecutar-resumen"><span className="num font-semibold">{sinPedido}</span> contrato{sinPedido === 1 ? "" : "s"} vencido{sinPedido === 1 ? "" : "s"} sin pedido enviado
            {conPedido > 0 && <> · <span className="num">{conPedido}</span> ya con pedido pendiente</>}.</p>
          <p className="text-muted-foreground">El alquiler y la próxima actualización del contrato se modifican recién cuando se aprueba en Telegram.</p>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid="act-ejecutar-error">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  );
}

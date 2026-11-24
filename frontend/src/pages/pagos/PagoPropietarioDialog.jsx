import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/form/Campo";
import { DateInput } from "@/components/form/DateInput";
import { api, apiError } from "@/lib/api";
import { fmtMes, fmtMoneda, fmtNumero, nombresAgrupados } from "@/lib/format";

const Fila = ({ label, valor, fuerte, testId }) => (
  <div className={`flex justify-between py-1.5 text-sm ${fuerte ? "border-t pt-3 font-semibold" : ""}`}>
    <span className="text-muted-foreground">{label}</span><span className="num" data-testid={testId}>{valor}</span>
  </div>
);

export default function PagoPropietarioDialog({ item: f, onClose, onPagado }) {
  const hoy = format(new Date(), "yyyy-MM-dd");
  const [fecha, setFecha] = useState(hoy);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (enviando || !fecha) return;
    setEnviando(true);
    setError("");
    try {
      const { data } = await api.post("/pagos-propietarios", { id_liquidacion: f.id, fecha_pago: fecha });
      toast.success(`Pago registrado: neto ${fmtMoneda(data.monto_neto, data.moneda)} (${fmtNumero(data.porcentaje_honorarios_aplicado)} % de honorarios)`);
      onPagado(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="bg-white sm:max-w-md" data-testid="pp-dialog">
        <DialogHeader>
          <DialogTitle>Registrar pago al propietario</DialogTitle>
          <DialogDescription>{nombresAgrupados(f.propietarios)} · {fmtMes(f["mes_año"])} · Contrato #{f.id_contrato}</DialogDescription>
        </DialogHeader>
        <Campo label="Fecha de pago"><DateInput value={fecha} onChange={setFecha} max={hoy} testId="pp-fecha-input" /></Campo>
        <div className="rounded-md border bg-muted/30 px-4 py-2" data-testid="pp-vista-previa">
          <Fila label="Alquiler" valor={fmtMoneda(f.alquiler, f.moneda)} />
          <Fila label={`Honorarios (${fmtNumero(f.porcentaje_honorarios || 0)} % del alquiler)`} valor={`− ${fmtMoneda(f.honorarios, f.moneda)}`} testId="pp-honorarios" />
          <Fila label="Neto a pagar" valor={fmtMoneda(f.neto, f.moneda)} fuerte testId="pp-neto" />
        </div>
        <p className="text-xs text-muted-foreground">Se registra un único pago por liquidación. Los servicios, conceptos y mora no forman parte del pago al propietario. No se envía ningún mensaje al propietario.</p>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="pp-error">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando} data-testid="pp-cancelar">Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando || !fecha} data-testid="pp-confirmar">
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? "Registrando…" : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

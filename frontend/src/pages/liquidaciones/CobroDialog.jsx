import { useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
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

export default function CobroDialog({ liquidacion: l, onClose, onCobrado }) {
  const minFecha = l["mes_año"] ? format(subDays(parseISO(String(l["mes_año"]).slice(0, 10)), 5), "yyyy-MM-dd") : undefined;
  const hoyStr = format(new Date(), "yyyy-MM-dd");
  const [fecha, setFecha] = useState(minFecha && hoyStr < minFecha ? String(l["mes_año"]).slice(0, 10) : hoyStr);
  const [prev, setPrev] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setPrev(null);
    setError("");
    if (!fecha) return;
    let vivo = true;
    api.get(`/liquidaciones/${l.id}/vista-previa-mora`, { params: { fecha_pago: fecha } })
      .then((r) => vivo && setPrev(r.data)).catch((e) => vivo && setError(apiError(e)));
    return () => { vivo = false; };
  }, [fecha, l.id]);

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const { data } = await api.post(`/liquidaciones/${l.id}/cobro`, { fecha_pago: fecha });
      toast.success(`Cobro registrado. Total guardado: ${fmtMoneda(data.monto_total_pagado, data.moneda)}`);
      onCobrado(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="bg-white sm:max-w-md" data-testid="cobro-dialog">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>{nombresAgrupados(l.inquilinos)} · {fmtMes(l["mes_año"])}</DialogDescription>
        </DialogHeader>
        <Campo label="Fecha de pago"><DateInput value={fecha} onChange={setFecha} min={minFecha} testId="cobro-fecha-input" /></Campo>
        <div className="rounded-md border bg-muted/30 px-4 py-2" data-testid="cobro-vista-previa">
          {!prev ? <p className="py-3 text-sm text-muted-foreground">{fecha ? "Calculando…" : "Ingresá la fecha de pago."}</p> : (
            <>
              <Fila label="Días transcurridos" valor={prev.dias} testId="cobro-dias" />
              <Fila label="Regla de mora" valor={prev.regla ? `${prev.regla.rango} · ${fmtNumero(prev.porcentaje_mora)} %` : "Sin regla aplicable"} testId="cobro-regla" />
              <Fila label="Total de la liquidación (base de la mora)" valor={fmtMoneda(prev.total_liquidacion, prev.moneda)} />
              <Fila label="Mora" valor={fmtMoneda(prev.monto_mora, prev.moneda)} testId="cobro-mora" />
              <Fila label="Total a cobrar" valor={fmtMoneda(prev.total_a_cobrar, prev.moneda)} fuerte testId="cobro-total" />
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Vista previa con la regla vigente. El cálculo oficial lo hace n8n; después se muestran los valores guardados.</p>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="cobro-error">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando} data-testid="cobro-cancelar">Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando || !prev} data-testid="cobro-confirmar">
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? "Registrando…" : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

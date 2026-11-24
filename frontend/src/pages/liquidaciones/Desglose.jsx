import { fmtMoneda } from "@/lib/format";
import { sumaServicios } from "@/lib/liquidaciones";

const Linea = ({ signo, label, valor, moneda, testId, fuerte }) => (
  <div className={`flex items-baseline justify-between py-2 ${fuerte ? "border-t-2 border-ink pt-3" : "border-b border-dashed"}`}>
    <span className={fuerte ? "font-display font-bold" : "text-sm text-muted-foreground"}>
      <span className="mr-2 inline-block w-3 text-center font-mono">{signo}</span>{label}
    </span>
    <span className={`num ${fuerte ? "font-display text-2xl font-bold" : "text-sm font-medium"}`} data-testid={testId}>{fmtMoneda(valor, moneda)}</span>
  </div>
);

// Desglose en vivo: alquiler + servicios + adicionales − descuentos = total.
export const Desglose = ({ alquiler, servicios, conceptos, moneda }) => {
  const s = sumaServicios(servicios);
  const adic = conceptos.filter((c) => c.tipo === "adicional").reduce((t, c) => t + Number(c.monto), 0);
  const desc = conceptos.filter((c) => c.tipo === "descuento").reduce((t, c) => t + Number(c.monto), 0);
  return (
    <section className="rounded-lg border bg-card p-5" data-testid="desglose">
      <h2 className="label-caps mb-3">Desglose</h2>
      <Linea signo="" label="Alquiler" valor={alquiler} moneda={moneda} testId="desglose-alquiler" />
      <Linea signo="+" label="Servicios" valor={s} moneda={moneda} testId="desglose-servicios" />
      <Linea signo="+" label="Adicionales" valor={adic} moneda={moneda} testId="desglose-adicionales" />
      <Linea signo="−" label="Descuentos" valor={desc} moneda={moneda} testId="desglose-descuentos" />
      <Linea signo="=" label="Total" valor={Number(alquiler) + s + adic - desc} moneda={moneda} testId="desglose-total" fuerte />
    </section>
  );
};

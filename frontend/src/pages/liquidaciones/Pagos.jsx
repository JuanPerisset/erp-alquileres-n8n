import { StatusBadge } from "@/components/StatusBadge";
import { fmtFecha, fmtFechaHora, fmtMoneda, fmtNumero } from "@/lib/format";

const Dato = ({ label, valor, testId }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium num" data-testid={testId}>{valor ?? "—"}</dd></div>
);

// Valores tal cual están guardados en pagos_inquilinos / pagos_propietarios (no se recalculan).
export const PagoInquilino = ({ l }) => (
  <section className="rounded-lg border bg-card p-5" data-testid="pago-inquilino">
    <div className="mb-4 flex items-center justify-between"><h2 className="label-caps">Pago del inquilino</h2>{l.estado_pago && <StatusBadge nombre={l.estado_pago} />}</div>
    {!l.id_pago_inquilino ? <p className="text-sm text-muted-foreground">Todavía no se notificó (no existe el pago).</p> : (
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Dato label="Monto base" valor={fmtMoneda(l.monto_base, l.moneda)} testId="pago-monto-base" />
        <Dato label="% mora" valor={l.porcentaje_mora != null ? `${fmtNumero(l.porcentaje_mora)} %` : null} testId="pago-porcentaje-mora" />
        <Dato label="Mora" valor={fmtMoneda(l.monto_mora, l.moneda)} testId="pago-monto-mora" />
        <Dato label="Total pagado" valor={l.monto_total_pagado != null ? fmtMoneda(l.monto_total_pagado, l.moneda) : null} testId="pago-total-pagado" />
        <Dato label="Fecha de pago" valor={l.fecha_pago ? fmtFecha(l.fecha_pago) : null} testId="pago-fecha" />
        <Dato label="Regla aplicada" valor={l.regla_mora} />
        <Dato label="Detalle enviado" valor={l.fecha_detalle_enviado ? fmtFechaHora(l.fecha_detalle_enviado) : null} />
        <Dato label="Comprobante enviado" valor={l.fecha_comprobante ? fmtFechaHora(l.fecha_comprobante) : null} />
      </dl>
    )}
  </section>
);

export const PagoPropietario = ({ l }) => {
  const p = l.pago_propietario;
  return (
    <section className="rounded-lg border bg-card p-5" data-testid="pago-propietario">
      <div className="mb-4 flex items-center justify-between"><h2 className="label-caps">Pago al propietario</h2>{p && <StatusBadge nombre={p.estado} />}</div>
      {!p ? <p className="text-sm text-muted-foreground">Todavía no se registró el pago al propietario.</p> : (
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Dato label="Fecha de pago" valor={fmtFecha(p.fecha_pago)} />
          <Dato label="% honorarios aplicado" valor={p.porcentaje_honorarios_aplicado != null ? `${fmtNumero(p.porcentaje_honorarios_aplicado)} %` : null} />
          <Dato label="Honorarios retenidos" valor={fmtMoneda(Number(l.alquiler) - Number(p.monto_neto), l.moneda)} />
          <Dato label="Neto pagado" valor={fmtMoneda(p.monto_neto, l.moneda)} testId="pago-propietario-neto" />
        </dl>
      )}
    </section>
  );
};

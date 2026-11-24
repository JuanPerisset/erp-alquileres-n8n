import { diasHasta } from "@/lib/contratos";

export const SERVICIOS = [["luz", "Luz"], ["gas", "Gas"], ["agua", "Agua"], ["municipal", "Municipal"], ["expensas", "Expensas"], ["seguro", "Seguro"]];

export const esBorrador = (l) => l.estado_liquidacion?.toLowerCase() === "borrador";
export const pagoPendiente = (l) => !!l.id_pago_inquilino && l.estado_pago?.toLowerCase() === "pendiente";
export const diasDelMes = (l) => -diasHasta(l["mes_año"]) + 1;
export const esMoroso = (l) => pagoPendiente(l) && diasDelMes(l) > 20;

export const sumaServicios = (s) => SERVICIOS.reduce((t, [k]) => t + (Number(s?.[k]) || 0), 0);

export function totalesPorMoneda(filas) {
  const out = {};
  filas.forEach((l) => {
    const t = (out[l.moneda] = out[l.moneda] || { total: 0, cobrado: 0, cantidad: 0 });
    t.total += Number(l.total) || 0;
    t.cobrado += Number(l.monto_total_pagado) || 0;
    t.cantidad += 1;
  });
  return out;
}

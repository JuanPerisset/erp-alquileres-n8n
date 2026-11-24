"""Pagos a propietarios: pendientes (liquidación pagada sin pago al propietario), registro vía webhook D e historial."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, n8n
from core.auth import get_current_user
from core.fechas import hoy_ar
from core.webhooks import N8N_ERROR, llamar

router = APIRouter(prefix="/pagos-propietarios", tags=["pagos-propietarios"], dependencies=[Depends(get_current_user)])

BASE = """
SELECT l.id_liquidacion AS id, l.id_contrato, l."mes_año", l.moneda, l.alquiler, p.calle, p.numero, ci.nombre AS ciudad,
       COALESCE((SELECT json_agg(json_build_object('id', o.id_propietario, 'nombre', o.nombre, 'apellido', o.apellido) ORDER BY o.apellido, o.nombre)
                 FROM propiedades_propietarios pp JOIN datos_propietarios o ON o.id_propietario = pp.id_propietario
                 WHERE pp.id_propiedad = ca.id_propiedad), '[]'::json) AS propietarios,
       COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido) ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos x JOIN datos_inquilinos i ON i.id_inquilino = x.id_inquilino
                 WHERE x.id_contrato = l.id_contrato), '[]'::json) AS inquilinos,
       (SELECT max(pi.fecha_pago) FROM pagos_inquilinos pi WHERE pi.id_liquidacion = l.id_liquidacion) AS fecha_cobro
"""
JOINS = """
FROM liquidaciones_mensuales l
JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
LEFT JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
"""
PENDIENTES = f"""{BASE}, ca.porcentaje_honorarios,
       round(l.alquiler * COALESCE(ca.porcentaje_honorarios, 0) / 100, 2) AS honorarios,
       l.alquiler - round(l.alquiler * COALESCE(ca.porcentaje_honorarios, 0) / 100, 2) AS neto
{JOINS}
WHERE lower(el.nombre) = 'pagada' AND NOT EXISTS (SELECT 1 FROM pagos_propietarios x WHERE x.id_liquidacion = l.id_liquidacion)"""

HISTORIAL = f"""{BASE}, pp.id_pago_propietario, pp.fecha_pago, pp.monto_neto, pp.porcentaje_honorarios_aplicado,
       round(l.alquiler * COALESCE(pp.porcentaje_honorarios_aplicado, 0) / 100, 2) AS honorarios, ep.nombre AS estado
{JOINS}
JOIN pagos_propietarios pp ON pp.id_liquidacion = l.id_liquidacion
LEFT JOIN estados_pago ep ON ep.id_estado_pago = pp.id_estado_pago"""


class PagoIn(BaseModel):
    id_liquidacion: int
    fecha_pago: date


@router.get("/pendientes")
async def pendientes():
    return await db.fetch(f'{PENDIENTES} ORDER BY l."mes_año", l.id_contrato')


@router.get("/historial")
async def historial(mes: Optional[date] = None):
    return await db.fetch(
        f"""{HISTORIAL} WHERE $1::date IS NULL OR date_trunc('month', pp.fecha_pago)::date = $1
            ORDER BY pp.fecha_pago DESC, l.id_contrato""", mes)


@router.post("")
async def registrar(body: PagoIn):
    if not await db.fetchval(f"SELECT 1 {JOINS} WHERE l.id_liquidacion = $1 AND lower(el.nombre) = 'pagada'", body.id_liquidacion):
        raise HTTPException(status_code=400, detail="Solo se puede pagar al propietario una liquidación cobrada (estado pagada)")
    if await db.fetchval("SELECT 1 FROM pagos_propietarios WHERE id_liquidacion = $1", body.id_liquidacion):
        raise HTTPException(status_code=400, detail="Esta liquidación ya tiene registrado el pago al propietario")
    if body.fecha_pago > hoy_ar():
        raise HTTPException(status_code=400, detail="La fecha de pago no puede ser futura")
    await llamar("pagar_propietario", n8n.PagarPropietarioPayload(**body.model_dump()), f"prop-{body.id_liquidacion}")
    row = await db.fetchrow(f"{HISTORIAL} WHERE l.id_liquidacion = $1", body.id_liquidacion)
    if not row:
        raise HTTPException(status_code=N8N_ERROR, detail="n8n respondió OK pero no se encontró el pago al propietario en la base")
    return row

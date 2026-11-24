"""Dashboard: KPIs del mes por moneda y listas accionables (morosos, vencimientos, actualizaciones, borradores)."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from core import db
from core.auth import get_current_user
from core.fechas import hoy_ar

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])

VENTANA_VENCIMIENTO_DIAS = 60

INQUILINOS = """COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido)
                 ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos x JOIN datos_inquilinos i ON i.id_inquilino = x.id_inquilino
                 WHERE x.id_contrato = ca.id_contrato), '[]'::json) AS inquilinos"""

PROPIETARIOS = """COALESCE((SELECT json_agg(json_build_object('id', o.id_propietario, 'nombre', o.nombre, 'apellido', o.apellido)
                 ORDER BY o.apellido, o.nombre)
                 FROM propiedades_propietarios pp JOIN datos_propietarios o ON o.id_propietario = pp.id_propietario
                 WHERE pp.id_propiedad = ca.id_propiedad), '[]'::json) AS propietarios"""

KPIS = """
WITH liq AS (
  SELECT l.id_liquidacion, l.moneda, l.total, l.alquiler, ca.porcentaje_honorarios, el.nombre AS estado_liq,
         (SELECT pi.monto_total_pagado FROM pagos_inquilinos pi WHERE pi.id_liquidacion = l.id_liquidacion
          ORDER BY pi.id_pago_inquilino DESC LIMIT 1) AS cobrado,
         (SELECT ep.nombre FROM pagos_inquilinos pi LEFT JOIN estados_pago ep ON ep.id_estado_pago = pi.id_estado_pago
          WHERE pi.id_liquidacion = l.id_liquidacion ORDER BY pi.id_pago_inquilino DESC LIMIT 1) AS estado_pago
  FROM liquidaciones_mensuales l
  JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
  JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
  WHERE l."mes_año" = $1
), hon AS (
  SELECT l.moneda, SUM(round(l.alquiler * COALESCE(pp.porcentaje_honorarios_aplicado, 0) / 100, 2)) AS honorarios
  FROM pagos_propietarios pp
  JOIN liquidaciones_mensuales l ON l.id_liquidacion = pp.id_liquidacion
  WHERE date_trunc('month', pp.fecha_pago)::date = $1
  GROUP BY l.moneda
), act AS (
  SELECT ca.moneda, COUNT(*)::int AS contratos_activos
  FROM contratos_de_alquileres ca JOIN estados_contrato ec USING (id_estado_contrato)
  WHERE lower(ec.nombre) = 'activo' GROUP BY ca.moneda
)
SELECT COALESCE(a.moneda, l.moneda, h.moneda) AS moneda,
       COALESCE(a.contratos_activos, 0) AS contratos_activos,
       COALESCE(SUM(l.total), 0) AS total_mes,
       COALESCE(SUM(CASE WHEN lower(l.estado_liq) = 'pagada' THEN l.cobrado ELSE 0 END), 0) AS recaudado_mes,
       COALESCE(SUM(CASE WHEN lower(l.estado_liq) IN ('confirmada', 'notificada') AND lower(COALESCE(l.estado_pago, '')) <> 'pagado'
                         THEN l.total ELSE 0 END), 0) AS pendiente_mes,
       COALESCE(SUM(CASE WHEN lower(l.estado_liq) = 'borrador' THEN 1 ELSE 0 END), 0)::int AS borradores,
       COALESCE(MAX(h.honorarios), 0) AS honorarios_mes
FROM act a FULL JOIN liq l ON l.moneda = a.moneda FULL JOIN hon h ON h.moneda = COALESCE(a.moneda, l.moneda)
GROUP BY COALESCE(a.moneda, l.moneda, h.moneda), a.contratos_activos
ORDER BY 1
"""

MOROSOS = f"""
SELECT l.id_liquidacion AS id, l.id_contrato, l."mes_año", l.moneda, l.total, p.calle, p.numero, ci.nombre AS ciudad,
       {INQUILINOS},
       (SELECT ep.nombre FROM pagos_inquilinos pi LEFT JOIN estados_pago ep ON ep.id_estado_pago = pi.id_estado_pago
        WHERE pi.id_liquidacion = l.id_liquidacion ORDER BY pi.id_pago_inquilino DESC LIMIT 1) AS estado_pago,
       ($2::date - l."mes_año") AS dias_atraso
FROM liquidaciones_mensuales l
JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
WHERE l."mes_año" <= $1 AND lower(el.nombre) IN ('confirmada', 'notificada')
  AND NOT EXISTS (SELECT 1 FROM pagos_inquilinos pi JOIN estados_pago ep ON ep.id_estado_pago = pi.id_estado_pago
                  WHERE pi.id_liquidacion = l.id_liquidacion AND lower(ep.nombre) = 'pagado')
  AND ($2::date - l."mes_año") >= 10
ORDER BY l."mes_año", l.id_contrato
"""

VENCIMIENTOS = f"""
SELECT ca.id_contrato AS id, ca.id_contrato, ca.hasta, ca.moneda, ca.alquiler_actual,
       p.calle, p.numero, ci.nombre AS ciudad, {INQUILINOS}, {PROPIETARIOS},
       (ca.hasta - $1) AS dias_restantes
FROM contratos_de_alquileres ca
JOIN estados_contrato ec USING (id_estado_contrato)
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
WHERE lower(ec.nombre) = 'activo' AND ca.hasta <= $1 + make_interval(days => $2)
ORDER BY ca.hasta
"""

ACTUALIZACIONES = f"""
SELECT ca.id_contrato AS id, ca.id_contrato, ca.proxima_actualizacion, ca.moneda, ca.alquiler_actual,
       ca.indice_de_actualizacion, p.calle, p.numero, ci.nombre AS ciudad, {INQUILINOS},
       ($1 - ca.proxima_actualizacion) AS dias_vencida,
       EXISTS (SELECT 1 FROM comunicaciones co JOIN historial_de_actualizaciones h ON h.id_actualizacion = co.id_actualizacion
               WHERE h.id_contrato = ca.id_contrato AND co.aprobado IS NULL
                 AND h.fecha_de_actualizacion::date >= ca.proxima_actualizacion) AS pendiente_aprobacion
FROM contratos_de_alquileres ca
JOIN estados_contrato ec USING (id_estado_contrato)
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
WHERE lower(ec.nombre) = 'activo' AND ca.proxima_actualizacion <= $1
ORDER BY ca.proxima_actualizacion
"""

BORRADORES = f"""
SELECT l.id_liquidacion AS id, l.id_contrato, l."mes_año", l.moneda, l.total,
       p.calle, p.numero, ci.nombre AS ciudad, {INQUILINOS}
FROM liquidaciones_mensuales l
JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
WHERE l."mes_año" = $1 AND lower(el.nombre) = 'borrador'
ORDER BY l.id_contrato
"""


def _primer_dia(m: date):
    from fastapi import HTTPException
    if m.day != 1:
        raise HTTPException(status_code=400, detail="El mes debe ser el primer día (AAAA-MM-01)")


@router.get("")
async def dashboard(mes: date):
    _primer_dia(mes)
    hoy = hoy_ar()
    return {
        "mes": mes.isoformat(),
        "hoy": hoy.isoformat(),
        "ventana_vencimiento_dias": VENTANA_VENCIMIENTO_DIAS,
        "kpis": await db.fetch(KPIS, mes),
        "morosos": await db.fetch(MOROSOS, mes, hoy),
        "vencimientos_contratos": await db.fetch(VENCIMIENTOS, hoy, VENTANA_VENCIMIENTO_DIAS),
        "actualizaciones_pendientes": await db.fetch(ACTUALIZACIONES, hoy),
        "borradores_mes": await db.fetch(BORRADORES, mes),
    }

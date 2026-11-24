"""Actualizaciones de alquiler: contratos vencidos, disparo del flujo A e historial (solo lectura)."""
from fastapi import APIRouter, Depends, HTTPException

from core import db, n8n
from core.auth import get_current_user
from core.fechas import hoy_ar
from core.webhooks import llamar

router = APIRouter(prefix="/actualizaciones", tags=["actualizaciones"], dependencies=[Depends(get_current_user)])

INQUILINOS = """COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido) ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos x JOIN datos_inquilinos i ON i.id_inquilino = x.id_inquilino
                 WHERE x.id_contrato = ca.id_contrato), '[]'::json) AS inquilinos"""

# Pedido ya enviado a Telegram para este vencimiento y todavía sin respuesta.
PEDIDO_PENDIENTE = """EXISTS (SELECT 1 FROM comunicaciones co JOIN historial_de_actualizaciones h ON h.id_actualizacion = co.id_actualizacion
                     WHERE h.id_contrato = ca.id_contrato AND co.aprobado IS NULL
                       AND h.fecha_de_actualizacion::date >= ca.proxima_actualizacion)"""

CONTRATOS = """FROM contratos_de_alquileres ca
LEFT JOIN estados_contrato ec ON ec.id_estado_contrato = ca.id_estado_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad"""

VENCIDA = "lower(ec.nombre) = 'activo' AND ca.proxima_actualizacion <= $1"

VENCIDAS = f"""
SELECT ca.id_contrato AS id, ca.id_contrato, ca.alquiler_actual, ca.moneda, ca.indice_de_actualizacion, ca.frecuencia_de_actualizacion,
       ca.proxima_actualizacion, p.calle, p.numero, ci.nombre AS ciudad, {INQUILINOS},
       (SELECT max(h.fecha_de_actualizacion) FROM historial_de_actualizaciones h WHERE h.id_contrato = ca.id_contrato) AS ultima_actualizacion,
       {PEDIDO_PENDIENTE} AS pendiente_aprobacion, ($1 - ca.proxima_actualizacion) AS dias_vencida
{CONTRATOS}
WHERE {VENCIDA}"""

HISTORIAL = f"""
SELECT h.id_actualizacion AS id, h.id_actualizacion, h.id_contrato, h.fecha_de_actualizacion, h.indice_de_actualizacion, h.porcentaje_aplicado,
       h.alquiler_anterior, h.alquiler_nuevo, ca.moneda, p.calle, p.numero, ci.nombre AS ciudad, {INQUILINOS},
       co.id_comunicacion, co.fecha_envio, co.mensaje, co.aprobado
FROM historial_de_actualizaciones h
LEFT JOIN contratos_de_alquileres ca ON ca.id_contrato = h.id_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
LEFT JOIN LATERAL (SELECT * FROM comunicaciones c WHERE c.id_actualizacion = h.id_actualizacion ORDER BY c.id_comunicacion DESC LIMIT 1) co ON true
ORDER BY h.fecha_de_actualizacion DESC NULLS LAST, h.id_actualizacion DESC"""

COMUNICACIONES = f"""
SELECT co.id_comunicacion AS id, co.id_comunicacion, co.id_contrato, co.id_actualizacion, co.fecha_envio, co.mensaje, co.aprobado,
       p.calle, p.numero, {INQUILINOS}
FROM comunicaciones co
LEFT JOIN contratos_de_alquileres ca ON ca.id_contrato = co.id_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
ORDER BY co.fecha_envio DESC NULLS LAST, co.id_comunicacion DESC"""


@router.get("/vencidas")
async def vencidas():
    return await db.fetch(f"{VENCIDAS} ORDER BY ca.proxima_actualizacion, ca.id_contrato", hoy_ar())


@router.get("/historial")
async def historial():
    return await db.fetch(HISTORIAL)


@router.get("/comunicaciones")
async def comunicaciones():
    return await db.fetch(COMUNICACIONES)


@router.post("/ejecutar")
async def ejecutar():
    filas = await db.fetch(VENCIDAS, hoy_ar())
    if not filas:
        raise HTTPException(status_code=400, detail="No hay contratos activos con la actualización vencida.")
    if all(f["pendiente_aprobacion"] for f in filas):
        raise HTTPException(status_code=400, detail="Todos los contratos vencidos ya tienen un pedido de aprobación pendiente en Telegram.")
    r = await llamar("actualizar_alquileres", n8n.SinDatos(), "actualizar-alquileres")
    try:
        respuesta = r.json()
    except ValueError:
        respuesta = None
    return {"respuesta": respuesta, "vencidas": len(filas)}

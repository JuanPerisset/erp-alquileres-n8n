"""Contratos (contratos_de_alquileres + contratos_inquilinos). Los propietarios se derivan de la propiedad."""
import calendar
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException

from core import db
from core.auth import get_current_user
from core.fechas import hoy_ar
from core.modelos import INDICES, MONEDAS, ContratoIn, EstadoContratoIn
from core.validaciones import error_campos


def _sumar_meses(fecha: date, meses: int) -> date:
    m_total = (fecha.month - 1) + meses
    y = fecha.year + (m_total // 12)
    m = (m_total % 12) + 1
    ultimo_dia = calendar.monthrange(y, m)[1]
    return date(y, m, min(fecha.day, ultimo_dia))

router = APIRouter(prefix="/contratos", tags=["contratos"], dependencies=[Depends(get_current_user)])

CAMPOS = ["id_propiedad", "alquiler_actual", "desde", "hasta", "frecuencia_de_actualizacion", "proxima_actualizacion",
          "indice_de_actualizacion", "forma_pago", "porcentaje_honorarios", "id_estado_contrato", "moneda"]

SELECT = """
SELECT ca.*, ca.id_contrato AS id, ec.nombre AS estado, p.calle, p.numero, c.nombre AS ciudad, b.nombre AS barrio,
       COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido,
                                                   'celular', i.celular, 'email', i.email, 'dni', i.dni)
                                 ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos ci JOIN datos_inquilinos i ON i.id_inquilino = ci.id_inquilino
                 WHERE ci.id_contrato = ca.id_contrato), '[]'::json) AS inquilinos,
       COALESCE((SELECT json_agg(json_build_object('id', o.id_propietario, 'nombre', o.nombre, 'apellido', o.apellido,
                                                   'celular', o.celular, 'email', o.email)
                                 ORDER BY o.apellido, o.nombre)
                 FROM propiedades_propietarios pp JOIN datos_propietarios o ON o.id_propietario = pp.id_propietario
                 WHERE pp.id_propiedad = ca.id_propiedad), '[]'::json) AS propietarios,
       (SELECT count(*) FROM liquidaciones_mensuales l WHERE l.id_contrato = ca.id_contrato) AS liquidaciones,
       (SELECT count(*) FROM historial_de_actualizaciones h WHERE h.id_contrato = ca.id_contrato)
         + (SELECT count(*) FROM comunicaciones co WHERE co.id_contrato = ca.id_contrato) AS otros_vinculos,
       (lower(ec.nombre) = 'activo' AND ca.hasta < $1) AS vencido_sugerido,
       (lower(ec.nombre) = 'activo' AND ca.proxima_actualizacion <= $1) AS actualizacion_vencida
FROM contratos_de_alquileres ca
LEFT JOIN estados_contrato ec ON ec.id_estado_contrato = ca.id_estado_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades c ON c.id_ciudad = p.id_ciudad
LEFT JOIN barrios b ON b.id_barrio = p.id_barrio
"""

HISTORIAL = """SELECT id_actualizacion, fecha_de_actualizacion, indice_de_actualizacion, porcentaje_aplicado,
                      alquiler_anterior, alquiler_nuevo
               FROM historial_de_actualizaciones WHERE id_contrato = $1 ORDER BY fecha_de_actualizacion DESC"""

LIQUIDACIONES = """
SELECT l.id_liquidacion, l."mes_año", l.alquiler, l.total, l.moneda, el.nombre AS estado_liquidacion,
       ep.nombre AS estado_pago, pi.fecha_pago, pi.monto_total_pagado
FROM liquidaciones_mensuales l
LEFT JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
LEFT JOIN LATERAL (SELECT * FROM pagos_inquilinos p WHERE p.id_liquidacion = l.id_liquidacion
                   ORDER BY p.id_pago_inquilino DESC LIMIT 1) pi ON true
LEFT JOIN estados_pago ep ON ep.id_estado_pago = pi.id_estado_pago
WHERE l.id_contrato = $1 ORDER BY l."mes_año" DESC
"""


async def _obtener(id_: int):
    row = await db.fetchrow(f"{SELECT} WHERE ca.id_contrato = $2", hoy_ar(), id_)
    if not row:
        raise HTTPException(status_code=404, detail="No existe el contrato")
    return row


async def _estado_es(id_estado, nombre: str) -> bool:
    return bool(await db.fetchval("SELECT 1 FROM estados_contrato WHERE id_estado_contrato = $1 AND lower(nombre) = $2",
                                  id_estado, nombre))


async def _preparar(body: ContratoIn, id_: int = 0) -> dict:
    d = {k: getattr(body, k) for k in CAMPOS}
    e = {}
    for k, msg in (("id_propiedad", "Elegí la propiedad"), ("desde", "Obligatorio"), ("hasta", "Obligatorio"),
                   ("alquiler_actual", "Obligatorio"), ("id_estado_contrato", "Obligatorio"), ("moneda", "Obligatorio")):
        if d[k] is None:
            e[k] = msg
    if not body.inquilinos:
        e["inquilinos"] = "Elegí al menos un inquilino"
    if d["desde"] and d["hasta"] and d["hasta"] <= d["desde"]:
        e["hasta"] = "Debe ser posterior a la fecha desde"
    if d["alquiler_actual"] is not None and d["alquiler_actual"] <= 0:
        e["alquiler_actual"] = "Debe ser mayor a 0"
    if d["frecuencia_de_actualizacion"] is not None and d["frecuencia_de_actualizacion"] < 1:
        e["frecuencia_de_actualizacion"] = "Debe ser al menos 1 mes"
    if d["indice_de_actualizacion"] and d["indice_de_actualizacion"] not in INDICES:
        e["indice_de_actualizacion"] = "Índice inválido"
    if d["porcentaje_honorarios"] is not None and not (0 <= d["porcentaje_honorarios"] <= 100):
        e["porcentaje_honorarios"] = "Entre 0 y 100"
    if d["moneda"] and d["moneda"] not in MONEDAS:
        e["moneda"] = "Moneda inválida"
    error_campos(e)

    if not await db.fetchval("SELECT 1 FROM datos_propiedades WHERE id_propiedad = $1", d["id_propiedad"]):
        error_campos({"id_propiedad": "La propiedad no existe"})
    if not await db.fetchval("SELECT 1 FROM estados_contrato WHERE id_estado_contrato = $1", d["id_estado_contrato"]):
        error_campos({"id_estado_contrato": "Estado inválido"})
    ids = sorted(set(body.inquilinos))
    if await db.fetchval("SELECT count(*) FROM datos_inquilinos WHERE id_inquilino = ANY($1::int[])", ids) != len(ids):
        error_campos({"inquilinos": "Hay inquilinos inexistentes"})
    if await _estado_es(d["id_estado_contrato"], "activo"):
        otro = await db.fetchval(
            """SELECT ca.id_contrato FROM contratos_de_alquileres ca JOIN estados_contrato ec USING (id_estado_contrato)
               WHERE ca.id_propiedad = $1 AND lower(ec.nombre) = 'activo' AND ca.id_contrato <> $2 LIMIT 1""",
            d["id_propiedad"], id_)
        if otro:
            error_campos({"id_propiedad": f"La propiedad ya tiene otro contrato activo (#{otro})"})
    if id_:
        actual = await db.fetchrow("SELECT moneda FROM contratos_de_alquileres WHERE id_contrato = $1", id_)
        liqs = await db.fetchval("SELECT count(*) FROM liquidaciones_mensuales WHERE id_contrato = $1", id_)
        if liqs and actual["moneda"] != d["moneda"]:
            error_campos({"moneda": "No se puede cambiar la moneda: el contrato ya tiene liquidaciones"})
    return d


async def _guardar_inquilinos(conn, id_: int, ids):
    await conn.execute("DELETE FROM contratos_inquilinos WHERE id_contrato = $1", id_)
    await conn.executemany("INSERT INTO contratos_inquilinos (id_contrato, id_inquilino) VALUES ($1, $2)",
                           [(id_, i) for i in sorted(set(ids))])


@router.get("")
async def listar():
    return await db.fetch(f"{SELECT} ORDER BY ca.id_contrato", hoy_ar())


@router.get("/{id_}")
async def detalle(id_: int):
    row = await _obtener(id_)
    row["historial"] = await db.fetch(HISTORIAL, id_)
    row["lista_liquidaciones"] = await db.fetch(LIQUIDACIONES, id_)
    return row


@router.post("")
async def crear(body: ContratoIn):
    d = await _preparar(body)
    cols = list(d)
    async with db.transaccion() as conn:
        nuevo = await conn.fetchval(
            f"INSERT INTO contratos_de_alquileres ({', '.join(cols)}) "
            f"VALUES ({', '.join(f'${i + 1}' for i in range(len(cols)))}) RETURNING id_contrato", *d.values())
        await _guardar_inquilinos(conn, nuevo, body.inquilinos)
    return await _obtener(nuevo)


@router.put("/{id_}")
async def editar(id_: int, body: ContratoIn):
    prev = await _obtener(id_)
    d = await _preparar(body, id_)
    alq_ant = prev["alquiler_actual"]
    alq_nuevo = d["alquiler_actual"]
    cambio_alquiler = alq_ant is not None and alq_nuevo is not None and Decimal(str(alq_ant)) != Decimal(str(alq_nuevo))
    if cambio_alquiler:
        frec = d.get("frecuencia_de_actualizacion") or prev.get("frecuencia_de_actualizacion") or 6
        prox_prev = prev.get("proxima_actualizacion")
        if d.get("proxima_actualizacion") == prox_prev and prox_prev is not None and prox_prev <= hoy_ar():
            base_fecha = prox_prev
            while base_fecha <= hoy_ar():
                base_fecha = _sumar_meses(base_fecha, int(frec))
            d["proxima_actualizacion"] = base_fecha
    sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(d))
    async with db.transaccion() as conn:
        await conn.execute(f"UPDATE contratos_de_alquileres SET {sets}, updated_at = now() WHERE id_contrato = $1", id_, *d.values())
        await _guardar_inquilinos(conn, id_, body.inquilinos)
        if cambio_alquiler and Decimal(str(alq_ant)) > 0:
            pct = round(((Decimal(str(alq_nuevo)) - Decimal(str(alq_ant))) / Decimal(str(alq_ant))) * 100, 4)
            await conn.execute(
                """INSERT INTO historial_de_actualizaciones
                   (id_contrato, fecha_de_actualizacion, indice_de_actualizacion, porcentaje_aplicado, alquiler_anterior, alquiler_nuevo)
                   VALUES ($1, now(), $2, $3, $4, $5)""",
                id_, d.get("indice_de_actualizacion") or "Manual", pct, alq_ant, alq_nuevo
            )
            await conn.execute(
                """UPDATE liquidaciones_mensuales l
                   SET alquiler = $2,
                       total = $2
                         + COALESCE((SELECT COALESCE(luz,0)+COALESCE(gas,0)+COALESCE(agua,0)+COALESCE(municipal,0)+COALESCE(expensas,0)+COALESCE(seguro,0)
                                     FROM servicios_mensuales s WHERE s.id_liquidacion = l.id_liquidacion ORDER BY s.id_servicio DESC LIMIT 1), 0)
                         + COALESCE((SELECT SUM(CASE WHEN tipo = 'adicional' THEN monto ELSE -monto END)
                                     FROM conceptos_liquidacion c WHERE c.id_liquidacion = l.id_liquidacion), 0),
                       updated_at = now()
                   FROM estados_liquidacion el
                   WHERE l.id_estado_liquidacion = el.id_estado_liquidacion
                     AND lower(el.nombre) = 'borrador'
                     AND l.id_contrato = $1""",
                id_, alq_nuevo
            )
    return await _obtener(id_)


@router.patch("/{id_}/estado")
async def cambiar_estado(id_: int, body: EstadoContratoIn):
    row = await _obtener(id_)
    if not await db.fetchval("SELECT 1 FROM estados_contrato WHERE id_estado_contrato = $1", body.id_estado_contrato):
        raise HTTPException(status_code=400, detail="Estado inválido")
    if await _estado_es(body.id_estado_contrato, "activo"):
        otro = await db.fetchval(
            """SELECT ca.id_contrato FROM contratos_de_alquileres ca JOIN estados_contrato ec USING (id_estado_contrato)
               WHERE ca.id_propiedad = $1 AND lower(ec.nombre) = 'activo' AND ca.id_contrato <> $2 LIMIT 1""",
            row["id_propiedad"], id_)
        if otro:
            raise HTTPException(status_code=400, detail=f"La propiedad ya tiene otro contrato activo (#{otro})")
    await db.execute("UPDATE contratos_de_alquileres SET id_estado_contrato = $2, updated_at = now() WHERE id_contrato = $1",
                     id_, body.id_estado_contrato)
    return await _obtener(id_)


@router.delete("/{id_}")
async def eliminar(id_: int):
    row = await _obtener(id_)
    if row["liquidaciones"] or row["otros_vinculos"]:
        raise HTTPException(status_code=409, detail="Tiene liquidaciones o historial; no se puede eliminar. Pasalo a inactivo.")
    async with db.transaccion() as conn:
        await conn.execute("DELETE FROM contratos_inquilinos WHERE id_contrato = $1", id_)
        await conn.execute("DELETE FROM contratos_de_alquileres WHERE id_contrato = $1", id_)
    return {"ok": True}

"""Liquidaciones mensuales: borradores, edición, confirmación, notificación (B) y cobro (C)."""
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, n8n
from core.auth import get_current_user
from core.fechas import hoy_ar
from core.modelos import Entrada
from core.webhooks import llamar

router = APIRouter(prefix="/liquidaciones", tags=["liquidaciones"], dependencies=[Depends(get_current_user)])
SERV = ["luz", "gas", "agua", "municipal", "expensas", "seguro"]

SELECT = """
SELECT l.id_liquidacion AS id, l.id_contrato, l."mes_año", l.moneda, l.alquiler, l.total, l.id_estado_liquidacion,
       el.nombre AS estado_liquidacion, l.fecha_confirmacion, ca.alquiler_actual, ca.porcentaje_honorarios,
       p.calle, p.numero, p.codigo_luz, p.codigo_gas, p.codigo_agua, p.codigo_municipal, ci.nombre AS ciudad,
       COALESCE(s.luz,0)+COALESCE(s.gas,0)+COALESCE(s.agua,0)+COALESCE(s.municipal,0)+COALESCE(s.expensas,0)+COALESCE(s.seguro,0) AS servicios,
       COALESCE((SELECT sum(monto) FROM conceptos_liquidacion c WHERE c.id_liquidacion = l.id_liquidacion AND c.tipo = 'adicional'), 0) AS adicionales,
       COALESCE((SELECT sum(monto) FROM conceptos_liquidacion c WHERE c.id_liquidacion = l.id_liquidacion AND c.tipo = 'descuento'), 0) AS descuentos,
       COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido) ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos x JOIN datos_inquilinos i ON i.id_inquilino = x.id_inquilino
                 WHERE x.id_contrato = l.id_contrato), '[]'::json) AS inquilinos,
       pi.id_pago_inquilino, pi.id_estado_pago, ep.nombre AS estado_pago, pi.fecha_pago, pi.monto_base, pi.porcentaje_mora,
       pi.monto_mora, pi.monto_total_pagado, pi.fecha_detalle_enviado, pi.fecha_comprobante, rm.rango AS regla_mora
FROM liquidaciones_mensuales l
JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
LEFT JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
LEFT JOIN ciudades ci ON ci.id_ciudad = p.id_ciudad
LEFT JOIN LATERAL (SELECT * FROM servicios_mensuales sm WHERE sm.id_liquidacion = l.id_liquidacion ORDER BY sm.id_servicio DESC LIMIT 1) s ON true
LEFT JOIN LATERAL (SELECT * FROM pagos_inquilinos x WHERE x.id_liquidacion = l.id_liquidacion ORDER BY x.id_pago_inquilino DESC LIMIT 1) pi ON true
LEFT JOIN estados_pago ep ON ep.id_estado_pago = pi.id_estado_pago
LEFT JOIN reglas_mora rm ON rm.id_regla = pi.id_regla_mora
"""

RECALCULAR = """
UPDATE liquidaciones_mensuales l SET updated_at = now(), total = l.alquiler
  + COALESCE((SELECT COALESCE(luz,0)+COALESCE(gas,0)+COALESCE(agua,0)+COALESCE(municipal,0)+COALESCE(expensas,0)+COALESCE(seguro,0)
              FROM servicios_mensuales s WHERE s.id_liquidacion = l.id_liquidacion ORDER BY s.id_servicio DESC LIMIT 1), 0)
  + COALESCE((SELECT SUM(CASE WHEN tipo = 'adicional' THEN monto ELSE -monto END)
              FROM conceptos_liquidacion c WHERE c.id_liquidacion = l.id_liquidacion), 0)
WHERE l.id_liquidacion = $1
"""


class MesIn(BaseModel):
    mes_año: date


class NotificarIn(BaseModel):
    mes_año: Optional[date] = None


class ServiciosIn(Entrada):
    luz: Optional[Decimal] = Field(None, ge=0)
    gas: Optional[Decimal] = Field(None, ge=0)
    agua: Optional[Decimal] = Field(None, ge=0)
    municipal: Optional[Decimal] = Field(None, ge=0)
    expensas: Optional[Decimal] = Field(None, ge=0)
    seguro: Optional[Decimal] = Field(None, ge=0)


class ConceptoIn(Entrada):
    descripcion: str = Field(min_length=1)
    monto: Decimal = Field(gt=0)
    tipo: Literal["adicional", "descuento"]
    observacion: Optional[str] = None


class CobroIn(BaseModel):
    fecha_pago: date


async def id_estado(tabla, pk, nombre):
    v = await db.fetchval(f"SELECT {pk} FROM {tabla} WHERE lower(nombre) = $1", nombre)
    if v is None:
        raise HTTPException(status_code=500, detail=f"Falta el estado '{nombre}' en {tabla}")
    return v


def _primer_dia(m: date):
    if m.day != 1:
        raise HTTPException(status_code=400, detail="El mes debe ser el primer día (AAAA-MM-01)")


async def _obtener(id_: int):
    row = await db.fetchrow(f"{SELECT} WHERE l.id_liquidacion = $1", id_)
    if not row:
        raise HTTPException(status_code=404, detail="No existe la liquidación")
    return row


async def _borrador(id_: int):
    row = await _obtener(id_)
    if row["estado_liquidacion"].lower() != "borrador":
        raise HTTPException(status_code=400, detail="Solo se puede editar una liquidación en borrador")
    return row


@router.get("")
async def listar(mes: date):
    _primer_dia(mes)
    return await db.fetch(f'{SELECT} WHERE l."mes_año" = $1 ORDER BY l.id_contrato', mes)


@router.post("/generar")
async def generar(body: MesIn):
    _primer_dia(body.mes_año)
    borrador = await id_estado("estados_liquidacion", "id_estado_liquidacion", "borrador")
    activo = await id_estado("estados_contrato", "id_estado_contrato", "activo")
    async with db.transaccion() as c:
        await c.execute("SELECT pg_advisory_xact_lock(hashtext('generar_borradores'))")
        filas = await c.fetch(
            """INSERT INTO liquidaciones_mensuales (id_contrato, alquiler, intereses_mora, total, "mes_año", moneda, id_estado_liquidacion)
               SELECT ca.id_contrato, ca.alquiler_actual, 0, ca.alquiler_actual, $1, ca.moneda, $2
               FROM contratos_de_alquileres ca
               WHERE ca.id_estado_contrato = $3 AND ca.alquiler_actual IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM liquidaciones_mensuales l WHERE l.id_contrato = ca.id_contrato AND l."mes_año" = $1)
               RETURNING id_liquidacion""", body.mes_año, borrador, activo)
    return {"creadas": len(filas)}


@router.post("/confirmar-borradores")
async def confirmar_borradores(body: MesIn):
    _primer_dia(body.mes_año)
    borrador = await id_estado("estados_liquidacion", "id_estado_liquidacion", "borrador")
    confirmada = await id_estado("estados_liquidacion", "id_estado_liquidacion", "confirmada")
    confirmado = await id_estado("estados_servicios", "id_estado_servicio", "confirmado")
    async with db.transaccion() as c:
        filas = await c.fetch(
            """SELECT id_liquidacion FROM liquidaciones_mensuales
               WHERE "mes_año" = $1 AND id_estado_liquidacion = $2
               ORDER BY id_liquidacion""", body.mes_año, borrador)
        for f in filas:
            lid = f["id_liquidacion"]
            await c.execute(RECALCULAR, lid)
            await c.execute(
                "UPDATE liquidaciones_mensuales SET id_estado_liquidacion = $2, fecha_confirmacion = now(), updated_at = now() WHERE id_liquidacion = $1",
                lid, confirmada)
            await c.execute(
                "UPDATE servicios_mensuales SET id_estado_servicio = $2, updated_at = now() WHERE id_liquidacion = $1",
                lid, confirmado)
    return {"confirmadas": len(filas)}


@router.get("/{id_}")
async def detalle(id_: int):
    row = await _obtener(id_)
    row["servicios_detalle"] = await db.fetchrow(
        "SELECT * FROM servicios_mensuales WHERE id_liquidacion = $1 ORDER BY id_servicio DESC LIMIT 1", id_)
    row["conceptos"] = await db.fetch("SELECT * FROM conceptos_liquidacion WHERE id_liquidacion = $1 ORDER BY id_concepto", id_)
    row["pago_propietario"] = await db.fetchrow(
        """SELECT pp.*, ep.nombre AS estado FROM pagos_propietarios pp
           LEFT JOIN estados_pago ep ON ep.id_estado_pago = pp.id_estado_pago WHERE pp.id_liquidacion = $1""", id_)
    vecinos = await db.fetch(
        'SELECT id_liquidacion FROM liquidaciones_mensuales WHERE "mes_año" = $1 ORDER BY id_contrato, id_liquidacion',
        row["mes_año"])
    ids_mes = [v["id_liquidacion"] for v in vecinos]
    if id_ in ids_mes:
        idx = ids_mes.index(id_)
        row["anterior_id"] = ids_mes[idx - 1] if idx > 0 else None
        row["siguiente_id"] = ids_mes[idx + 1] if idx + 1 < len(ids_mes) else None
        row["posicion_mes"] = idx + 1
        row["total_mes"] = len(ids_mes)
    else:
        row["anterior_id"] = None
        row["siguiente_id"] = None
        row["posicion_mes"] = 1
        row["total_mes"] = 1
    return row


@router.put("/{id_}/servicios")
async def servicios(id_: int, body: ServiciosIn):
    await _borrador(id_)
    cargado = await id_estado("estados_servicios", "id_estado_servicio", "cargado")
    vals = [getattr(body, k) for k in SERV]
    async with db.transaccion() as c:
        sid = await c.fetchval("SELECT id_servicio FROM servicios_mensuales WHERE id_liquidacion = $1 ORDER BY id_servicio DESC LIMIT 1", id_)
        if sid:
            await c.execute(f"UPDATE servicios_mensuales SET {', '.join(f'{k} = ${i + 2}' for i, k in enumerate(SERV))}, "
                            f"id_estado_servicio = $8, updated_at = now() WHERE id_servicio = $1", sid, *vals, cargado)
        else:
            await c.execute(f"INSERT INTO servicios_mensuales (id_liquidacion, {', '.join(SERV)}, id_estado_servicio) "
                            f"VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", id_, *vals, cargado)
        await c.execute(RECALCULAR, id_)
    return await detalle(id_)


@router.post("/{id_}/conceptos")
async def crear_concepto(id_: int, body: ConceptoIn):
    await _borrador(id_)
    async with db.transaccion() as c:
        await c.execute("INSERT INTO conceptos_liquidacion (id_liquidacion, descripcion, monto, tipo, observacion) VALUES ($1, $2, $3, $4, $5)",
                        id_, body.descripcion, body.monto, body.tipo, body.observacion)
        await c.execute(RECALCULAR, id_)
    return await detalle(id_)


async def _concepto(id_: int, id_concepto: int):
    await _borrador(id_)
    if not await db.fetchval("SELECT 1 FROM conceptos_liquidacion WHERE id_concepto = $1 AND id_liquidacion = $2", id_concepto, id_):
        raise HTTPException(status_code=404, detail="No existe el concepto")


@router.put("/{id_}/conceptos/{id_concepto}")
async def editar_concepto(id_: int, id_concepto: int, body: ConceptoIn):
    await _concepto(id_, id_concepto)
    async with db.transaccion() as c:
        await c.execute("UPDATE conceptos_liquidacion SET descripcion = $2, monto = $3, tipo = $4, observacion = $5, updated_at = now() "
                        "WHERE id_concepto = $1", id_concepto, body.descripcion, body.monto, body.tipo, body.observacion)
        await c.execute(RECALCULAR, id_)
    return await detalle(id_)


@router.delete("/{id_}/conceptos/{id_concepto}")
async def borrar_concepto(id_: int, id_concepto: int):
    await _concepto(id_, id_concepto)
    async with db.transaccion() as c:
        await c.execute("DELETE FROM conceptos_liquidacion WHERE id_concepto = $1", id_concepto)
        await c.execute(RECALCULAR, id_)
    return await detalle(id_)


@router.post("/{id_}/refrescar-alquiler")
async def refrescar(id_: int):
    await _borrador(id_)
    async with db.transaccion() as c:
        await c.execute("""UPDATE liquidaciones_mensuales l SET alquiler = ca.alquiler_actual FROM contratos_de_alquileres ca
                           WHERE ca.id_contrato = l.id_contrato AND l.id_liquidacion = $1""", id_)
        await c.execute(RECALCULAR, id_)
    return await detalle(id_)


@router.post("/{id_}/confirmar")
async def confirmar(id_: int):
    await _borrador(id_)
    confirmada = await id_estado("estados_liquidacion", "id_estado_liquidacion", "confirmada")
    confirmado = await id_estado("estados_servicios", "id_estado_servicio", "confirmado")
    async with db.transaccion() as c:
        await c.execute(RECALCULAR, id_)
        await c.execute("UPDATE liquidaciones_mensuales SET id_estado_liquidacion = $2, fecha_confirmacion = now(), updated_at = now() "
                        "WHERE id_liquidacion = $1", id_, confirmada)
        await c.execute("UPDATE servicios_mensuales SET id_estado_servicio = $2, updated_at = now() WHERE id_liquidacion = $1", id_, confirmado)
    return await detalle(id_)


@router.post("/notificar")
async def notificar(body: NotificarIn):
    if body.mes_año:
        _primer_dia(body.mes_año)
    r = await llamar("notificar_liquidaciones", n8n.NotificarLiquidacionesPayload(mes_año=body.mes_año), "notificar")
    return {"ok": True, "respuesta": r.json() if "json" in r.headers.get("content-type", "") else r.text[:300]}


def _validar_rango_fecha_cobro(row: dict, fecha: date):
    min_fecha = row["mes_año"] - timedelta(days=5)
    if fecha < min_fecha:
        raise HTTPException(
            status_code=400,
            detail=f"La fecha de pago no puede ser de un mes anterior al período liquidado (mínimo permitido: {min_fecha.strftime('%d/%m/%Y')})"
        )


async def _vista_previa(row: dict, fecha: date):
    _validar_rango_fecha_cobro(row, fecha)
    dias = max(0, (fecha - row["mes_año"]).days + 1)
    regla = await db.fetchrow("SELECT id_regla, rango, porcentaje_mora FROM reglas_mora WHERE activo AND $1 BETWEEN dias_desde AND dias_hasta "
                              "ORDER BY dias_desde LIMIT 1", min(dias, 999))
    pct = regla["porcentaje_mora"] if regla else Decimal(0)
    # La mora se calcula sobre el TOTAL de la liquidación (alquiler + servicios + conceptos), igual que el flujo C de n8n.
    base = Decimal(str(row["total"]))
    mora = round(base * pct / 100, 2)
    return {"dias": dias, "regla": regla, "porcentaje_mora": pct, "alquiler": row["alquiler"], "base_mora": base,
            "monto_mora": mora, "total_liquidacion": row["total"], "total_a_cobrar": base + mora, "moneda": row["moneda"]}


def _validar_cobro(row: dict, fecha: date):
    if not row["id_pago_inquilino"] or (row["estado_pago"] or "").lower() != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se puede registrar el cobro si existe el pago del inquilino en estado pendiente")
    _validar_rango_fecha_cobro(row, fecha)


@router.get("/{id_}/vista-previa-mora")
async def vista_previa(id_: int, fecha_pago: date):
    return await _vista_previa(await _obtener(id_), fecha_pago)


@router.post("/{id_}/cobro")
async def cobro(id_: int, body: CobroIn):
    _validar_cobro(await _obtener(id_), body.fecha_pago)
    await llamar("registrar_cobro", n8n.RegistrarCobroPayload(id_liquidacion=id_, fecha_pago=body.fecha_pago), f"cobro-{id_}")
    return await detalle(id_)

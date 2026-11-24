"""SIMULADOR de n8n SOLO para la base de PRUEBA (N8N_MODO=simulador). Imita los flujos A a E.
En producción N8N_MODO debe ser 'real' y este módulo no se usa."""
import asyncio
from datetime import datetime, timezone
from decimal import Decimal

import httpx

from core import db, pdf_simulado
from core.fechas import hoy_ar

PCT_SIMULADO = {"IPC": Decimal("9.50"), "ICL": Decimal("10.20")}
AHORA_AR = "(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')"


async def _id(tabla, pk, nombre):
    return await db.fetchval(f"SELECT {pk} FROM {tabla} WHERE lower(nombre) = $1", nombre)


async def _notificar(p: dict):
    pendiente = await _id("estados_pago", "id_estado_pago", "pendiente")
    confirmada = await _id("estados_liquidacion", "id_estado_liquidacion", "confirmada")
    mes = p.get("mes_año")
    if isinstance(mes, str):
        mes = datetime.strptime(mes, "%Y-%m-%d").date()
    async with db.transaccion() as c:
        ids = await c.fetch(
            """INSERT INTO pagos_inquilinos (id_liquidacion, monto_base, id_estado_pago, fecha_detalle_enviado)
               SELECT l.id_liquidacion, l.total, $1, now() FROM liquidaciones_mensuales l
               WHERE l.id_estado_liquidacion = $2 AND ($3::date IS NULL OR l."mes_año" = $3)
                 AND NOT EXISTS (SELECT 1 FROM pagos_inquilinos x WHERE x.id_liquidacion = l.id_liquidacion)
               RETURNING id_liquidacion""", pendiente, confirmada, mes)
        lista = [r["id_liquidacion"] for r in ids]
        await c.execute(
            """INSERT INTO comunicaciones_externas (id_liquidacion, tipo_destinatario, celular_destino, tipo_mensaje, estado_envio)
               SELECT l.id_liquidacion, 'INQUILINO', COALESCE(i.celular, ''), 'DETALLE_LIQUIDACION', 'ENVIADO'
               FROM liquidaciones_mensuales l JOIN contratos_inquilinos ci ON ci.id_contrato = l.id_contrato
               JOIN datos_inquilinos i ON i.id_inquilino = ci.id_inquilino WHERE l.id_liquidacion = ANY($1::int[])""", lista)
    return {"ok": True, "notificadas": len(lista)}


async def _cobro(p: dict):
    pagado = await _id("estados_pago", "id_estado_pago", "pagado")
    pagada = await _id("estados_liquidacion", "id_estado_liquidacion", "pagada")
    fecha = datetime.strptime(p["fecha_pago"], "%Y-%m-%d").date()
    async with db.transaccion() as c:
        # Igual que el flujo C real: la base de la mora es pagos_inquilinos.monto_base (= total de la liquidación al notificar).
        l = await c.fetchrow(
            """SELECT l.id_liquidacion, l."mes_año",
                      COALESCE((SELECT x.monto_base FROM pagos_inquilinos x WHERE x.id_liquidacion = l.id_liquidacion
                                ORDER BY x.id_pago_inquilino DESC LIMIT 1), l.total) AS base
               FROM liquidaciones_mensuales l WHERE l.id_liquidacion = $1""", p["id_liquidacion"])
        dias = max(0, (fecha - l["mes_año"]).days + 1)
        r = await c.fetchrow("SELECT id_regla, porcentaje_mora FROM reglas_mora WHERE activo AND $1 BETWEEN dias_desde AND dias_hasta "
                             "ORDER BY dias_desde LIMIT 1", dias)
        pct = r["porcentaje_mora"] if r else 0
        mora = round(l["base"] * pct / 100, 2)
        await c.execute(
            """UPDATE pagos_inquilinos SET fecha_pago = $2, id_regla_mora = $3, porcentaje_mora = $4, monto_mora = $5,
                 monto_total_pagado = monto_base + $5, id_estado_pago = $6, comprobante_enviado = true,
                 fecha_comprobante = now(), updated_at = now() WHERE id_liquidacion = $1""",
            l["id_liquidacion"], fecha, r["id_regla"] if r else None, pct, mora, pagado)
        await c.execute("UPDATE liquidaciones_mensuales SET id_estado_liquidacion = $2, updated_at = now() WHERE id_liquidacion = $1",
                        l["id_liquidacion"], pagada)
    return {"ok": True, "dias": dias, "monto_mora": float(mora)}


async def _propietario(p: dict):
    pagado = await _id("estados_pago", "id_estado_pago", "pagado")
    fecha = datetime.strptime(p["fecha_pago"], "%Y-%m-%d").date()
    await db.execute(
        """INSERT INTO pagos_propietarios (id_liquidacion, fecha_pago, monto_neto, id_estado_pago, comprobante_enviado, porcentaje_honorarios_aplicado)
           SELECT l.id_liquidacion, $2, l.alquiler - round(l.alquiler * COALESCE(ca.porcentaje_honorarios, 0) / 100, 2), $3, false,
                  COALESCE(ca.porcentaje_honorarios, 0)
           FROM liquidaciones_mensuales l JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
           WHERE l.id_liquidacion = $1""", p["id_liquidacion"], fecha, pagado)
    return {"ok": True}


async def _actualizar(_p: dict):
    # Crea el pedido (historial + comunicación sin respuesta); el contrato se actualiza recién al aprobar en Telegram.
    from routes.actualizaciones import PEDIDO_PENDIENTE, VENCIDAS
    async with db.transaccion() as c:
        filas = await c.fetch(f"{VENCIDAS} AND ca.alquiler_actual IS NOT NULL AND NOT {PEDIDO_PENDIENTE}", hoy_ar())
        for f in filas:
            indice = f["indice_de_actualizacion"] or ""
            pct = PCT_SIMULADO.get(indice.upper(), Decimal("8.00"))
            nuevo = round(f["alquiler_actual"] * (1 + pct / 100), 2)
            id_act = await c.fetchval(
                f"""INSERT INTO historial_de_actualizaciones (id_contrato, fecha_de_actualizacion, indice_de_actualizacion, porcentaje_aplicado,
                     alquiler_anterior, alquiler_nuevo) VALUES ($1, {AHORA_AR}, $2, $3, $4, $5) RETURNING id_actualizacion""",
                f["id_contrato"], indice, pct, f["alquiler_actual"], nuevo)
            m = f["moneda"]
            msg = (f"Actualización {indice} contrato {f['id_contrato']}: {pdf_simulado.plata(f['alquiler_actual'], m)} → "
                   f"{pdf_simulado.plata(nuevo, m)} (+{str(pct).replace('.', ',')}%). ¿Aprobás?")
            await c.execute(f"INSERT INTO comunicaciones (id_contrato, id_actualizacion, fecha_envio, mensaje, aprobado) VALUES ($1, $2, {AHORA_AR}, $3, NULL)",
                            f["id_contrato"], id_act, msg)
    return {"ok": True, "procesados": len(filas), "contratos": [f["id_contrato"] for f in filas]}


async def _imprimir(p: dict):
    from routes.liquidaciones import SELECT
    mes = datetime.strptime(p["mes_impresion"], "%Y-%m-%d").date()
    id_liq = p.get("id_liquidacion")
    if id_liq:
        filas = await db.fetch(f"""{SELECT} WHERE l."mes_año" = $1 AND l.id_liquidacion = $2 ORDER BY l.id_contrato""", mes, int(id_liq))
    else:
        filas = await db.fetch(f"""{SELECT} WHERE l."mes_año" = $1 AND lower(el.nombre) = 'pagada' ORDER BY l.id_contrato""", mes)
    if not filas:
        return httpx.Response(404, json={"error": f"No hay liquidaciones para imprimir en {pdf_simulado.mes_txt(mes)}."})
    pdf = await asyncio.to_thread(pdf_simulado.generar, filas)
    return httpx.Response(200, content=pdf, headers={"content-type": "application/pdf"})


HANDLERS = {"notificar_liquidaciones": _notificar, "registrar_cobro": _cobro, "pagar_propietario": _propietario,
            "actualizar_alquileres": _actualizar, "imprimir_comprobantes": _imprimir}


async def ejecutar(clave: str, payload: dict) -> httpx.Response:
    h = HANDLERS.get(clave)
    if not h:
        return httpx.Response(501, json={"error": f"El simulador todavía no implementa '{clave}'"})
    r = await h(payload)
    if isinstance(r, httpx.Response):
        return r
    return httpx.Response(200, json={**r, "simulado": True, "at": datetime.now(timezone.utc).isoformat()})

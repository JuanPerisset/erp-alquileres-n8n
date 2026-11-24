"""Configuración ÚNICA de los webhooks de n8n, con payloads tipados.

URL final = N8N_BASE_URL + "/" + path. Header: X-Webhook-Secret = N8N_WEBHOOK_SECRET.
"""
import os
from dataclasses import dataclass
from datetime import date
from typing import Literal, Optional, Type

import httpx
from pydantic import BaseModel, field_validator


class SinDatos(BaseModel):
    pass


class NotificarLiquidacionesPayload(BaseModel):
    # Opcional. Sin mes: el flujo procesa todas las confirmadas sin pago registrado.
    mes_año: Optional[date] = None

    @field_validator("mes_año")
    @classmethod
    def primer_dia(cls, v):
        if v is not None and v.day != 1:
            raise ValueError("mes_año debe ser el primer día del mes (AAAA-MM-01)")
        return v


class RegistrarCobroPayload(BaseModel):
    id_liquidacion: int
    fecha_pago: date


class PagarPropietarioPayload(BaseModel):
    id_liquidacion: int
    fecha_pago: date


class ImprimirComprobantesPayload(BaseModel):
    mes_impresion: date
    id_liquidacion: Optional[int] = None

    @field_validator("mes_impresion")
    @classmethod
    def primer_dia(cls, v: date) -> date:
        if v.day != 1:
            raise ValueError("mes_impresion debe ser el primer día del mes (AAAA-MM-01)")
        return v


@dataclass(frozen=True)
class Webhook:
    clave: str
    flujo: str
    path: str
    payload: Type[BaseModel]
    respuesta: Literal["json", "pdf"]
    descripcion: str


WEBHOOKS = {
    "actualizar_alquileres": Webhook("actualizar_alquileres", "A", "actualizar-alquileres", SinDatos, "json",
                                     "Busca contratos activos con actualización vencida y calcula el índice. Aprobación por Telegram."),
    "notificar_liquidaciones": Webhook("notificar_liquidaciones", "B", "notificar-liquidaciones", NotificarLiquidacionesPayload, "json",
                                       "Envía el detalle a los inquilinos de las liquidaciones confirmadas y crea pagos_inquilinos pendiente."),
    "registrar_cobro": Webhook("registrar_cobro", "C", "registrar-cobro", RegistrarCobroPayload, "json",
                               "Calcula la mora, marca pagos_inquilinos como pagado y la liquidación como pagada."),
    "pagar_propietario": Webhook("pagar_propietario", "D", "pagar-propietario", PagarPropietarioPayload, "json",
                                 "Inserta pagos_propietarios en estado pagado."),
    "imprimir_comprobantes": Webhook("imprimir_comprobantes", "E", "imprimir-comprobantes", ImprimirComprobantesPayload, "pdf",
                                     "Devuelve el PDF consolidado del mes (A4, 2 recibos por hoja)."),
}


def url_de(w: Webhook) -> str:
    return f"{os.environ['N8N_BASE_URL'].rstrip('/')}/{w.path}"


async def disparar(clave: str, payload: BaseModel, timeout: float = 120.0) -> httpx.Response:
    w = WEBHOOKS[clave]
    if not isinstance(payload, w.payload):
        raise TypeError(f"Payload inválido para {clave}")
    if os.environ.get("N8N_MODO") == "simulador":
        from core import n8n_simulador
        return await n8n_simulador.ejecutar(clave, payload.model_dump(mode="json"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(
            url_de(w),
            json=payload.model_dump(mode="json"),
            headers={"X-Webhook-Secret": os.environ["N8N_WEBHOOK_SECRET"]},
        )


def describir() -> list:
    modo = os.environ.get("N8N_MODO", "real")
    return [
        {"clave": w.clave, "flujo": w.flujo, "path": w.path, "url": url_de(w), "respuesta": w.respuesta, "modo": modo,
         "descripcion": w.descripcion, "campos": list(w.payload.model_json_schema().get("properties", {}).keys())}
        for w in WEBHOOKS.values()
    ]

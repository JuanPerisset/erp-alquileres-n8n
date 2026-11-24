"""Webhooks n8n disparados desde rutas: errores claros y bloqueo de doble envío."""
import httpx
from fastapi import HTTPException

from core import n8n

_en_curso: set = set()
# 424 y no 502: el ingress reemplaza los 502 por una página genérica y se pierde el mensaje.
N8N_ERROR = 424


async def llamar(clave: str, payload, candado: str):
    if candado in _en_curso:
        raise HTTPException(status_code=409, detail="Ya hay un envío en curso para esta acción. Esperá a que termine.")
    _en_curso.add(candado)
    try:
        r = await n8n.disparar(clave, payload)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=N8N_ERROR, detail=f"No se pudo conectar con n8n ({n8n.url_de(n8n.WEBHOOKS[clave])}): {e.__class__.__name__}")
    finally:
        _en_curso.discard(candado)
    if r.status_code >= 400:
        try:
            j = r.json()
            msg = (j.get("error") or j.get("message")) if isinstance(j, dict) else None
        except ValueError:
            msg = None
        raise HTTPException(status_code=N8N_ERROR, detail=f"n8n respondió con error {r.status_code}: {msg or r.text[:300]}")
    return r

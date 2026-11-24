"""Validaciones básicas en el borde del sistema (lo que llega del formulario)."""
import re

from fastapi import HTTPException

from core import db

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _digitos(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def error_campos(errores: dict):
    if errores:
        raise HTTPException(status_code=422, detail={"msg": "Revisá los campos marcados", "campos": errores})


def normalizar_persona(d: dict, celular_actual=None) -> dict:
    e = {}
    for k in ("nombre", "apellido"):
        if not d.get(k):
            e[k] = "Obligatorio"
    if d.get("dni"):
        dni = _digitos(d["dni"])
        if len(dni) not in (7, 8):
            e["dni"] = "El DNI debe tener 7 u 8 dígitos"
        d["dni"] = dni
    if d.get("cuit"):
        c = _digitos(d["cuit"])
        if len(c) != 11:
            e["cuit"] = "El CUIT/CUIL debe tener 11 dígitos"
        else:
            d["cuit"] = f"{c[:2]}-{c[2:10]}-{c[10]}"
    # El celular solo se normaliza si cambió: los ya cargados no se transforman.
    if d.get("celular") and d["celular"] != celular_actual:
        cel = re.sub(r"[\s\-().+]", "", d["celular"])
        if not re.fullmatch(r"\d{10,15}", cel):
            e["celular"] = "Celular inválido: solo dígitos con código de país y de área (ej. 5493415551234)"
        d["celular"] = cel
    if d.get("email"):
        d["email"] = d["email"].lower()
        if not EMAIL_RE.match(d["email"]):
            e["email"] = "Email inválido"
    if d.get("numero") is not None and d["numero"] < 0:
        e["numero"] = "Número inválido"
    error_campos(e)
    return d


async def validar_ubicacion(d: dict):
    if d.get("id_ciudad") is None:
        return
    prov = await db.fetchval("SELECT id_provincia FROM ciudades WHERE id_ciudad = $1", d["id_ciudad"])
    if prov is None or (d.get("id_provincia") is not None and prov != d["id_provincia"]):
        error_campos({"id_ciudad": "La ciudad no corresponde a la provincia elegida"})
    d["id_provincia"] = prov

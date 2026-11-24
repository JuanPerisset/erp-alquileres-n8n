from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from core import db
from core.auth import get_current_user
from core.modelos import CatalogoIn
from core.validaciones import error_campos

router = APIRouter(prefix="/catalogos", tags=["catalogos"], dependencies=[Depends(get_current_user)])

# Editables desde el front. Los estados_* y reglas_mora son de solo lectura (los usa la lógica del sistema).
EDITABLES = {
    "barrios": ("barrios", "id_barrio"),
    "tipos_propiedad": ("tipos_propiedad", "id_tipo"),
    "provincias": ("provincias", "id_provincia"),
    "ciudades": ("ciudades", "id_ciudad"),
}


@router.get("")
async def catalogos():
    return {
        "estados_pago": await db.fetch("SELECT id_estado_pago AS id, nombre FROM estados_pago ORDER BY 1"),
        "estados_liquidacion": await db.fetch("SELECT id_estado_liquidacion AS id, nombre FROM estados_liquidacion ORDER BY 1"),
        "estados_servicios": await db.fetch("SELECT id_estado_servicio AS id, nombre FROM estados_servicios ORDER BY 1"),
        "estados_contrato": await db.fetch("SELECT id_estado_contrato AS id, nombre FROM estados_contrato ORDER BY 1"),
        "estados_propiedad": await db.fetch("SELECT id_estado_propiedad AS id, nombre FROM estados_propiedad ORDER BY 1"),
        "tipos_propiedad": await db.fetch("SELECT id_tipo AS id, nombre FROM tipos_propiedad ORDER BY nombre"),
        "barrios": await db.fetch("SELECT id_barrio AS id, nombre FROM barrios ORDER BY nombre"),
        "provincias": await db.fetch("SELECT id_provincia AS id, nombre FROM provincias ORDER BY nombre"),
        "reglas_mora": await db.fetch(
            "SELECT id_regla, rango, dias_desde, dias_hasta, porcentaje_mora, descripcion, activo FROM reglas_mora ORDER BY dias_desde"),
    }


@router.get("/ciudades")
async def ciudades(id_provincia: Optional[int] = None):
    return await db.fetch(
        """SELECT c.id_ciudad AS id, c.nombre, c.id_provincia, p.nombre AS provincia
           FROM ciudades c JOIN provincias p ON p.id_provincia = c.id_provincia
           WHERE $1::int IS NULL OR c.id_provincia = $1 ORDER BY c.nombre""", id_provincia)


def _cfg(catalogo: str):
    if catalogo not in EDITABLES:
        raise HTTPException(status_code=404, detail="Catálogo no editable")
    return EDITABLES[catalogo]


def _valores(catalogo: str, body: CatalogoIn) -> dict:
    if not body.nombre:
        error_campos({"nombre": "Obligatorio"})
    d = {"nombre": body.nombre}
    if catalogo == "ciudades":
        if not body.id_provincia:
            error_campos({"id_provincia": "Elegí la provincia"})
        d["id_provincia"] = body.id_provincia
    return d


async def _ejecutar(sql, *args):
    try:
        return await db.fetchval(sql, *args)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail="Ya existe un registro con ese nombre")
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(status_code=409, detail="Está en uso por otros registros; no se puede eliminar")


@router.post("/{catalogo}")
async def crear(catalogo: str, body: CatalogoIn):
    tabla, pk = _cfg(catalogo)
    d = _valores(catalogo, body)
    cols = list(d)
    nuevo = await _ejecutar(
        f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES ({', '.join(f'${i + 1}' for i in range(len(cols)))}) RETURNING {pk}",
        *d.values())
    return {"id": nuevo, **d}


@router.put("/{catalogo}/{id_}")
async def editar(catalogo: str, id_: int, body: CatalogoIn):
    tabla, pk = _cfg(catalogo)
    d = _valores(catalogo, body)
    sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(d))
    if await _ejecutar(f"UPDATE {tabla} SET {sets} WHERE {pk} = $1 RETURNING {pk}", id_, *d.values()) is None:
        raise HTTPException(status_code=404, detail="Registro inexistente")
    return {"id": id_, **d}


@router.delete("/{catalogo}/{id_}")
async def eliminar(catalogo: str, id_: int):
    tabla, pk = _cfg(catalogo)
    if await _ejecutar(f"DELETE FROM {tabla} WHERE {pk} = $1 RETURNING {pk}", id_) is None:
        raise HTTPException(status_code=404, detail="Registro inexistente")
    return {"ok": True}

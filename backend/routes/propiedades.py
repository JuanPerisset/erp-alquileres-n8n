"""ABM de propiedades (datos_propiedades) + propietarios (propiedades_propietarios)."""
from fastapi import APIRouter, Depends, HTTPException

from core import db
from core.auth import get_current_user
from core.modelos import AMBIENTES, MEDIDAS, PropiedadIn
from core.validaciones import error_campos, validar_ubicacion

router = APIRouter(prefix="/propiedades", tags=["propiedades"], dependencies=[Depends(get_current_user)])

CAMPOS = ["calle", "numero", "id_provincia", "id_ciudad", "id_tipo", "id_estado_propiedad", "id_barrio",
          "codigo_luz", "codigo_gas", "codigo_agua", "codigo_municipal"] + MEDIDAS + AMBIENTES

SELECT = """
SELECT p.*, p.id_propiedad AS id, c.nombre AS ciudad, pv.nombre AS provincia, t.nombre AS tipo,
       e.nombre AS estado, b.nombre AS barrio,
       COALESCE((SELECT json_agg(json_build_object('id', o.id_propietario, 'nombre', o.nombre, 'apellido', o.apellido,
                                                   'celular', o.celular, 'email', o.email)
                                 ORDER BY o.apellido, o.nombre)
                 FROM propiedades_propietarios pp JOIN datos_propietarios o ON o.id_propietario = pp.id_propietario
                 WHERE pp.id_propiedad = p.id_propiedad), '[]'::json) AS propietarios,
       (SELECT count(*) FROM contratos_de_alquileres ca WHERE ca.id_propiedad = p.id_propiedad) AS contratos
FROM datos_propiedades p
LEFT JOIN ciudades c ON c.id_ciudad = p.id_ciudad
LEFT JOIN provincias pv ON pv.id_provincia = p.id_provincia
LEFT JOIN tipos_propiedad t ON t.id_tipo = p.id_tipo
LEFT JOIN estados_propiedad e ON e.id_estado_propiedad = p.id_estado_propiedad
LEFT JOIN barrios b ON b.id_barrio = p.id_barrio
"""

CONTRATOS = """
SELECT ca.id_contrato, ca.desde, ca.hasta, ca.alquiler_actual, ca.moneda, ec.nombre AS estado,
       COALESCE((SELECT json_agg(json_build_object('id', i.id_inquilino, 'nombre', i.nombre, 'apellido', i.apellido)
                                 ORDER BY i.apellido, i.nombre)
                 FROM contratos_inquilinos ci JOIN datos_inquilinos i ON i.id_inquilino = ci.id_inquilino
                 WHERE ci.id_contrato = ca.id_contrato), '[]'::json) AS inquilinos
FROM contratos_de_alquileres ca
LEFT JOIN estados_contrato ec ON ec.id_estado_contrato = ca.id_estado_contrato
WHERE ca.id_propiedad = $1 ORDER BY ca.desde DESC
"""


async def _obtener(id_: int):
    row = await db.fetchrow(f"{SELECT} WHERE p.id_propiedad = $1", id_)
    if not row:
        raise HTTPException(status_code=404, detail="No existe la propiedad")
    return row


async def _preparar(body: PropiedadIn) -> dict:
    d = {k: getattr(body, k) for k in CAMPOS}
    if not d["calle"]:
        error_campos({"calle": "Obligatorio"})
    if d["numero"] is not None and d["numero"] < 0:
        error_campos({"numero": "Número inválido"})
    await validar_ubicacion(d)
    ids = sorted(set(body.propietarios))
    if ids and await db.fetchval("SELECT count(*) FROM datos_propietarios WHERE id_propietario = ANY($1::int[])", ids) != len(ids):
        error_campos({"propietarios": "Hay propietarios inexistentes"})
    return d


async def _guardar_propietarios(conn, id_: int, ids):
    await conn.execute("DELETE FROM propiedades_propietarios WHERE id_propiedad = $1", id_)
    await conn.executemany("INSERT INTO propiedades_propietarios (id_propiedad, id_propietario) VALUES ($1, $2)",
                           [(id_, i) for i in sorted(set(ids))])


def _col(k):
    return f'"{k}"'


@router.get("")
async def listar():
    return await db.fetch(f"{SELECT} ORDER BY p.calle, p.numero")


@router.get("/{id_}")
async def detalle(id_: int):
    row = await _obtener(id_)
    row["lista_contratos"] = await db.fetch(CONTRATOS, id_)
    return row


@router.post("")
async def crear(body: PropiedadIn):
    d = await _preparar(body)
    cols = list(d.keys())
    async with db.transaccion() as conn:
        nuevo = await conn.fetchval(
            f"INSERT INTO datos_propiedades ({', '.join(map(_col, cols))}) "
            f"VALUES ({', '.join(f'${i + 1}' for i in range(len(cols)))}) RETURNING id_propiedad", *d.values())
        await _guardar_propietarios(conn, nuevo, body.propietarios)
    return await _obtener(nuevo)


@router.put("/{id_}")
async def editar(id_: int, body: PropiedadIn):
    await _obtener(id_)
    d = await _preparar(body)
    sets = ", ".join(f"{_col(k)} = ${i + 2}" for i, k in enumerate(d.keys()))
    async with db.transaccion() as conn:
        await conn.execute(f"UPDATE datos_propiedades SET {sets}, updated_at = now() WHERE id_propiedad = $1", id_, *d.values())
        await _guardar_propietarios(conn, id_, body.propietarios)
    return await _obtener(id_)


@router.post("/{id_}/inactivar")
async def inactivar(id_: int):
    await _obtener(id_)
    id_inactiva = await db.fetchval("SELECT id_estado_propiedad FROM estados_propiedad WHERE lower(nombre) = 'inactiva'")
    if id_inactiva is None:
        raise HTTPException(status_code=500, detail="No existe el estado 'inactiva' en estados_propiedad")
    await db.execute("UPDATE datos_propiedades SET id_estado_propiedad = $2, updated_at = now() WHERE id_propiedad = $1", id_, id_inactiva)
    return await _obtener(id_)


@router.delete("/{id_}")
async def eliminar(id_: int):
    row = await _obtener(id_)
    if row["contratos"] > 0:
        raise HTTPException(status_code=409,
                            detail="No se puede eliminar: tiene contratos. Si ya no se usa, cambiá su estado a inactiva.")
    async with db.transaccion() as conn:
        await conn.execute("DELETE FROM propiedades_propietarios WHERE id_propiedad = $1", id_)
        await conn.execute("DELETE FROM datos_propiedades WHERE id_propiedad = $1", id_)
    return {"ok": True}

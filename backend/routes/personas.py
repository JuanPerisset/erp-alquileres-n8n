"""ABM de inquilinos (datos_inquilinos) y propietarios (datos_propietarios)."""
from fastapi import APIRouter, Depends, HTTPException

from core import db
from core.auth import get_current_user
from core.modelos import PersonaIn
from core.validaciones import error_campos, normalizar_persona, validar_ubicacion

CAMPOS = ["nombre", "apellido", "fecha_nacimiento", "nacionalidad", "profesion", "sexo", "estado_civil",
          "pais_residencia", "codigo_postal", "calle", "numero", "cuit", "dni", "celular", "email",
          "id_provincia", "id_ciudad"]

TIPOS = {
    "inquilinos": {
        "tabla": "datos_inquilinos", "pk": "id_inquilino", "extra": ["estado"], "singular": "inquilino",
        "conteo": "(SELECT count(*) FROM contratos_inquilinos r WHERE r.id_inquilino = p.id_inquilino) AS contratos",
        "relacion": "contratos",
        "bloqueo": "Tiene contratos asociados; no se puede eliminar. Pasalo a inactivo.",
        "detalle": """SELECT ca.id_contrato, ca.desde, ca.hasta, ec.nombre AS estado, pr.calle, pr.numero
                      FROM contratos_inquilinos ci
                      JOIN contratos_de_alquileres ca ON ca.id_contrato = ci.id_contrato
                      LEFT JOIN estados_contrato ec ON ec.id_estado_contrato = ca.id_estado_contrato
                      LEFT JOIN datos_propiedades pr ON pr.id_propiedad = ca.id_propiedad
                      WHERE ci.id_inquilino = $1 ORDER BY ca.desde DESC""",
    },
    "propietarios": {
        "tabla": "datos_propietarios", "pk": "id_propietario", "extra": [], "singular": "propietario",
        "conteo": "(SELECT count(*) FROM propiedades_propietarios r WHERE r.id_propietario = p.id_propietario) AS propiedades",
        "relacion": "propiedades",
        "bloqueo": "Tiene propiedades asociadas; desvinculalo primero.",
        "detalle": """SELECT pr.id_propiedad, pr.calle, pr.numero, ep.nombre AS estado, c.nombre AS ciudad
                      FROM propiedades_propietarios pp
                      JOIN datos_propiedades pr ON pr.id_propiedad = pp.id_propiedad
                      LEFT JOIN estados_propiedad ep ON ep.id_estado_propiedad = pr.id_estado_propiedad
                      LEFT JOIN ciudades c ON c.id_ciudad = pr.id_ciudad
                      WHERE pp.id_propietario = $1 ORDER BY pr.calle, pr.numero""",
    },
}


def crear_router(tipo: str) -> APIRouter:
    cfg = TIPOS[tipo]
    tabla, pk, campos = cfg["tabla"], cfg["pk"], CAMPOS + cfg["extra"]
    router = APIRouter(prefix=f"/{tipo}", tags=[tipo], dependencies=[Depends(get_current_user)])
    select = f"""SELECT p.*, p.{pk} AS id, c.nombre AS ciudad, pv.nombre AS provincia, {cfg['conteo']}
                 FROM {tabla} p
                 LEFT JOIN ciudades c ON c.id_ciudad = p.id_ciudad
                 LEFT JOIN provincias pv ON pv.id_provincia = p.id_provincia"""

    async def preparar(body: PersonaIn, id_excluir: int = 0) -> dict:
        actual = await db.fetchval(f"SELECT celular FROM {tabla} WHERE {pk} = $1", id_excluir) if id_excluir else None
        d = normalizar_persona({k: getattr(body, k) for k in campos}, actual)
        await validar_ubicacion(d)
        if d.get("dni") and await db.fetchval(f"SELECT 1 FROM {tabla} WHERE dni = $1 AND {pk} <> $2", d["dni"], id_excluir):
            error_campos({"dni": f"Ya existe un {cfg['singular']} con ese DNI"})
        if tipo == "inquilinos" and not d.get("estado"):
            d["estado"] = "activo"
        return d

    async def obtener(id_: int):
        row = await db.fetchrow(f"{select} WHERE p.{pk} = $1", id_)
        if not row:
            raise HTTPException(status_code=404, detail=f"No existe el {cfg['singular']}")
        return row

    @router.get("")
    async def listar():
        return await db.fetch(f"{select} ORDER BY p.apellido, p.nombre")

    @router.get("/{id_}")
    async def detalle(id_: int):
        row = await obtener(id_)
        row["vinculos"] = await db.fetch(cfg["detalle"], id_)
        return row

    @router.post("")
    async def crear(body: PersonaIn):
        d = await preparar(body)
        cols = list(d.keys())
        nuevo = await db.fetchval(
            f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES ({', '.join(f'${i + 1}' for i in range(len(cols)))}) RETURNING {pk}",
            *d.values())
        return await obtener(nuevo)

    @router.put("/{id_}")
    async def editar(id_: int, body: PersonaIn):
        await obtener(id_)
        d = await preparar(body, id_)
        sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(d.keys()))
        await db.execute(f"UPDATE {tabla} SET {sets}, updated_at = now() WHERE {pk} = $1", id_, *d.values())
        return await obtener(id_)

    @router.delete("/{id_}")
    async def eliminar(id_: int):
        row = await obtener(id_)
        if row[cfg["relacion"]] > 0:
            raise HTTPException(status_code=409, detail=cfg["bloqueo"])
        await db.execute(f"DELETE FROM {tabla} WHERE {pk} = $1", id_)
        return {"ok": True}

    if tipo == "inquilinos":
        @router.post("/{id_}/inactivar")
        async def inactivar(id_: int):
            await obtener(id_)
            await db.execute(f"UPDATE {tabla} SET estado = 'inactivo', updated_at = now() WHERE {pk} = $1", id_)
            return await obtener(id_)

    return router


inquilinos_router = crear_router("inquilinos")
propietarios_router = crear_router("propietarios")

import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from core import db
from core.auth import hash_password, require_admin

router = APIRouter(prefix="/usuarios", tags=["usuarios"])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CAMPOS = "id, email, nombre, rol, activo, created_at, updated_at"


class UsuarioIn(BaseModel):
    email: str
    nombre: str
    password: str
    rol: Literal["administrador", "operadora"]

    @field_validator("email")
    @classmethod
    def email_ok(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Email inválido")
        return v

    @field_validator("password")
    @classmethod
    def pass_ok(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UsuarioPatch(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[Literal["administrador", "operadora"]] = None
    activo: Optional[bool] = None
    password: Optional[str] = None


@router.get("")
async def listar(_: dict = Depends(require_admin)):
    return await db.fetch(f"SELECT {CAMPOS} FROM app_usuarios ORDER BY nombre")


@router.post("")
async def crear(body: UsuarioIn, _: dict = Depends(require_admin)):
    if await db.fetchval("SELECT 1 FROM app_usuarios WHERE email = $1", body.email):
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")
    return await db.fetchrow(
        f"INSERT INTO app_usuarios (email, nombre, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING {CAMPOS}",
        body.email, body.nombre.strip(), hash_password(body.password), body.rol)


@router.patch("/{user_id}")
async def editar(user_id: int, body: UsuarioPatch, admin: dict = Depends(require_admin)):
    actual = await db.fetchrow("SELECT id FROM app_usuarios WHERE id = $1", user_id)
    if not actual:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user_id == admin["id"] and (body.activo is False or body.rol == "operadora"):
        raise HTTPException(status_code=400, detail="No podés desactivarte ni quitarte el rol de administrador")
    if body.password is not None and len(body.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    return await db.fetchrow(
        f"""UPDATE app_usuarios SET
              nombre = COALESCE($2, nombre), rol = COALESCE($3, rol), activo = COALESCE($4, activo),
              password_hash = COALESCE($5, password_hash), updated_at = now()
            WHERE id = $1 RETURNING {CAMPOS}""",
        user_id, body.nombre.strip() if body.nombre else None, body.rol, body.activo,
        hash_password(body.password) if body.password else None)

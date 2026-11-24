from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core import db
from core.auth import (cookie_flags, create_access_token, create_refresh_token, decode_token, get_current_user,
                       get_user_by_id, set_access_cookie, set_refresh_cookie, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])
MAX_INTENTOS = 5
BLOQUEO_MIN = 15


class LoginIn(BaseModel):
    email: str
    password: str


def _publico(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "nombre": u["nombre"], "rol": u["rol"]}


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    ident = f"{_ip(request)}:{email}"
    intento = await db.fetchrow("SELECT intentos, bloqueado_hasta FROM app_login_intentos WHERE identificador = $1", ident)
    now = datetime.now(timezone.utc)
    if intento and intento["bloqueado_hasta"] and intento["bloqueado_hasta"] > now:
        raise HTTPException(status_code=429, detail="Demasiados intentos fallidos. Probá de nuevo en 15 minutos.")

    user = await db.fetchrow("SELECT id, email, nombre, rol, activo, password_hash FROM app_usuarios WHERE email = $1", email)
    if not user or not user["activo"] or not verify_password(body.password, user["password_hash"]):
        intentos = (intento["intentos"] if intento else 0) + 1
        bloqueo = now + timedelta(minutes=BLOQUEO_MIN) if intentos >= MAX_INTENTOS else None
        await db.execute(
            """INSERT INTO app_login_intentos (identificador, intentos, bloqueado_hasta) VALUES ($1, $2, $3)
               ON CONFLICT (identificador) DO UPDATE SET intentos = $2, bloqueado_hasta = $3""",
            ident, 0 if bloqueo else intentos, bloqueo)
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    await db.execute("DELETE FROM app_login_intentos WHERE identificador = $1", ident)
    access = create_access_token(user["id"], user["email"], user["rol"])
    set_access_cookie(response, access)
    set_refresh_cookie(response, create_refresh_token(user["id"]))
    return {**_publico(user), "token": access}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token, "refresh")
    user = await get_user_by_id(int(payload["sub"]))
    if not user or not user["activo"]:
        raise HTTPException(status_code=401, detail="Usuario inexistente o inactivo")
    set_access_cookie(response, create_access_token(user["id"], user["email"], user["rol"]))
    return _publico(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", **cookie_flags())
    response.delete_cookie("refresh_token", path="/", **cookie_flags())
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _publico(user)

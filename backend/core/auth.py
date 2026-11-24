import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

from core import db

JWT_ALGORITHM = "HS256"
ROLES = ("administrador", "operadora")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: int, email: str, rol: str) -> str:
    payload = {"sub": str(user_id), "email": email, "rol": rol, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    return payload


def cookie_flags() -> dict:
    """Producción (HTTPS): Secure + SameSite=None (valor por defecto). Para probar por http://localhost: COOKIE_SECURE=false."""
    secure = os.environ.get("COOKIE_SECURE", "true").strip().lower() != "false"
    return {"secure": secure, "samesite": "none" if secure else "lax"}


def set_access_cookie(response, token):
    response.set_cookie("access_token", token, httponly=True, max_age=900, path="/", **cookie_flags())


def set_refresh_cookie(response, token):
    response.set_cookie("refresh_token", token, httponly=True, max_age=604800, path="/", **cookie_flags())


async def get_user_by_id(user_id: int):
    return await db.fetchrow(
        "SELECT id, email, nombre, rol, activo, created_at FROM app_usuarios WHERE id = $1", user_id)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token, "access")
    user = await get_user_by_id(int(payload["sub"]))
    if not user or not user["activo"]:
        raise HTTPException(status_code=401, detail="Usuario inexistente o inactivo")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"] != "administrador":
        raise HTTPException(status_code=403, detail="Solo un administrador puede realizar esta acción")
    return user

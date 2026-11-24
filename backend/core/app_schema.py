"""Tablas propias del front (prefijo app_). No toca ninguna tabla existente."""
import os
from core import db
from core.auth import hash_password, verify_password

APP_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS public.app_usuarios (
    id serial4 PRIMARY KEY,
    email varchar(150) NOT NULL UNIQUE,
    nombre varchar(150) NOT NULL,
    password_hash varchar(200) NOT NULL,
    rol varchar(20) NOT NULL CHECK (rol IN ('administrador', 'operadora')),
    activo bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.app_login_intentos (
    identificador varchar(250) PRIMARY KEY,
    intentos int4 NOT NULL DEFAULT 0,
    bloqueado_hasta timestamptz NULL
);
"""


async def ensure_app_tables():
    await db.execute(APP_TABLES_SQL)


async def _seed_user(email, password, nombre, rol):
    email = email.lower()
    row = await db.fetchrow("SELECT id, password_hash FROM app_usuarios WHERE email = $1", email)
    if row is None:
        await db.execute(
            "INSERT INTO app_usuarios (email, nombre, password_hash, rol) VALUES ($1, $2, $3, $4)",
            email, nombre, hash_password(password), rol,
        )
    elif not verify_password(password, row["password_hash"]):
        await db.execute(
            "UPDATE app_usuarios SET password_hash = $1, updated_at = now() WHERE id = $2",
            hash_password(password), row["id"],
        )


async def seed_users():
    await _seed_user(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Juan Francisco Perisset", "administrador")
    await _seed_user(os.environ["OPERADORA_EMAIL"], os.environ["OPERADORA_PASSWORD"], "Operadora", "operadora")

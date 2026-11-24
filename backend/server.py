from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import db
from core.app_schema import ensure_app_tables, seed_users
from routes import (actualizaciones, auth, backups, catalogos, comunicaciones, contratos, dashboard, impresion, liquidaciones,
                    pagos_propietarios, personas, propiedades, sistema, usuarios)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@asynccontextmanager
async def lifespan(_app):
    await db.init_pool()
    await ensure_app_tables()
    await seed_users()
    yield
    await db.close_pool()


app = FastAPI(title="Perisset Inmobiliaria — ERP", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"ok": True, "app": "Perisset ERP"}


for r in (auth.router, usuarios.router, catalogos.router, sistema.router, dashboard.router, backups.router,
          personas.inquilinos_router, personas.propietarios_router, propiedades.router, contratos.router, liquidaciones.router, pagos_propietarios.router,
          actualizaciones.router, impresion.router, comunicaciones.router):
    api.include_router(r)

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

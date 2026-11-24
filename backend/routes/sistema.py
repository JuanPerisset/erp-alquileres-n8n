from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException

from core import db, n8n
from core.auth import get_current_user
from core.webhooks import N8N_ERROR

router = APIRouter(prefix="/sistema", tags=["sistema"], dependencies=[Depends(get_current_user)])

# Nombres EXACTOS de las tablas del script SQL provisto (fuente de verdad).
TABLAS_DDL = [
    "barrios", "ciudades", "comunicaciones", "comunicaciones_externas", "conceptos_liquidacion",
    "contratos_de_alquileres", "contratos_inquilinos", "datos_inquilinos", "datos_propiedades",
    "datos_propietarios", "estados_contrato", "estados_liquidacion", "estados_pago", "estados_propiedad",
    "estados_servicios", "historial_de_actualizaciones", "liquidaciones_mensuales", "pagos_inquilinos",
    "pagos_propietarios", "propiedades_propietarios", "provincias", "reglas_mora", "servicios_mensuales",
    "tipos_propiedad",
]
COLUMNAS_ESPECIALES = [("liquidaciones_mensuales", "mes_año"), ("datos_propiedades", "baño"), ("datos_propiedades", "local")]


@router.get("/tablas")
async def tablas():
    rows = await db.fetch(
        """SELECT t.table_name, count(c.column_name) AS columnas
           FROM information_schema.tables t
           JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
           WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
           GROUP BY t.table_name ORDER BY t.table_name""")
    existentes = {r["table_name"]: r["columnas"] for r in rows}
    detalle = []
    for nombre in sorted(existentes):
        filas = await db.fetchval(f'SELECT count(*) FROM public."{nombre}"')
        detalle.append({"tabla": nombre, "columnas": existentes[nombre], "filas": filas,
                        "origen": "ddl" if nombre in TABLAS_DDL else ("app" if nombre.startswith("app_") else "otra")})
    especiales = []
    for tabla, col in COLUMNAS_ESPECIALES:
        ok = await db.fetchval(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2", tabla, col)
        especiales.append({"tabla": tabla, "columna": col, "existe": bool(ok)})
    return {
        "esperadas": len(TABLAS_DDL),
        "faltantes": [t for t in TABLAS_DDL if t not in existentes],
        "tablas": detalle,
        "columnas_especiales": especiales,
        "base": await db.fetchval("SELECT current_database()"),
    }


@router.get("/webhooks")
async def webhooks():
    return n8n.describir()


@router.get("/operacion")
async def operacion():
    """Estado de la conexión real: base de datos, modo n8n, DDL completo."""
    import os
    u = urlparse(os.environ["DATABASE_URL"])
    tablas_rows = await db.fetch(
        """SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'""")
    existentes = {r["table_name"] for r in tablas_rows}
    faltantes = [t for t in TABLAS_DDL if t not in existentes]
    modo = os.environ.get("N8N_MODO", "real")
    return {
        "base": {
            "modo": "real",  # único driver (asyncpg contra DATABASE_URL)
            "nombre": await db.fetchval("SELECT current_database()"),
            "servidor": await db.fetchval("SELECT inet_server_addr()::text") or "local",
            "host_configurado": u.hostname or "—",
            "puerto": u.port or 5432,
            "usuario": u.username or "—",
            "ssl": "require" in (u.query or ""),
            "ddl_completo": len(faltantes) == 0,
            "faltantes": faltantes,
        },
        "n8n": {
            "modo": modo,
            "base_url": os.environ["N8N_BASE_URL"],
            "secreto_configurado": bool(os.environ.get("N8N_WEBHOOK_SECRET")),
            "listo_para_produccion": modo == "real"
                and os.environ.get("N8N_WEBHOOK_SECRET") not in (None, "", "cambiar-por-el-secreto-real")
                and not os.environ["N8N_BASE_URL"].startswith("https://n8n.example.com"),
            "webhooks": n8n.describir(),
        },
    }


@router.post("/n8n/ping")
async def n8n_ping():
    """Prueba de conectividad: en modo simulador siempre OK; en real intenta HEAD/GET al base_url."""
    import os
    modo = os.environ.get("N8N_MODO", "real")
    if modo == "simulador":
        return {"ok": True, "modo": modo, "detalle": "Simulador local activo."}
    url = os.environ["N8N_BASE_URL"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(url)
        return {"ok": r.status_code < 500, "modo": modo, "codigo": r.status_code, "url": url}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=N8N_ERROR, detail=f"No se pudo conectar con n8n ({url}): {e.__class__.__name__}")

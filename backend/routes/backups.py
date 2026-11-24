"""Backups diarios de la base de prueba. Dispara el script y los lista."""
import asyncio
import hmac
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, status

from core.auth import get_current_user

router = APIRouter(prefix="/sistema/backups", tags=["backups"])

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", str(ROOT_DIR / "backups")))
SCRIPT = ROOT_DIR / "scripts" / "backup_test_db.sh"


def _listar() -> list:
    if not BACKUP_DIR.exists():
        return []
    archivos = sorted(BACKUP_DIR.glob("perisset-*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [{"archivo": p.name, "ruta": str(p), "tamanio_bytes": p.stat().st_size,
             "fecha": p.stat().st_mtime} for p in archivos]


async def _correr_backup() -> dict:
    proc = await asyncio.create_subprocess_exec(
        "bash", str(SCRIPT),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Backup falló: {err.decode()[:500]}")
    return {"ok": True, "mensaje": out.decode().strip()}


@router.get("", dependencies=[Depends(get_current_user)])
async def listar():
    return {"backups": _listar(), "directorio": str(BACKUP_DIR)}


@router.post("", dependencies=[Depends(get_current_user)])
async def crear_manual():
    """Backup disparado desde la UI (admin/operadora)."""
    r = await _correr_backup()
    return {**r, "backups": _listar()}


@router.post("/cron")
async def cron_backup(authorization: str = Header(default="")):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    esperado = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not authorization.startswith("Bearer ") or not esperado \
            or not hmac.compare_digest(authorization.removeprefix("Bearer "), esperado):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autorización inválida")
    asyncio.create_task(_correr_backup())
    return {"ok": True, "mensaje": "Backup encolado"}

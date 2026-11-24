"""Centro de impresión: resumen del mes y PDF consolidado vía webhook E."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from core import db, n8n
from core.auth import get_current_user
from core.webhooks import N8N_ERROR, llamar

router = APIRouter(prefix="/impresion", tags=["impresion"], dependencies=[Depends(get_current_user)])


@router.get("/resumen")
async def resumen(mes: date):
    return await db.fetch(
        """SELECT COALESCE(el.nombre, 'sin estado') AS estado, l.moneda, count(*) AS cantidad
           FROM liquidaciones_mensuales l LEFT JOIN estados_liquidacion el ON el.id_estado_liquidacion = l.id_estado_liquidacion
           WHERE l."mes_año" = $1 GROUP BY 1, 2 ORDER BY 1, 2""", mes)


@router.post("/pdf")
async def pdf(body: n8n.ImprimirComprobantesPayload):
    candado = f"pdf-{body.mes_impresion}-{body.id_liquidacion or 'mes'}"
    r = await llamar("imprimir_comprobantes", body, candado)
    if not r.content.startswith(b"%PDF"):
        raise HTTPException(status_code=N8N_ERROR, detail="n8n respondió pero no devolvió un PDF.")
    sufijo = f"-liq-{body.id_liquidacion}" if body.id_liquidacion else ""
    nombre = f"comprobantes-{body.mes_impresion:%Y-%m}{sufijo}.pdf"
    return Response(r.content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{nombre}"'})

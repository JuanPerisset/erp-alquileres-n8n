"""Comunicaciones con inquilinos (comunicaciones_externas): solo lectura."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends

from core import db
from core.auth import get_current_user

router = APIRouter(prefix="/comunicaciones", tags=["comunicaciones"], dependencies=[Depends(get_current_user)])

SQL = r"""
SELECT ce.id_comunicacion AS id, ce.id_comunicacion, ce.id_liquidacion, ce.tipo_destinatario, ce.celular_destino, ce.tipo_mensaje,
       ce.estado_envio, ce.fecha_envio, ce.detalles_error, l.id_contrato, l."mes_año", p.calle, p.numero,
       (SELECT json_build_object('nombre', i.nombre, 'apellido', i.apellido)
        FROM contratos_inquilinos x JOIN datos_inquilinos i ON i.id_inquilino = x.id_inquilino
        WHERE x.id_contrato = l.id_contrato
          AND regexp_replace(COALESCE(i.celular, ''), '\D', '', 'g') = regexp_replace(ce.celular_destino, '\D', '', 'g')
        LIMIT 1) AS destinatario
FROM comunicaciones_externas ce
LEFT JOIN liquidaciones_mensuales l ON l.id_liquidacion = ce.id_liquidacion
LEFT JOIN contratos_de_alquileres ca ON ca.id_contrato = l.id_contrato
LEFT JOIN datos_propiedades p ON p.id_propiedad = ca.id_propiedad
WHERE $1::date IS NULL OR date_trunc('month', ce.fecha_envio)::date = $1
ORDER BY ce.fecha_envio DESC NULLS LAST, ce.id_comunicacion DESC"""


@router.get("")
async def listar(mes: Optional[date] = None):
    return await db.fetch(SQL, mes)

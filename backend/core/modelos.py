from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class Entrada(BaseModel):
    """Base de formularios: strings vacíos → None y recorte de espacios."""

    @model_validator(mode="before")
    @classmethod
    def vacios(cls, data):
        if isinstance(data, dict):
            return {k: (v.strip() or None) if isinstance(v, str) else v for k, v in data.items()}
        return data


class PersonaIn(Entrada):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    nacionalidad: Optional[str] = None
    profesion: Optional[str] = None
    sexo: Optional[str] = None
    estado_civil: Optional[str] = None
    pais_residencia: Optional[str] = None
    codigo_postal: Optional[str] = None
    calle: Optional[str] = None
    numero: Optional[int] = None
    cuit: Optional[str] = None
    dni: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    id_provincia: Optional[int] = None
    id_ciudad: Optional[int] = None
    estado: Optional[str] = None


AMBIENTES = ["dormitorio", "cocina", "garage", "baño", "patio", "lavadero", "living", "oficina", "local",
             "comedor", "galpon", "alerje", "consultorio"]
MEDIDAS = ["superficie_total", "superficie_cubierta", "superficie_libre", "frente", "fondo"]


class PropiedadIn(Entrada):
    calle: Optional[str] = None
    numero: Optional[int] = None
    id_provincia: Optional[int] = None
    id_ciudad: Optional[int] = None
    id_tipo: Optional[int] = None
    id_estado_propiedad: Optional[int] = None
    id_barrio: Optional[int] = None
    superficie_total: Optional[float] = Field(None, ge=0)
    superficie_cubierta: Optional[float] = Field(None, ge=0)
    superficie_libre: Optional[float] = Field(None, ge=0)
    frente: Optional[float] = Field(None, ge=0)
    fondo: Optional[float] = Field(None, ge=0)
    dormitorio: Optional[int] = Field(None, ge=0)
    cocina: Optional[int] = Field(None, ge=0)
    garage: Optional[int] = Field(None, ge=0)
    baño: Optional[int] = Field(None, ge=0)
    patio: Optional[int] = Field(None, ge=0)
    lavadero: Optional[int] = Field(None, ge=0)
    living: Optional[int] = Field(None, ge=0)
    oficina: Optional[int] = Field(None, ge=0)
    local: Optional[int] = Field(None, ge=0)
    comedor: Optional[int] = Field(None, ge=0)
    galpon: Optional[int] = Field(None, ge=0)
    alerje: Optional[int] = Field(None, ge=0)
    consultorio: Optional[int] = Field(None, ge=0)
    codigo_luz: Optional[str] = None
    codigo_gas: Optional[str] = None
    codigo_agua: Optional[str] = None
    codigo_municipal: Optional[str] = None
    propietarios: List[int] = []


class CatalogoIn(Entrada):
    nombre: Optional[str] = None
    id_provincia: Optional[int] = None


INDICES = ["IPC", "ICL", "Casa Propia"]
MONEDAS = ["ARS", "USD"]


class ContratoIn(Entrada):
    id_propiedad: Optional[int] = None
    alquiler_actual: Optional[Decimal] = None
    desde: Optional[date] = None
    hasta: Optional[date] = None
    frecuencia_de_actualizacion: Optional[int] = None
    proxima_actualizacion: Optional[date] = None
    indice_de_actualizacion: Optional[str] = None
    forma_pago: Optional[str] = None
    porcentaje_honorarios: Optional[Decimal] = None
    id_estado_contrato: Optional[int] = None
    moneda: Optional[str] = None
    inquilinos: List[int] = []


class EstadoContratoIn(BaseModel):
    id_estado_contrato: int

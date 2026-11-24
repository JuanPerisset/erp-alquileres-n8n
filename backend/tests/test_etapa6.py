"""Etapa 6 - Actualizaciones de alquiler, Centro de impresión (PDF) y Comunicaciones."""
import os
from datetime import date

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ADMIN = {"email": "admin@inmobiliaria-demo.com.ar", "password": "Perisset2026!"}
OPERADORA = {"email": "operadora@perisset.com.ar", "password": "Operadora2026!"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="session")
def operadora_client():
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=OPERADORA)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_401_sin_login(self):
        r = requests.get(f"{BASE}/actualizaciones/vencidas")
        assert r.status_code == 401
        r = requests.get(f"{BASE}/comunicaciones")
        assert r.status_code == 401
        r = requests.get(f"{BASE}/impresion/resumen", params={"mes": "2026-09-01"})
        assert r.status_code == 401


# ---------- Actualizaciones ----------
class TestVencidas:
    def test_vencidas_contratos_esperados(self, client):
        r = client.get(f"{BASE}/actualizaciones/vencidas")
        assert r.status_code == 200, r.text
        data = r.json()
        ids = sorted(f["id_contrato"] for f in data)
        assert ids == [3, 4, 7, 9], f"Vencidos esperados [3,4,7,9], got {ids}"
        assert 10 not in ids, "El contrato 10 (vencido/inactivo) NO debe aparecer"
        for f in data:
            assert f["dias_vencida"] is not None and int(f["dias_vencida"]) >= 0
            assert f["pendiente_aprobacion"] is False

    def test_vencidas_operadora(self, operadora_client):
        r = operadora_client.get(f"{BASE}/actualizaciones/vencidas")
        assert r.status_code == 200


class TestEjecutar:
    """Flujo A: crea historial + comunicación pendiente, no toca contrato."""

    def test_ejecutar_crea_historial_y_comunicaciones(self, client):
        # Snapshot antes
        hist_antes = client.get(f"{BASE}/actualizaciones/historial").json()
        com_antes = client.get(f"{BASE}/actualizaciones/comunicaciones").json()
        venc_antes = client.get(f"{BASE}/actualizaciones/vencidas").json()
        contratos_vencidos = {f["id_contrato"]: dict(f) for f in venc_antes}

        r = client.post(f"{BASE}/actualizaciones/ejecutar")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("vencidas") == len(venc_antes)

        hist_despues = client.get(f"{BASE}/actualizaciones/historial").json()
        com_despues = client.get(f"{BASE}/actualizaciones/comunicaciones").json()
        venc_despues = client.get(f"{BASE}/actualizaciones/vencidas").json()

        assert len(hist_despues) - len(hist_antes) == len(venc_antes), "Debe crear 1 historial por vencido"
        assert len(com_despues) - len(com_antes) == len(venc_antes), "Debe crear 1 comunicación por vencido"

        # Vencidas quedan igual (no se modifica el contrato) y ahora todas pendiente_aprobacion=true
        venc_despues_ids = sorted(f["id_contrato"] for f in venc_despues)
        assert venc_despues_ids == sorted(contratos_vencidos.keys())
        for f in venc_despues:
            assert f["pendiente_aprobacion"] is True
            orig = contratos_vencidos[f["id_contrato"]]
            # alquiler_actual y proxima_actualizacion sin cambios
            assert float(f["alquiler_actual"] or 0) == float(orig["alquiler_actual"] or 0)
            assert f["proxima_actualizacion"] == orig["proxima_actualizacion"]

        # Las nuevas comunicaciones tienen aprobado NULL
        nuevas_ids = {c["id"] for c in com_despues} - {c["id"] for c in com_antes}
        assert len(nuevas_ids) == len(venc_antes)
        nuevas = [c for c in com_despues if c["id"] in nuevas_ids]
        for c in nuevas:
            assert c["aprobado"] is None

    def test_segundo_ejecutar_devuelve_400(self, client):
        r = client.post(f"{BASE}/actualizaciones/ejecutar")
        assert r.status_code == 400, r.text
        assert "pendiente" in r.json()["detail"].lower()
        assert "telegram" in r.json()["detail"].lower()

    def test_segundo_ejecutar_no_duplica_filas(self, client):
        hist1 = len(client.get(f"{BASE}/actualizaciones/historial").json())
        com1 = len(client.get(f"{BASE}/actualizaciones/comunicaciones").json())
        client.post(f"{BASE}/actualizaciones/ejecutar")  # 400 esperado
        hist2 = len(client.get(f"{BASE}/actualizaciones/historial").json())
        com2 = len(client.get(f"{BASE}/actualizaciones/comunicaciones").json())
        assert hist1 == hist2 and com1 == com2


class TestHistorialComunicaciones:
    def test_historial_estructura(self, client):
        r = client.get(f"{BASE}/actualizaciones/historial")
        assert r.status_code == 200
        data = r.json()
        if data:
            f = data[0]
            for k in ("id_actualizacion", "id_contrato", "fecha_de_actualizacion",
                     "alquiler_anterior", "alquiler_nuevo", "porcentaje_aplicado", "aprobado"):
                assert k in f

    def test_comunicaciones_actualizaciones_estructura(self, client):
        r = client.get(f"{BASE}/actualizaciones/comunicaciones")
        assert r.status_code == 200
        data = r.json()
        # Debe contener aprobado tanto NULL como True/False (datos semilla)
        aprobados = {c["aprobado"] for c in data}
        assert None in aprobados


# ---------- Impresión ----------
class TestImpresion:
    def test_resumen_septiembre(self, client):
        r = client.get(f"{BASE}/impresion/resumen", params={"mes": "2026-09-01"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for row in data:
            assert "estado" in row and "moneda" in row and "cantidad" in row

    def test_pdf_mes_sin_pagadas_devuelve_424(self, client):
        r = client.post(f"{BASE}/impresion/pdf", json={"mes_impresion": "2027-03-01"})
        assert r.status_code == 424, r.text
        assert "Marzo 2027" in r.json()["detail"]

    def test_pdf_dia_distinto_de_1_devuelve_422(self, client):
        r = client.post(f"{BASE}/impresion/pdf", json={"mes_impresion": "2026-09-15"})
        assert r.status_code == 422

    def test_pdf_septiembre_descarga_pdf(self, client):
        r = client.post(f"{BASE}/impresion/pdf", json={"mes_impresion": "2026-09-01"})
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")
        disp = r.headers.get("content-disposition", "")
        assert "comprobantes-2026-09.pdf" in disp

    def test_resumen_operadora(self, operadora_client):
        r = operadora_client.get(f"{BASE}/impresion/resumen", params={"mes": "2026-09-01"})
        assert r.status_code == 200


# ---------- Comunicaciones (externas) ----------
class TestComunicaciones:
    def test_comunicaciones_septiembre(self, client):
        r = client.get(f"{BASE}/comunicaciones", params={"mes": "2026-09-01"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        # Debe haber al menos 1 ERROR con detalle del número no habilitado
        errores = [c for c in data if (c.get("estado_envio") or "").upper() == "ERROR"]
        assert errores, "Debe haber al menos 1 comunicación con estado ERROR"
        assert any("whatsapp" in (c.get("detalles_error") or "").lower() for c in errores)
        # Filtrado por fecha_envio - todas deben caer en Septiembre 2026
        for c in data:
            if c.get("fecha_envio"):
                assert c["fecha_envio"].startswith("2026-09")

    def test_comunicaciones_destinatario_resuelto_por_celular(self, client):
        data = client.get(f"{BASE}/comunicaciones", params={"mes": "2026-09-01"}).json()
        resueltos = [c for c in data if c.get("destinatario") and c["destinatario"].get("nombre")]
        assert resueltos, "Al menos 1 comunicación debe resolver el destinatario por celular"

    def test_comunicaciones_sin_mes_devuelve_todas(self, client):
        r = client.get(f"{BASE}/comunicaciones")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_comunicaciones_operadora(self, operadora_client):
        r = operadora_client.get(f"{BASE}/comunicaciones", params={"mes": "2026-09-01"})
        assert r.status_code == 200

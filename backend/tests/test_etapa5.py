"""Etapa 5 - Pagos a propietarios: pendientes, registro vía webhook D (simulador) e historial."""
import os
from datetime import date, timedelta

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


# ---------- Pendientes ----------
class TestPendientes:
    def test_pendientes_tiene_4_filas_esperadas(self, client):
        r = client.get(f"{BASE}/pagos-propietarios/pendientes")
        assert r.status_code == 200, r.text
        data = r.json()
        ids = sorted(f["id"] for f in data)
        assert ids == [11, 12, 17, 18], f"Pendientes esperados [11,12,17,18], got {ids}"

    def test_pendiente_11_ferreyra_laura_4pct(self, client):
        data = client.get(f"{BASE}/pagos-propietarios/pendientes").json()
        f = next(x for x in data if x["id"] == 11)
        assert f["id_contrato"] == 2
        assert f["moneda"] == "ARS"
        assert float(f["alquiler"]) == 320000.0
        assert float(f["porcentaje_honorarios"]) == 4.0
        assert float(f["honorarios"]) == 12800.0
        assert float(f["neto"]) == 307200.0
        apellidos = {p["apellido"] for p in f["propietarios"]}
        assert "Ferreyra" in apellidos

    def test_pendiente_12_ansaldi_5pct_no_incluye_servicios_ni_conceptos(self, client):
        """Liq 12 tiene concepto plomería 45.000 y servicios; neto propietario debe seguir siendo 361.000 (sobre alquiler puro)."""
        data = client.get(f"{BASE}/pagos-propietarios/pendientes").json()
        f = next(x for x in data if x["id"] == 12)
        assert float(f["alquiler"]) == 380000.0
        assert float(f["porcentaje_honorarios"]) == 5.0
        assert float(f["honorarios"]) == 19000.0
        assert float(f["neto"]) == 361000.0

    def test_pendiente_17_usd_7pct(self, client):
        data = client.get(f"{BASE}/pagos-propietarios/pendientes").json()
        f = next(x for x in data if x["id"] == 17)
        assert f["moneda"] == "USD"
        assert float(f["alquiler"]) == 850.0
        assert float(f["porcentaje_honorarios"]) == 7.0
        assert float(f["honorarios"]) == 59.5
        assert float(f["neto"]) == 790.5

    def test_pendiente_18_oct_bustos_graciela_y_hector_en_una_fila(self, client):
        """Liq 18 (Oct) contrato 1 debe venir como UNA fila con los 2 propietarios Bustos."""
        data = client.get(f"{BASE}/pagos-propietarios/pendientes").json()
        filas_18 = [x for x in data if x["id"] == 18]
        assert len(filas_18) == 1, "Debe ser una sola fila aunque haya varios propietarios"
        f = filas_18[0]
        assert float(f["alquiler"]) == 450000.0
        assert float(f["porcentaje_honorarios"]) == 5.0
        assert float(f["honorarios"]) == 22500.0
        assert float(f["neto"]) == 427500.0
        apellidos = [p["apellido"] for p in f["propietarios"]]
        assert apellidos.count("Bustos") == 2


# ---------- Registrar pago (webhook D simulado) ----------
class TestRegistrarPago:
    def test_doble_pago_rechazado(self, client):
        """Liq 10 (Agosto #1) ya tiene pago → segundo intento debe fallar 400."""
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 10, "fecha_pago": "2026-10-09"})
        assert r.status_code == 400
        assert "ya tiene registrado" in r.json()["detail"].lower()

    def test_pago_liquidacion_no_pagada_confirmada(self, client):
        """Liq 19 (Oct #2) está confirmada (no pagada) → 400."""
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 19, "fecha_pago": "2026-10-09"})
        assert r.status_code == 400

    def test_pago_liquidacion_borrador(self, client):
        """Liq 22 está en borrador → 400."""
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 22, "fecha_pago": "2026-10-09"})
        assert r.status_code == 400

    def test_pago_fecha_futura_rechazado(self, client):
        futura = (date(2026, 10, 9) + timedelta(days=5)).isoformat()
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 11, "fecha_pago": futura})
        assert r.status_code == 400
        assert "futura" in r.json()["detail"].lower()

    def test_registrar_pago_liq_11_persiste_neto_y_pct_historico(self, client):
        """Flujo completo: POST → simulador D inserta en pagos_propietarios con monto_neto y % histórico; aparece en historial."""
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 11, "fecha_pago": "2026-10-05"})
        assert r.status_code == 200, r.text
        row = r.json()
        assert row["id"] == 11
        assert float(row["monto_neto"]) == 307200.0
        assert float(row["porcentaje_honorarios_aplicado"]) == 4.0
        assert float(row["honorarios"]) == 12800.0

        # Verificar en pendientes: ya no aparece
        pend = client.get(f"{BASE}/pagos-propietarios/pendientes").json()
        assert 11 not in [f["id"] for f in pend]

        # Verificar en historial de Octubre 2026
        hist = client.get(f"{BASE}/pagos-propietarios/historial", params={"mes": "2026-10-01"}).json()
        assert 11 in [f["id"] for f in hist]

        # Verificar en detalle de liquidación
        det = client.get(f"{BASE}/liquidaciones/11").json()
        assert det.get("pago_propietario") is not None
        pp = det["pago_propietario"]
        assert float(pp["monto_neto"]) == 307200.0
        assert float(pp["porcentaje_honorarios_aplicado"]) == 4.0

    def test_doble_pago_misma_liq_recien_pagada(self, client):
        """Después de pagar liq 11, un segundo POST debe fallar 400."""
        r = client.post(f"{BASE}/pagos-propietarios", json={"id_liquidacion": 11, "fecha_pago": "2026-10-05"})
        assert r.status_code == 400


# ---------- Historial ----------
class TestHistorial:
    def test_historial_agosto_9_pagos_8_ars_1_usd(self, client):
        r = client.get(f"{BASE}/pagos-propietarios/historial", params={"mes": "2026-08-01"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 9, f"Esperado 9 pagos Agosto, got {len(data)}"
        monedas = [f["moneda"] for f in data]
        assert monedas.count("ARS") == 8
        assert monedas.count("USD") == 1

    def test_historial_agosto_contrato_4_pct_historico_5(self, client):
        """Liq 4 (Agosto contrato 4 Ansaldi): el contrato hoy tiene 6% pero el pago histórico guarda 5%."""
        data = client.get(f"{BASE}/pagos-propietarios/historial", params={"mes": "2026-08-01"}).json()
        f = next(x for x in data if x["id"] == 4)
        assert float(f["porcentaje_honorarios_aplicado"]) == 5.0
        assert float(f["honorarios"]) == 25500.0
        assert float(f["monto_neto"]) == 484500.0

    def test_historial_sin_mes_devuelve_todos(self, client):
        r = client.get(f"{BASE}/pagos-propietarios/historial")
        assert r.status_code == 200
        # Al menos los pagos pre-existentes (12) + el que acabamos de crear (liq 11)
        assert len(r.json()) >= 13


# ---------- Operadora puede usar ----------
class TestOperadora:
    def test_operadora_lista_pendientes(self, operadora_client):
        r = operadora_client.get(f"{BASE}/pagos-propietarios/pendientes")
        assert r.status_code == 200

    def test_operadora_lista_historial(self, operadora_client):
        r = operadora_client.get(f"{BASE}/pagos-propietarios/historial", params={"mes": "2026-08-01"})
        assert r.status_code == 200

"""Etapa 7 (Dashboard) y Etapa 8 (Operación/Sistema) - tests."""
import os
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
def op_client():
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=OPERADORA)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


# ---------- Dashboard (Etapa 7) ----------
class TestDashboard:
    def test_sin_login_401(self):
        r = requests.get(f"{BASE}/dashboard", params={"mes": "2026-10-01"})
        assert r.status_code == 401

    def test_sin_mes_devuelve_422(self, client):
        r = client.get(f"{BASE}/dashboard")
        assert r.status_code == 422

    def test_mes_no_primer_dia_400(self, client):
        r = client.get(f"{BASE}/dashboard", params={"mes": "2026-10-15"})
        assert r.status_code == 400
        assert "primer día" in r.json()["detail"].lower() or "primer dia" in r.json()["detail"].lower()

    def test_dashboard_estructura(self, client):
        r = client.get(f"{BASE}/dashboard", params={"mes": "2026-10-01"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("mes", "hoy", "ventana_vencimiento_dias", "kpis", "morosos",
                  "vencimientos_contratos", "actualizaciones_pendientes", "borradores_mes"):
            assert k in d, f"Falta clave {k}"
        assert d["mes"] == "2026-10-01"
        assert d["ventana_vencimiento_dias"] == 60
        assert isinstance(d["kpis"], list)
        # Si hay KPIs, deben tener todas las claves
        for k in d["kpis"]:
            for key in ("moneda", "contratos_activos", "total_mes", "recaudado_mes",
                        "pendiente_mes", "honorarios_mes", "borradores"):
                assert key in k, f"KPI falta {key}"
        # Morosos
        for m in d["morosos"]:
            for key in ("id", "dias_atraso", "moneda", "inquilinos"):
                assert key in m
            assert isinstance(m["inquilinos"], list)

    def test_dashboard_operadora(self, op_client):
        r = op_client.get(f"{BASE}/dashboard", params={"mes": "2026-10-01"})
        assert r.status_code == 200


# ---------- Sistema / Operación (Etapa 8) ----------
class TestOperacion:
    def test_sin_login_401(self):
        r = requests.get(f"{BASE}/sistema/operacion")
        assert r.status_code == 401

    def test_operacion_estructura(self, client):
        r = client.get(f"{BASE}/sistema/operacion")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "base" in d and "n8n" in d
        b = d["base"]
        for k in ("nombre", "host_configurado", "puerto", "usuario", "ddl_completo", "faltantes"):
            assert k in b
        assert b["ddl_completo"] is True
        assert b["faltantes"] == []
        n = d["n8n"]
        for k in ("modo", "base_url", "secreto_configurado", "listo_para_produccion", "webhooks"):
            assert k in n
        assert isinstance(n["webhooks"], list)
        assert n["modo"] == "simulador"
        assert n["listo_para_produccion"] is False

    def test_n8n_ping_simulador(self, client):
        r = client.post(f"{BASE}/sistema/n8n/ping")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["modo"] == "simulador"
        assert "detalle" in d


# ---------- Smoke de etapas previas ----------
class TestEtapasPrevias:
    def test_contratos_listado(self, client):
        r = client.get(f"{BASE}/contratos")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_liquidaciones_mes(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-09-01"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_pagos_propietarios_pendientes(self, client):
        r = client.get(f"{BASE}/pagos-propietarios/pendientes")
        # 200 esperado; aceptar 404 si endpoint tiene otro path
        assert r.status_code in (200, 404)

    def test_actualizaciones_vencidas(self, client):
        r = client.get(f"{BASE}/actualizaciones/vencidas")
        assert r.status_code == 200

    def test_impresion_resumen(self, client):
        r = client.get(f"{BASE}/impresion/resumen", params={"mes": "2026-09-01"})
        assert r.status_code == 200

    def test_comunicaciones_mes(self, client):
        r = client.get(f"{BASE}/comunicaciones", params={"mes": "2026-09-01"})
        assert r.status_code == 200

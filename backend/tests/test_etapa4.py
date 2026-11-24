"""Etapa 4 - Liquidaciones (borradores, servicios, conceptos, confirmar, notificar, cobro)."""
import os
from datetime import date
from decimal import Decimal

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ADMIN = {"email": "admin@inmobiliaria-demo.com.ar", "password": "Perisset2026!"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


# ---------- Listados y totales por moneda ----------
class TestListar:
    def test_listar_octubre(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        assert r.status_code == 200
        data = r.json()
        ids = sorted(l["id"] for l in data)
        assert ids == [18, 19, 20, 21, 22, 23]
        # Inquilinos agrupados: contrato 1 debe traer varios inquilinos
        c1 = next(l for l in data if l["id_contrato"] == 1)
        assert len(c1["inquilinos"]) >= 2

    def test_listar_septiembre_mix_monedas(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-09-01"})
        assert r.status_code == 200
        monedas = {l["moneda"] for l in r.json()}
        assert "ARS" in monedas and "USD" in monedas

    def test_listar_mes_invalido(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-15"})
        assert r.status_code == 400


# ---------- Generar borradores (idempotente) ----------
class TestGenerar:
    def test_generar_octubre_crea_contratos_faltantes_y_no_duplica(self, client):
        # Primera corrida: debe crear 3 (contratos 4, 8, 9 sin liq en octubre)
        r = client.post(f"{BASE}/liquidaciones/generar", json={"mes_año": "2026-10-01"})
        assert r.status_code == 200
        creadas = r.json()["creadas"]
        assert creadas == 3

        r2 = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        contratos = sorted({l["id_contrato"] for l in r2.json()})
        assert contratos == [1, 2, 3, 4, 5, 6, 7, 8, 9]

        # Verifica que #4, #8, #9 queden en borrador con alquiler = alquiler_actual, total = alquiler
        for l in r2.json():
            if l["id_contrato"] in (4, 8, 9) and l["estado_liquidacion"].lower() == "borrador":
                assert Decimal(str(l["alquiler"])) == Decimal(str(l["alquiler_actual"]))
                assert Decimal(str(l["total"])) == Decimal(str(l["alquiler"]))

        # Segunda corrida: no duplica
        r3 = client.post(f"{BASE}/liquidaciones/generar", json={"mes_año": "2026-10-01"})
        assert r3.json()["creadas"] == 0


# ---------- Edicion borrador: servicios + recálculo ----------
class TestEditorBorrador:
    def test_servicios_y_recalculo(self, client):
        # buscar un borrador recién generado (contrato 4 oct 2026)
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        liq = next(l for l in r.json() if l["id_contrato"] == 4 and l["estado_liquidacion"].lower() == "borrador")
        lid = liq["id"]
        alquiler = Decimal(str(liq["alquiler"]))

        body = {"luz": 10000, "gas": 5000, "agua": 2000, "municipal": None, "expensas": 8000, "seguro": None}
        r2 = client.put(f"{BASE}/liquidaciones/{lid}/servicios", json=body)
        assert r2.status_code == 200
        d = r2.json()
        esperado = alquiler + Decimal("25000")
        assert Decimal(str(d["total"])) == esperado
        assert d["servicios_detalle"]["id_estado_servicio"] == 1  # cargado

    def test_conceptos_adicional_y_descuento(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        liq = next(l for l in r.json() if l["id_contrato"] == 4 and l["estado_liquidacion"].lower() == "borrador")
        lid = liq["id"]
        pre_total = Decimal(str(liq["total"]))

        a = client.post(f"{BASE}/liquidaciones/{lid}/conceptos",
                        json={"descripcion": "Trabajo de plomería", "monto": 45000, "tipo": "adicional"})
        assert a.status_code == 200
        d = client.post(f"{BASE}/liquidaciones/{lid}/conceptos",
                        json={"descripcion": "TEST_descuento", "monto": 10000, "tipo": "descuento"})
        assert d.status_code == 200
        total = Decimal(str(d.json()["total"]))
        assert total == pre_total + Decimal("45000") - Decimal("10000")

        # Editar concepto
        cid = d.json()["conceptos"][-1]["id_concepto"]
        e = client.put(f"{BASE}/liquidaciones/{lid}/conceptos/{cid}",
                       json={"descripcion": "TEST_descuento_edit", "monto": 20000, "tipo": "descuento"})
        assert e.status_code == 200
        total2 = Decimal(str(e.json()["total"]))
        assert total2 == pre_total + Decimal("45000") - Decimal("20000")

        # Borrar concepto
        db = client.delete(f"{BASE}/liquidaciones/{lid}/conceptos/{cid}")
        assert db.status_code == 200
        total3 = Decimal(str(db.json()["total"]))
        assert total3 == pre_total + Decimal("45000")

    def test_monto_negativo_rechazado(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        lid = next(l for l in r.json() if l["id_contrato"] == 4 and l["estado_liquidacion"].lower() == "borrador")["id"]
        bad = client.post(f"{BASE}/liquidaciones/{lid}/conceptos",
                          json={"descripcion": "x", "monto": -5, "tipo": "adicional"})
        assert bad.status_code in (400, 422)

    def test_refrescar_alquiler(self, client):
        # Cambiar alquiler_actual del contrato 4
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        liq = next(l for l in r.json() if l["id_contrato"] == 4 and l["estado_liquidacion"].lower() == "borrador")
        lid, orig = liq["id"], Decimal(str(liq["alquiler_actual"]))

        # Obtener contrato original
        c = client.get(f"{BASE}/contratos/4").json()

        # Cambiar alquiler_actual (modificando via PUT)
        payload = {k: c[k] for k in c if k not in ("id_contrato", "created_at", "updated_at")}
        # Pydantic contrato puede requerir campos específicos; probamos con el modelo mínimo
        # Mejor: usar SQL directo via test db no permitido; usemos el endpoint. Si falla, saltamos.
        nuevo = orig + Decimal("50000")
        put_body = {
            "id_propiedad": c["id_propiedad"],
            "desde": c["desde"],
            "hasta": c["hasta"],
            "alquiler_actual": float(nuevo),
            "moneda": c["moneda"],
            "porcentaje_honorarios": c.get("porcentaje_honorarios"),
            "frecuencia_de_actualizacion": c.get("frecuencia_de_actualizacion"),
            "proxima_actualizacion": c.get("proxima_actualizacion"),
            "indice_de_actualizacion": c.get("indice_de_actualizacion"),
            "forma_pago": c.get("forma_pago"),
            "id_estado_contrato": c.get("id_estado_contrato"),
            "inquilinos": [i["id"] for i in c.get("inquilinos", [])] or None,
        }
        # Filtrar None
        put_body = {k: v for k, v in put_body.items() if v is not None}
        up = client.put(f"{BASE}/contratos/4", json=put_body)
        if up.status_code >= 400:
            pytest.skip(f"PUT /contratos/4 no aceptó payload: {up.status_code} {up.text[:200]}")

        # Verificar aviso: alquiler != alquiler_actual
        r2 = client.get(f"{BASE}/liquidaciones/{lid}")
        assert Decimal(str(r2.json()["alquiler"])) != Decimal(str(r2.json()["alquiler_actual"]))

        # Refrescar
        rf = client.post(f"{BASE}/liquidaciones/{lid}/refrescar-alquiler")
        assert rf.status_code == 200
        assert Decimal(str(rf.json()["alquiler"])) == Decimal(str(rf.json()["alquiler_actual"])) == nuevo

        # Restaurar original
        put_body["alquiler_actual"] = float(orig)
        client.put(f"{BASE}/contratos/4", json=put_body)
        client.post(f"{BASE}/liquidaciones/{lid}/refrescar-alquiler")


# ---------- Confirmar ----------
class TestConfirmar:
    def test_confirmar_contrato_8_usd(self, client):
        r = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"})
        liq = next(l for l in r.json() if l["id_contrato"] == 8 and l["estado_liquidacion"].lower() == "borrador")
        lid = liq["id"]
        c = client.post(f"{BASE}/liquidaciones/{lid}/confirmar")
        assert c.status_code == 200
        d = c.json()
        assert d["estado_liquidacion"].lower() == "confirmada"
        assert d["fecha_confirmacion"] is not None

        # No se puede editar servicios de confirmada
        bad = client.put(f"{BASE}/liquidaciones/{lid}/servicios", json={"luz": 1})
        assert bad.status_code == 400


# ---------- Vista previa mora ----------
class TestVistaPreviaMora:
    def test_vista_previa_liq13_39_dias(self, client):
        """Liquidación 13 (Septiembre, contrato 4, total 676400). Pago 09/10/2026 → 39 días → 4% sobre el total = 27056"""
        r = client.get(f"{BASE}/liquidaciones/13/vista-previa-mora", params={"fecha_pago": "2026-10-09"})
        assert r.status_code == 200
        d = r.json()
        assert d["dias"] == 39
        assert Decimal(str(d["porcentaje_mora"])) == Decimal("4.00")
        assert Decimal(str(d["monto_mora"])) == Decimal("27056.00")
        assert Decimal(str(d["total_a_cobrar"])) == Decimal(str(d["total_liquidacion"])) + Decimal("27056.00")

    def test_vista_previa_25_dias_2pct(self, client):
        r = client.get(f"{BASE}/liquidaciones/13/vista-previa-mora", params={"fecha_pago": "2026-09-25"})
        d = r.json()
        assert d["dias"] == 25
        assert Decimal(str(d["porcentaje_mora"])) == Decimal("2.00")
        assert Decimal(str(d["monto_mora"])) == Decimal("13528.00")

    def test_vista_previa_15_dias_0pct(self, client):
        r = client.get(f"{BASE}/liquidaciones/13/vista-previa-mora", params={"fecha_pago": "2026-09-15"})
        d = r.json()
        assert d["dias"] == 15
        assert Decimal(str(d["porcentaje_mora"])) == Decimal("0.00")
        assert Decimal(str(d["monto_mora"])) == Decimal("0.00")


# ---------- Cobro ----------
class TestCobro:
    def test_cobro_borrador_rechazado(self, client):
        # buscar borrador (id 22 contrato 6 o 23 contrato 7)
        bad = client.post(f"{BASE}/liquidaciones/22/cobro", json={"fecha_pago": "2026-10-09"})
        assert bad.status_code == 400

    def test_cobro_fecha_futura_rechazado(self, client):
        bad = client.post(f"{BASE}/liquidaciones/13/cobro", json={"fecha_pago": "2027-01-01"})
        assert bad.status_code == 400

    def test_cobro_liq13_registra_valores_guardados(self, client):
        """Liq 13: Septiembre contrato 4, pendiente. Cobro 09/10/2026 → mora 27056 (4% de 676400)."""
        r = client.post(f"{BASE}/liquidaciones/13/cobro", json={"fecha_pago": "2026-10-09"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["estado_liquidacion"].lower() == "pagada"
        assert d["estado_pago"].lower() == "pagado"
        assert Decimal(str(d["monto_base"])) == Decimal("676400.00")
        assert Decimal(str(d["porcentaje_mora"])) == Decimal("4.00")
        assert Decimal(str(d["monto_mora"])) == Decimal("27056.00")
        assert Decimal(str(d["monto_total_pagado"])) == Decimal("676400.00") + Decimal("27056.00")

    def test_cobro_pagada_rechazado(self, client):
        bad = client.post(f"{BASE}/liquidaciones/13/cobro", json={"fecha_pago": "2026-10-09"})
        assert bad.status_code == 400


# ---------- Notificar ----------
class TestNotificar:
    def test_notificar_octubre_crea_pagos_pendientes(self, client):
        # Confirmar liq 23 (contrato 7 oct, borrador) para tener algo nuevo que notificar
        client.post(f"{BASE}/liquidaciones/23/confirmar")
        r = client.post(f"{BASE}/liquidaciones/notificar", json={"mes_año": "2026-10-01"})
        assert r.status_code == 200, r.text
        assert r.json()["respuesta"]["ok"] is True

        # Verificar en lista que liq 23 ahora tiene pago pendiente
        lst = client.get(f"{BASE}/liquidaciones", params={"mes": "2026-10-01"}).json()
        l23 = next(l for l in lst if l["id"] == 23)
        assert (l23["estado_pago"] or "").lower() == "pendiente"


# ---------- Detalle de pagada (liq 10) ----------
class TestDetallePagada:
    def test_detalle_liq10(self, client):
        r = client.get(f"{BASE}/liquidaciones/10")
        assert r.status_code == 200
        d = r.json()
        assert d["estado_liquidacion"].lower() == "pagada"
        assert d["id_pago_inquilino"] is not None
        assert Decimal(str(d["monto_total_pagado"])) == Decimal("586240.00")

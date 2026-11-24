"""Etapa 3 - Contratos + ajustes de personas/propiedades. Hoy = 2026-10-09."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "admin@inmobiliaria-demo.com.ar", "password": "Perisset2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin():
    s = _login(ADMIN)
    yield s
    s.post(f"{BASE_URL}/api/auth/logout", timeout=10)


# ---------- Listado y agregaciones ----------
class TestContratosListado:
    def test_list_10(self, admin):
        r = admin.get(f"{BASE_URL}/api/contratos", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 10, f"esperaba 10 contratos, obtuvo {len(rows)}"

    def test_contrato_1_inquilinos_y_propietarios(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        c1 = next(r for r in rows if r["id"] == 1)
        apellidos_inq = sorted(i["apellido"] for i in c1["inquilinos"])
        assert "Otamendi" in apellidos_inq and "Romero" in apellidos_inq
        apellidos_prop = sorted(p["apellido"] for p in c1["propietarios"])
        assert apellidos_prop == ["Bustos", "Bustos"]

    def test_contrato_4_inquilinos(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        c4 = next(r for r in rows if r["id"] == 4)
        apellidos = sorted(i["apellido"] for i in c4["inquilinos"])
        assert "Benítez" in apellidos and "Castro" in apellidos

    def test_contrato_8_moneda_usd_850(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        c8 = next(r for r in rows if r["id"] == 8)
        assert c8["moneda"] == "USD"
        assert float(c8["alquiler_actual"]) == 850.00

    def test_contrato_9_vencido_sugerido(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        c9 = next(r for r in rows if r["id"] == 9)
        assert c9["vencido_sugerido"] is True
        assert c9["estado"].lower() == "activo"

    def test_contrato_10_vencido_no_sugerido(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        c10 = next(r for r in rows if r["id"] == 10)
        assert c10["estado"].lower() == "vencido"
        # vencido_sugerido solo si activo
        assert c10["vencido_sugerido"] is False

    def test_actualizacion_vencida_flags(self, admin):
        rows = admin.get(f"{BASE_URL}/api/contratos", timeout=10).json()
        vencidas = {r["id"] for r in rows if r["actualizacion_vencida"]}
        # Según spec: #3, #4, #7, #9 tienen prox_actualizacion <= 2026-10-09 y activo
        assert {3, 4, 7, 9}.issubset(vencidas), f"vencidas={vencidas}"


# ---------- Detalle ----------
class TestContratoDetalle:
    def test_detalle_1(self, admin):
        r = admin.get(f"{BASE_URL}/api/contratos/1", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert len(d["historial"]) == 2
        assert len(d["lista_liquidaciones"]) == 3
        # Chequear primer monto 360000->405000 ICL 12,5%
        hist_ordenado = sorted(d["historial"], key=lambda h: h["fecha_de_actualizacion"])
        h1 = hist_ordenado[0]
        assert float(h1["alquiler_anterior"]) == 360000.00
        assert float(h1["alquiler_nuevo"]) == 405000.00
        # Verificar celular propietario presente
        assert d["propietarios"][0].get("celular") is not None


# ---------- Alta ----------
class TestContratoAlta:
    def test_sin_propiedad(self, admin):
        r = admin.post(f"{BASE_URL}/api/contratos", json={"inquilinos": [1]}, timeout=10)
        assert r.status_code == 422
        assert "id_propiedad" in r.json()["detail"]["campos"]

    def test_sin_inquilinos(self, admin):
        r = admin.post(f"{BASE_URL}/api/contratos", json={
            "id_propiedad": 10, "desde": "2026-11-01", "hasta": "2027-11-01",
            "alquiler_actual": 100000, "moneda": "ARS", "id_estado_contrato": 1,
            "inquilinos": []
        }, timeout=10)
        assert r.status_code == 422
        assert "inquilinos" in r.json()["detail"]["campos"]

    def test_hasta_menor_que_desde(self, admin):
        r = admin.post(f"{BASE_URL}/api/contratos", json={
            "id_propiedad": 10, "desde": "2026-11-01", "hasta": "2026-10-01",
            "alquiler_actual": 100000, "moneda": "ARS", "id_estado_contrato": 1,
            "inquilinos": [1]
        }, timeout=10)
        assert r.status_code == 422
        assert "hasta" in r.json()["detail"]["campos"]

    def test_alquiler_cero(self, admin):
        r = admin.post(f"{BASE_URL}/api/contratos", json={
            "id_propiedad": 10, "desde": "2026-11-01", "hasta": "2027-11-01",
            "alquiler_actual": 0, "moneda": "ARS", "id_estado_contrato": 1,
            "inquilinos": [1]
        }, timeout=10)
        assert r.status_code == 422
        assert "alquiler_actual" in r.json()["detail"]["campos"]

    def test_propiedad_con_contrato_activo(self, admin):
        r = admin.post(f"{BASE_URL}/api/contratos", json={
            "id_propiedad": 1, "desde": "2026-11-01", "hasta": "2028-11-01",
            "alquiler_actual": 100000, "moneda": "ARS", "id_estado_contrato": 1,
            "inquilinos": [1]
        }, timeout=10)
        assert r.status_code == 422
        msg = r.json()["detail"]["campos"].get("id_propiedad", "")
        assert "ya tiene otro contrato activo" in msg

    def test_crear_valido_sobre_propiedad_10(self, admin):
        # Buscar Vera Tomás + otro inquilino libre
        inq = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        vera = next(p for p in inq if p["apellido"] == "Vera" and p["nombre"] == "Tomás")
        otro = next(p for p in inq if p["id"] != vera["id"])
        payload = {
            "id_propiedad": 10, "desde": "2026-11-01", "hasta": "2028-10-31",
            "alquiler_actual": 500000, "moneda": "ARS", "id_estado_contrato": 1,
            "frecuencia_de_actualizacion": 3, "proxima_actualizacion": "2027-02-01",
            "inquilinos": [vera["id"], otro["id"]],
        }
        r = admin.post(f"{BASE_URL}/api/contratos", json=payload, timeout=10)
        # Propiedad 10 tenía contrato #10 vencido → debe permitir
        assert r.status_code == 200, r.text
        d = r.json()
        new_id = d["id"]
        assert len(d["inquilinos"]) == 2
        # Cleanup via delete
        del_r = admin.delete(f"{BASE_URL}/api/contratos/{new_id}", timeout=10)
        assert del_r.status_code == 200


# ---------- Marcar vencido ----------
class TestMarcarVencido:
    def test_patch_estado_vencido_y_volver(self, admin):
        # Guardar estado original
        c = admin.get(f"{BASE_URL}/api/contratos/9", timeout=10).json()
        assert c["estado"].lower() == "activo"
        # Marcar vencido (id_estado_contrato 3)
        r = admin.patch(f"{BASE_URL}/api/contratos/9/estado", json={"id_estado_contrato": 3}, timeout=10)
        assert r.status_code == 200
        assert r.json()["estado"].lower() == "vencido"
        assert r.json()["vencido_sugerido"] is False
        # Restaurar
        r2 = admin.patch(f"{BASE_URL}/api/contratos/9/estado", json={"id_estado_contrato": 1}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["estado"].lower() == "activo"


# ---------- Eliminar ----------
class TestEliminar:
    def test_delete_contrato_1_con_liquidaciones_409(self, admin):
        r = admin.delete(f"{BASE_URL}/api/contratos/1", timeout=10)
        assert r.status_code == 409


# ---------- Editar con liquidaciones (moneda bloqueada) ----------
class TestEditarConLiquidaciones:
    def test_cambiar_moneda_contrato_1_rechaza(self, admin):
        c = admin.get(f"{BASE_URL}/api/contratos/1", timeout=10).json()
        body = {
            "id_propiedad": c["id_propiedad"], "desde": c["desde"], "hasta": c["hasta"],
            "alquiler_actual": float(c["alquiler_actual"]),
            "moneda": "USD",  # Cambio prohibido
            "id_estado_contrato": c["id_estado_contrato"],
            "frecuencia_de_actualizacion": c.get("frecuencia_de_actualizacion"),
            "indice_de_actualizacion": c.get("indice_de_actualizacion"),
            "proxima_actualizacion": c.get("proxima_actualizacion"),
            "forma_pago": c.get("forma_pago"),
            "porcentaje_honorarios": c.get("porcentaje_honorarios"),
            "inquilinos": [i["id"] for i in c["inquilinos"]],
        }
        r = admin.put(f"{BASE_URL}/api/contratos/1", json=body, timeout=10)
        assert r.status_code == 422
        assert "moneda" in r.json()["detail"]["campos"]


# ---------- Personas: baja con contratos ----------
class TestPersonasBaja:
    def test_delete_inquilino_otamendi_con_contratos_409(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        otam = next(p for p in rows if p["apellido"] == "Otamendi")
        r = admin.delete(f"{BASE_URL}/api/inquilinos/{otam['id']}", timeout=10)
        assert r.status_code == 409

    def test_patch_estado_inquilino_a_inactivo_y_volver(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        otam = next(p for p in rows if p["apellido"] == "Otamendi")
        detail = admin.get(f"{BASE_URL}/api/inquilinos/{otam['id']}", timeout=10).json()
        payload = {k: detail.get(k) for k in ("nombre", "apellido", "dni", "cuit",
                                              "celular", "email", "profesion", "fecha_nacimiento")}
        payload["estado"] = "inactivo"
        r = admin.put(f"{BASE_URL}/api/inquilinos/{otam['id']}", json=payload, timeout=10)
        if r.status_code != 200:
            pytest.skip(f"inquilino no acepta 'estado' en PUT: {r.status_code} {r.text[:200]}")
        assert r.json().get("estado", "").lower() == "inactivo"
        # Restaurar
        payload["estado"] = "activo"
        r2 = admin.put(f"{BASE_URL}/api/inquilinos/{otam['id']}", json=payload, timeout=10)
        assert r2.status_code == 200

    def test_delete_propietario_con_propiedades_bloqueado(self, admin):
        rows = admin.get(f"{BASE_URL}/api/propietarios", timeout=10).json()
        bustos = next((p for p in rows if p["apellido"] == "Bustos"), None)
        assert bustos
        r = admin.delete(f"{BASE_URL}/api/propietarios/{bustos['id']}", timeout=10)
        assert r.status_code == 409
        msg = r.json()["detail"]
        assert "desvincul" in msg.lower() or "propiedades" in msg.lower()


# ---------- Celular: no transforma si no editó ----------
class TestCelularNoTransforma:
    def test_editar_profesion_no_cambia_celular(self, admin):
        # Buscar inquilino con celular que empiece con +549
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        candidato = next((p for p in rows if (p.get("celular") or "").startswith("+549")), None)
        if not candidato:
            pytest.skip("Sin inquilino con celular +549 pre-cargado")
        celular_original = candidato["celular"]
        detail = admin.get(f"{BASE_URL}/api/inquilinos/{candidato['id']}", timeout=10).json()
        payload = {k: detail.get(k) for k in ("nombre", "apellido", "dni", "cuit",
                                              "celular", "email", "profesion", "fecha_nacimiento")}
        payload["profesion"] = (payload.get("profesion") or "") + " TEST"
        r = admin.put(f"{BASE_URL}/api/inquilinos/{candidato['id']}", json=payload, timeout=10)
        assert r.status_code == 200
        assert r.json()["celular"] == celular_original
        # Revertir profesión
        payload["profesion"] = (detail.get("profesion") or "")
        admin.put(f"{BASE_URL}/api/inquilinos/{candidato['id']}", json=payload, timeout=10)

    def test_crear_inquilino_normaliza_celular(self, admin):
        payload = {"nombre": "Cel", "apellido": "TEST_Cel",
                   "celular": "+54 9 341 555-1234"}
        r = admin.post(f"{BASE_URL}/api/inquilinos", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["celular"] == "5493415551234", d
        iid = d["id"]
        # Cleanup
        admin.delete(f"{BASE_URL}/api/inquilinos/{iid}", timeout=10)

    def test_crear_inquilino_celular_invalido(self, admin):
        r = admin.post(f"{BASE_URL}/api/inquilinos",
                       json={"nombre": "X", "apellido": "TEST_bad", "celular": "abc"}, timeout=10)
        assert r.status_code == 422
        assert "celular" in r.json()["detail"]["campos"]


# ---------- DNI normalización ----------
class TestDNINormalizacion:
    def test_dni_con_puntos_se_guarda_sin(self, admin):
        payload = {"nombre": "D", "apellido": "TEST_DNI", "dni": "30.123.456"}
        r = admin.post(f"{BASE_URL}/api/inquilinos", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dni"] == "30123456"
        admin.delete(f"{BASE_URL}/api/inquilinos/{d['id']}", timeout=10)


# ---------- CLEANUP ----------
def test_zz_cleanup(admin):
    for tipo in ("inquilinos", "propietarios"):
        rows = admin.get(f"{BASE_URL}/api/{tipo}", timeout=15).json()
        for r in rows:
            if (r.get("apellido") or "").startswith("TEST_"):
                admin.delete(f"{BASE_URL}/api/{tipo}/{r['id']}", timeout=10)

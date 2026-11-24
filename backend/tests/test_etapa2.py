"""
Etapa 2 - ABM Inquilinos / Propietarios / Propiedades / Catálogos.
Cubre validaciones (DNI, CUIT, email, celular), cascada provincia→ciudad, duplicados,
multi-propietarios en propiedades, catálogos editables + 'en uso' + 'no editable'.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alquileres-admin.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@inmobiliaria-demo.com.ar", "password": "Perisset2026!"}
OPERADORA = {"email": "operadora@perisset.com.ar", "password": "Operadora2026!"}


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


@pytest.fixture(scope="module")
def operadora():
    s = _login(OPERADORA)
    yield s
    s.post(f"{BASE_URL}/api/auth/logout", timeout=10)


# ---------- INQUILINOS ----------
class TestInquilinos:
    def test_list_12_ordered(self, admin):
        r = admin.get(f"{BASE_URL}/api/inquilinos", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 12, f"esperaba 12, obtuvo {len(rows)}"
        apellidos = [r["apellido"] for r in rows]
        assert apellidos == sorted(apellidos, key=lambda s: s.lower()), apellidos

    def test_vera_tomas_sin_contratos(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        vera = next((p for p in rows if p["apellido"] == "Vera" and p["nombre"] == "Tomás"), None)
        assert vera, "Vera Tomás no está en la lista"
        assert vera["contratos"] == 0

    def test_validation_errors_on_create(self, admin):
        # Sin apellido
        r = admin.post(f"{BASE_URL}/api/inquilinos", json={"nombre": "X"}, timeout=10)
        assert r.status_code == 422
        campos = r.json()["detail"]["campos"]
        assert "apellido" in campos

        # DNI corto
        r = admin.post(f"{BASE_URL}/api/inquilinos",
                       json={"nombre": "X", "apellido": "Y", "dni": "12"}, timeout=10)
        assert r.status_code == 422
        assert "dni" in r.json()["detail"]["campos"]

        # CUIT corto
        r = admin.post(f"{BASE_URL}/api/inquilinos",
                       json={"nombre": "X", "apellido": "Y", "cuit": "123"}, timeout=10)
        assert r.status_code == 422
        assert "cuit" in r.json()["detail"]["campos"]

        # Celular inválido
        r = admin.post(f"{BASE_URL}/api/inquilinos",
                       json={"nombre": "X", "apellido": "Y", "celular": "abc"}, timeout=10)
        assert r.status_code == 422
        assert "celular" in r.json()["detail"]["campos"]

        # Email inválido
        r = admin.post(f"{BASE_URL}/api/inquilinos",
                       json={"nombre": "X", "apellido": "Y", "email": "no-mail"}, timeout=10)
        assert r.status_code == 422
        assert "email" in r.json()["detail"]["campos"]

    def test_crear_formatea_cuit_y_persiste(self, admin):
        payload = {"nombre": "Juan", "apellido": "TEST_Apellido",
                   "dni": "99887766", "cuit": "20301234567",
                   "celular": "+5493415551234", "email": "test_x@x.com"}
        r = admin.post(f"{BASE_URL}/api/inquilinos", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["cuit"] == "20-30123456-7"
        assert created["dni"] == "99887766"
        assert created["apellido"] == "TEST_Apellido"
        iid = created["id"]

        # GET persistido
        r2 = admin.get(f"{BASE_URL}/api/inquilinos/{iid}", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["cuit"] == "20-30123456-7"

        # DNI duplicado con otro
        r3 = admin.post(f"{BASE_URL}/api/inquilinos",
                        json={"nombre": "Z", "apellido": "TEST_dup", "dni": "99887766"}, timeout=10)
        assert r3.status_code == 422
        assert "dni" in r3.json()["detail"]["campos"]

        # Eliminar (sin contratos → OK)
        r4 = admin.delete(f"{BASE_URL}/api/inquilinos/{iid}", timeout=10)
        assert r4.status_code == 200

        # Verifica borrado
        assert admin.get(f"{BASE_URL}/api/inquilinos/{iid}", timeout=10).status_code == 404

    def test_dni_duplicado_otamendi(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        otam = next((p for p in rows if p["apellido"] == "Otamendi"), None)
        assert otam and otam["dni"]
        # Otro inquilino intenta usar ese DNI
        otro = next((p for p in rows if p["apellido"] != "Otamendi"), None)
        r = admin.put(f"{BASE_URL}/api/inquilinos/{otro['id']}",
                      json={"nombre": otro["nombre"], "apellido": otro["apellido"], "dni": otam["dni"]}, timeout=10)
        assert r.status_code == 422
        assert "Ya existe" in r.json()["detail"]["campos"]["dni"]

    def test_detalle_otamendi_tiene_contratos(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        otam = next((p for p in rows if p["apellido"] == "Otamendi"), None)
        d = admin.get(f"{BASE_URL}/api/inquilinos/{otam['id']}", timeout=10).json()
        assert len(d["vinculos"]) >= 1

    def test_delete_bloqueado_con_contratos(self, admin):
        rows = admin.get(f"{BASE_URL}/api/inquilinos", timeout=10).json()
        otam = next((p for p in rows if p["apellido"] == "Otamendi"), None)
        r = admin.delete(f"{BASE_URL}/api/inquilinos/{otam['id']}", timeout=10)
        assert r.status_code == 409


# ---------- PROPIETARIOS ----------
class TestPropietarios:
    def test_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/propietarios", timeout=10)
        assert r.status_code == 200
        rows = r.json()
        assert any(p["apellido"] == "Bustos" for p in rows)

    def test_crud_propietario(self, admin):
        payload = {"nombre": "Ana", "apellido": "TEST_Prop", "email": "test_prop@x.com"}
        r = admin.post(f"{BASE_URL}/api/propietarios", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # Delete
        assert admin.delete(f"{BASE_URL}/api/propietarios/{pid}", timeout=10).status_code == 200


# ---------- PROPIEDADES ----------
class TestPropiedades:
    def test_list_10(self, admin):
        r = admin.get(f"{BASE_URL}/api/propiedades", timeout=10)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 10, f"esperaba 10 propiedades, obtuvo {len(rows)}"

    def test_cordoba_1452_propietarios_bustos(self, admin):
        rows = admin.get(f"{BASE_URL}/api/propiedades", timeout=10).json()
        p = next((r for r in rows if r["calle"] == "Córdoba" and r["numero"] == 1452), None)
        assert p, "falta Córdoba 1452"
        ap = sorted([o["apellido"] for o in p["propietarios"]])
        assert ap == ["Bustos", "Bustos"], ap
        nombres = {o["nombre"] for o in p["propietarios"]}
        assert nombres == {"Graciela", "Héctor"}

    def test_belgrano_330_propietarios_medina(self, admin):
        rows = admin.get(f"{BASE_URL}/api/propiedades", timeout=10).json()
        p = next((r for r in rows if r["calle"] == "Belgrano" and r["numero"] == 330), None)
        assert p
        nombres = sorted(o["nombre"] for o in p["propietarios"])
        assert nombres == ["Carlos", "Silvia"]

    def test_ficha_propiedad_1_contratos(self, admin):
        r = admin.get(f"{BASE_URL}/api/propiedades/1", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert len(d["lista_contratos"]) >= 1
        c = d["lista_contratos"][0]
        apellidos = sorted(i["apellido"] for i in c["inquilinos"])
        assert "Otamendi" in apellidos and "Romero" in apellidos

    def test_crear_propiedad_sin_calle(self, admin):
        r = admin.post(f"{BASE_URL}/api/propiedades", json={"propietarios": []}, timeout=10)
        assert r.status_code == 422
        assert "calle" in r.json()["detail"]["campos"]

    def test_crear_con_multi_propietarios_y_borrar(self, admin):
        props = admin.get(f"{BASE_URL}/api/propietarios", timeout=10).json()
        ids = [p["id"] for p in props[:2]]
        payload = {
            "calle": "TEST_Calle", "numero": 9999,
            "id_tipo": 1, "id_estado_propiedad": 1,
            "dormitorio": 2, "baño": 1, "local": 0,
            "propietarios": ids,
        }
        r = admin.post(f"{BASE_URL}/api/propiedades", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        pid = d["id"]
        assert sorted(o["id"] for o in d["propietarios"]) == sorted(ids)

        # GET ficha para verificar persistencia
        g = admin.get(f"{BASE_URL}/api/propiedades/{pid}", timeout=10).json()
        assert len(g["propietarios"]) == 2

        # Borrar OK (sin contratos)
        assert admin.delete(f"{BASE_URL}/api/propiedades/{pid}", timeout=10).status_code == 200

    def test_borrar_propiedad_con_contratos_409(self, admin):
        r = admin.delete(f"{BASE_URL}/api/propiedades/1", timeout=10)
        assert r.status_code == 409


# ---------- CATALOGOS ----------
class TestCatalogos:
    def test_estados_pago_no_editable(self, admin):
        r = admin.post(f"{BASE_URL}/api/catalogos/estados_pago", json={"nombre": "x"}, timeout=10)
        assert r.status_code == 404

    def test_barrios_crud(self, admin):
        name = f"TEST_{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{BASE_URL}/api/catalogos/barrios", json={"nombre": name}, timeout=10)
        assert r.status_code == 200
        bid = r.json()["id"]
        # Duplicado
        d = admin.post(f"{BASE_URL}/api/catalogos/barrios", json={"nombre": name}, timeout=10)
        assert d.status_code == 400
        assert "Ya existe" in d.json()["detail"]
        # Edit
        new = f"TEST_{uuid.uuid4().hex[:6]}"
        e = admin.put(f"{BASE_URL}/api/catalogos/barrios/{bid}", json={"nombre": new}, timeout=10)
        assert e.status_code == 200 and e.json()["nombre"] == new
        # Delete
        assert admin.delete(f"{BASE_URL}/api/catalogos/barrios/{bid}", timeout=10).status_code == 200

    def test_barrio_centro_en_uso(self, admin):
        barrios = admin.get(f"{BASE_URL}/api/catalogos", timeout=10).json()["barrios"]
        centro = next((b for b in barrios if b["nombre"] == "Centro"), None)
        assert centro
        r = admin.delete(f"{BASE_URL}/api/catalogos/barrios/{centro['id']}", timeout=10)
        assert r.status_code == 409
        assert "uso" in r.json()["detail"].lower()

    def test_ciudades_crud_requires_provincia(self, admin):
        r = admin.post(f"{BASE_URL}/api/catalogos/ciudades", json={"nombre": "TEST_x"}, timeout=10)
        assert r.status_code == 422
        name = f"TEST_{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{BASE_URL}/api/catalogos/ciudades", json={"nombre": name, "id_provincia": 1}, timeout=10)
        assert r.status_code == 200
        cid = r.json()["id"]
        assert admin.delete(f"{BASE_URL}/api/catalogos/ciudades/{cid}", timeout=10).status_code == 200


# ---------- OPERADORA ----------
class TestOperadoraEtapa2:
    def test_puede_leer_inquilinos(self, operadora):
        assert operadora.get(f"{BASE_URL}/api/inquilinos", timeout=10).status_code == 200

    def test_puede_crear_y_borrar_propietario(self, operadora):
        r = operadora.post(f"{BASE_URL}/api/propietarios",
                           json={"nombre": "Op", "apellido": "TEST_Op"}, timeout=10)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert operadora.delete(f"{BASE_URL}/api/propietarios/{pid}", timeout=10).status_code == 200

    def test_puede_editar_catalogos(self, operadora):
        name = f"TEST_{uuid.uuid4().hex[:6]}"
        r = operadora.post(f"{BASE_URL}/api/catalogos/tipos_propiedad", json={"nombre": name}, timeout=10)
        assert r.status_code == 200
        tid = r.json()["id"]
        assert operadora.delete(f"{BASE_URL}/api/catalogos/tipos_propiedad/{tid}", timeout=10).status_code == 200


# ---------- CLEANUP ----------
def test_zz_cleanup_test_data(admin):
    """Limpia cualquier TEST_* remanente."""
    for tipo in ("inquilinos", "propietarios"):
        rows = admin.get(f"{BASE_URL}/api/{tipo}", timeout=15).json()
        for r in rows:
            if (r.get("apellido") or "").startswith("TEST_"):
                admin.delete(f"{BASE_URL}/api/{tipo}/{r['id']}", timeout=10)
    props = admin.get(f"{BASE_URL}/api/propiedades", timeout=15).json()
    for p in props:
        if (p.get("calle") or "").startswith("TEST_"):
            admin.delete(f"{BASE_URL}/api/propiedades/{p['id']}", timeout=10)
    cats = admin.get(f"{BASE_URL}/api/catalogos", timeout=15).json()
    for cat in ("barrios", "tipos_propiedad", "provincias"):
        for row in cats.get(cat, []):
            if row["nombre"].startswith("TEST_"):
                admin.delete(f"{BASE_URL}/api/catalogos/{cat}/{row['id']}", timeout=10)
    # ciudades vía /catalogos/ciudades (no está en catalogos global)
    cs = admin.get(f"{BASE_URL}/api/catalogos/ciudades", timeout=15).json()
    for c in cs:
        if c["nombre"].startswith("TEST_"):
            admin.delete(f"{BASE_URL}/api/catalogos/ciudades/{c['id']}", timeout=10)

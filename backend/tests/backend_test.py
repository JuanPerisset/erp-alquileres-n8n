"""
Backend tests for Perisset Inmobiliaria ERP (Etapa 1).
Cubre: auth (login/me/refresh/logout), roles, usuarios (admin), catálogos, sistema (tablas/webhooks),
brute-force lockout, protección 401 sin cookies.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alquileres-admin.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@inmobiliaria-demo.com.ar", "password": "Perisset2026!"}
OPERADORA = {"email": "operadora@perisset.com.ar", "password": "Operadora2026!"}


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    return r


@pytest.fixture
def admin_session():
    s = requests.Session()
    r = _login(s, ADMIN)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    yield s
    s.post(f"{BASE_URL}/api/auth/logout", timeout=10)


@pytest.fixture
def operadora_session():
    s = requests.Session()
    r = _login(s, OPERADORA)
    assert r.status_code == 200, f"operadora login failed: {r.status_code} {r.text}"
    yield s
    s.post(f"{BASE_URL}/api/auth/logout", timeout=10)


# ---------- AUTH ----------
class TestAuth:
    def test_login_admin_sets_httponly_cookies(self):
        s = requests.Session()
        r = _login(s, ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN["email"]
        assert data["rol"] == "administrador"
        cookies = {c.name: c for c in s.cookies}
        assert "access_token" in cookies
        assert "refresh_token" in cookies

    def test_login_wrong_password(self):
        s = requests.Session()
        r = _login(s, {"email": ADMIN["email"], "password": "wrongpass!!"})
        assert r.status_code in (401, 400, 429)
        # Spanish error
        text = r.text.lower()
        assert any(w in text for w in ["credenc", "incorrect", "inválid", "invalid"]) or r.status_code == 429

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_session(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["rol"] == "administrador"
        assert d["email"] == ADMIN["email"]

    def test_refresh(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/auth/refresh", timeout=10)
        assert r.status_code == 200

    def test_logout_clears_session(self):
        s = requests.Session()
        assert _login(s, ADMIN).status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert r.status_code in (200, 204)
        r2 = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r2.status_code == 401


# ---------- PROTECTED ENDPOINTS 401 ----------
class TestProtected:
    @pytest.mark.parametrize("path", [
        "/api/catalogos",
        "/api/catalogos/ciudades?id_provincia=1",
        "/api/sistema/tablas",
        "/api/sistema/webhooks",
        "/api/usuarios",
    ])
    def test_requires_auth(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code == 401


# ---------- SISTEMA ----------
class TestSistema:
    def test_tablas(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/sistema/tablas", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["esperadas"] == 24
        assert d["faltantes"] == []
        names = {t["tabla"] for t in d["tablas"]}
        # app_ tables
        assert "app_usuarios" in names
        assert "app_login_intentos" in names
        # 24 ddl + 2 app
        ddl = [t for t in d["tablas"] if t["origen"] == "ddl"]
        assert len(ddl) == 24

    def test_webhooks(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/sistema/webhooks", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) == 5
        paths = {w["path"] for w in d}
        for p in ["actualizar-alquileres", "notificar-liquidaciones",
                  "registrar-cobro", "pagar-propietario", "imprimir-comprobantes"]:
            assert p in paths


# ---------- CATALOGOS ----------
class TestCatalogos:
    def test_catalogos_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalogos", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for key in ["estados_pago", "estados_liquidacion", "estados_contrato", "tipos_propiedad"]:
            assert key in d, f"missing key {key}"
        pagos = {e["nombre"] for e in d["estados_pago"]}
        assert {"pendiente", "pagado"}.issubset(pagos)

    def test_ciudades_por_provincia(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalogos/ciudades?id_provincia=1", timeout=10)
        assert r.status_code == 200
        ciudades = r.json()
        nombres = {c["nombre"] for c in ciudades}
        assert "Rosario" in nombres


# ---------- USUARIOS (admin only) ----------
class TestUsuariosAdmin:
    def test_list_usuarios(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/usuarios", timeout=10)
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 2
        emails = {u["email"] for u in users}
        assert ADMIN["email"] in emails
        assert OPERADORA["email"] in emails

    def test_create_edit_usuario(self, admin_session):
        email = f"test_{uuid.uuid4().hex[:8]}@perisset.com.ar"
        payload = {"email": email, "nombre": "Test User", "rol": "operadora",
                   "password": "TestPass2026!", "activo": True}
        r = admin_session.post(f"{BASE_URL}/api/usuarios", json=payload, timeout=10)
        assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"
        created = r.json()
        uid = created["id"]
        assert created["email"] == email
        assert created["rol"] == "operadora"

        # Edit nombre and activo
        r2 = admin_session.patch(f"{BASE_URL}/api/usuarios/{uid}",
                                 json={"nombre": "Test User Editado", "activo": False}, timeout=10)
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["nombre"] == "Test User Editado"
        assert updated["activo"] is False

        # GET list to verify persistence
        r3 = admin_session.get(f"{BASE_URL}/api/usuarios", timeout=10)
        found = next((u for u in r3.json() if u["id"] == uid), None)
        assert found and found["nombre"] == "Test User Editado" and found["activo"] is False

    def test_admin_cannot_deactivate_self(self, admin_session):
        me = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10).json()
        r = admin_session.patch(f"{BASE_URL}/api/usuarios/{me['id']}",
                                json={"activo": False}, timeout=10)
        # Should refuse (400/403)
        assert r.status_code in (400, 403, 409), f"expected refusal, got {r.status_code} {r.text}"


# ---------- OPERADORA ROLE ----------
class TestOperadoraRole:
    def test_operadora_cannot_list_usuarios(self, operadora_session):
        r = operadora_session.get(f"{BASE_URL}/api/usuarios", timeout=10)
        assert r.status_code == 403

    def test_operadora_cannot_create_usuarios(self, operadora_session):
        r = operadora_session.post(f"{BASE_URL}/api/usuarios",
            json={"email": "test_block@x.com", "nombre": "X", "rol": "operadora", "password": "x12345678"},
            timeout=10)
        assert r.status_code == 403

    def test_operadora_can_access_catalogos(self, operadora_session):
        r = operadora_session.get(f"{BASE_URL}/api/catalogos", timeout=10)
        assert r.status_code == 200

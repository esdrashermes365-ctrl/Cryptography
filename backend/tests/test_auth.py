import hashlib
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from sqlalchemy import select

from app import config
from app.crypto import email_index
from app.db import SessionLocal
from app.models import User
from tests.conftest import GOOD_PASSWORD, register

BACKEND = Path(__file__).resolve().parents[1]


def login(client, email="esdras@example.com", password=GOOD_PASSWORD):
    return client.post("/api/login", json={"email": email, "password": password})


# ------------------------------------------------------------ mots de passe


def test_register_rejects_short_password(client):
    assert register(client, password="Court1!").status_code == 400


def test_register_rejects_common_password(client):
    response = register(client, password="motdepasse123")
    assert response.status_code == 400
    assert "courant" in response.json()["detail"]


def test_register_rejects_email_as_password(client):
    response = register(client, email="longueadresse@example.com", password="longueadresse@example.com")
    assert response.status_code == 400


def test_register_rejects_mismatch(client):
    response = client.post(
        "/api/register",
        json={"fullName": "A", "email": "a@example.com",
              "password": GOOD_PASSWORD, "confirmPassword": GOOD_PASSWORD + "x"},
    )
    assert response.status_code == 400


def test_duplicate_email_case_insensitive(client):
    assert register(client).status_code == 201
    assert register(client, email="ESDRAS@Example.com").status_code == 409


# ---------------------------------------------------------------- stockage


def test_email_is_encrypted_and_indexed_with_hmac(client):
    register(client)
    with SessionLocal() as db:
        user = db.scalars(select(User)).one()
    assert "esdras" not in user.email_encrypted
    assert user.email_hash == email_index("esdras@example.com")
    assert user.email_hash != hashlib.sha256(b"esdras@example.com").hexdigest()
    assert user.password_hash.startswith("$argon2id$")
    assert GOOD_PASSWORD not in user.password_hash


# ----------------------------------------------------------------- session


def test_login_sets_httponly_cookie_and_no_token_in_body(client):
    register(client)
    response = login(client)
    assert response.status_code == 200
    body = response.json()
    assert "access_token" not in body
    assert body["user"]["email"] == "esdras@example.com"
    cookie = response.headers["set-cookie"].lower()
    assert f"{config.SESSION_COOKIE_NAME}=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie


def test_me_requires_valid_session(client):
    assert client.get("/api/me").status_code == 401
    register(client)
    login(client)
    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["user"]["fullName"] == "Esdras G"


def test_logout_ends_session(client):
    register(client)
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401


def test_tampered_expired_and_foreign_keys_are_rejected(client):
    register(client)
    login(client)
    name = config.SESSION_COOKIE_NAME
    good = client.cookies.get(name)

    client.cookies.set(name, good[:-3] + "AAA")
    assert client.get("/api/me").status_code == 401

    now = datetime.now(timezone.utc)
    expired = jwt.encode({"sub": "1", "exp": now - timedelta(minutes=1)}, config.JWT_KEY, algorithm="HS256")
    client.cookies.set(name, expired)
    assert client.get("/api/me").status_code == 401

    # Jeton signé avec la clé AES : refusé, les clés sont bien séparées.
    forged = jwt.encode({"sub": "1", "exp": now + timedelta(hours=1)}, config.ENCRYPTION_KEY, algorithm="HS256")
    client.cookies.set(name, forged)
    assert client.get("/api/me").status_code == 401

    none_alg = jwt.encode({"sub": "1", "exp": now + timedelta(hours=1)}, None, algorithm="none")
    client.cookies.set(name, none_alg)
    assert client.get("/api/me").status_code == 401


# ---------------------------------------------------------- brute force


def test_login_is_rate_limited(client):
    register(client)
    for _ in range(config.LOGIN_MAX_PER_ACCOUNT_IP):
        assert login(client, password="mauvais-mot-de-passe").status_code == 401
    blocked = login(client)  # même le bon mot de passe est refusé pendant le blocage
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_unknown_email_and_wrong_password_look_identical(client):
    register(client)
    wrong = login(client, password="mauvais-mot-de-passe")
    unknown = login(client, email="inconnu@example.com", password="mauvais-mot-de-passe")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_unknown_email_costs_about_as_much_as_wrong_password(client):
    register(client)

    def measure(email):
        start = time.perf_counter()
        login(client, email=email, password="mauvais-mot-de-passe")
        return time.perf_counter() - start

    measure("esdras@example.com")  # échauffement
    limiter_reset()
    known = min(measure("esdras@example.com") for _ in range(2))
    limiter_reset()
    unknown = min(measure(f"inconnu{i}@example.com") for i in range(2))
    assert unknown > known * 0.5


def limiter_reset():
    from app.security import limiter
    limiter._hits.clear()


# ------------------------------------------------------- CORS et en-têtes


def test_cors_allows_only_configured_origin(client):
    ok = client.options(
        "/api/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "content-type"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert ok.headers.get("access-control-allow-credentials") == "true"

    bad = client.options(
        "/api/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_security_headers_present(client):
    response = client.get("/api/me")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_register_is_rate_limited(client):
    for i in range(config.REGISTER_MAX_PER_IP):
        register(client, email=f"u{i}@example.com")
    assert register(client, email="encore@example.com").status_code == 429


# ----------------------------------------------------------- configuration


def run_config(**env):
    import os
    full = {**os.environ, **env}
    return subprocess.run(
        [sys.executable, "-c", "import app.config"],
        cwd=BACKEND, env=full, capture_output=True, text=True,
    )


def test_config_refuses_identical_keys():
    result = run_config(JWT_SECRET_KEY="11" * 32)
    assert result.returncode != 0
    assert "différentes" in result.stderr


def test_config_refuses_missing_or_short_key():
    result = run_config(EMAIL_HASH_KEY="abcd")
    assert result.returncode != 0
    assert "32 octets" in result.stderr


def test_config_refuses_wildcard_cors():
    result = run_config(CORS_ORIGINS="*")
    assert result.returncode != 0


# --------------------------------------------------------------- migration


def test_hmac_migration_upgrades_old_accounts(client):
    register(client)
    old_hash = hashlib.sha256(b"esdras@example.com").hexdigest()
    with SessionLocal() as db:
        user = db.scalars(select(User)).one()
        user.email_hash = old_hash
        db.commit()
    assert login(client).status_code == 401  # ancien index : introuvable

    limiter_reset()
    from app.migrate_email_hash_hmac import migrate
    migrate()
    assert login(client).status_code == 200

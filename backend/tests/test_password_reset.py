import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app import config
from app.db import SessionLocal
from app.models import PasswordResetToken, User
from app.security import limiter
from tests.conftest import GOOD_PASSWORD, register
from tests.test_auth import login

NEW_PASSWORD = "lampe-bateau-nuage-77"
EMAIL = "esdras@example.com"


@pytest.fixture()
def sent(monkeypatch):
    """Capture les e-mails au lieu de les envoyer."""
    box = []
    monkeypatch.setattr(
        "app.routers.auth.send_reset_email", lambda to, link: box.append((to, link))
    )
    return box


def forgot(client, email=EMAIL):
    return client.post("/api/forgot-password", json={"email": email})


def token_from(link):
    assert "#token=" in link
    return link.split("#token=")[1]


def reset(client, token, password=NEW_PASSWORD, confirm=None):
    return client.post(
        "/api/reset-password",
        json={"token": token, "password": password, "confirmPassword": confirm or password},
    )


def test_unknown_and_known_email_get_the_same_answer(client, sent):
    register(client)
    known = forgot(client)
    unknown = forgot(client, "personne@example.com")
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(sent) == 1  # un seul e-mail part, pour le compte qui existe


def test_email_goes_to_the_decrypted_address_with_a_front_link(client, sent):
    register(client)
    forgot(client)
    to, link = sent[0]
    assert to == EMAIL
    assert link.startswith(f"{config.FRONTEND_URL}/reset-password#token=")


def test_only_the_token_hash_is_stored(client, sent):
    register(client)
    forgot(client)
    token = token_from(sent[0][1])
    with SessionLocal() as db:
        row = db.scalars(select(PasswordResetToken)).one()
    assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in row.token_hash
    assert row.used_at is None


def test_full_flow_changes_the_password(client, sent):
    register(client)
    forgot(client)
    response = reset(client, token_from(sent[0][1]))
    assert response.status_code == 200
    limiter._hits.clear()
    assert login(client, password=GOOD_PASSWORD).status_code == 401
    assert login(client, password=NEW_PASSWORD).status_code == 200
    with SessionLocal() as db:
        assert db.scalars(select(User)).one().password_hash.startswith("$argon2id$")


def test_link_works_only_once(client, sent):
    register(client)
    forgot(client)
    token = token_from(sent[0][1])
    assert reset(client, token).status_code == 200
    again = reset(client, token, password="un-autre-mot-de-passe-91")
    assert again.status_code == 400
    limiter._hits.clear()
    assert login(client, password=NEW_PASSWORD).status_code == 200


def test_new_request_replaces_previous_link(client, sent):
    register(client)
    forgot(client)
    forgot(client)
    first, second = (token_from(link) for _, link in sent)
    assert reset(client, first).status_code == 400
    assert reset(client, second).status_code == 200


def test_expired_link_is_refused(client, sent):
    register(client)
    forgot(client)
    token = token_from(sent[0][1])
    with SessionLocal() as db:
        row = db.scalars(select(PasswordResetToken)).one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    response = reset(client, token)
    assert response.status_code == 400
    assert "expiré" in response.json()["detail"]


def test_random_token_is_refused(client, sent):
    register(client)
    assert reset(client, "x" * 43).status_code == 400
    assert reset(client, "court").status_code == 422


def test_weak_password_is_refused_and_does_not_burn_the_link(client, sent):
    register(client)
    forgot(client)
    token = token_from(sent[0][1])
    assert reset(client, token, password="court").status_code == 400
    assert reset(client, token, password="motdepasse123").status_code == 400
    assert reset(client, token, confirm="different-de-la-saisie-1").status_code == 400
    assert reset(client, token).status_code == 200


def test_password_may_not_be_the_account_email(client, sent):
    register(client, email="adressetreslongue@example.com")
    forgot(client, "adressetreslongue@example.com")
    token = token_from(sent[0][1])
    assert reset(client, token, password="adressetreslongue@example.com").status_code == 400


def test_reset_closes_sessions_opened_before(client, sent):
    register(client)
    assert login(client).status_code == 200
    assert client.get("/api/me").status_code == 200  # session ouverte avant le changement

    forgot(client)
    # Le jeton date d'une seconde au moins : iat est en secondes entières.
    import time
    time.sleep(1.1)
    assert reset(client, token_from(sent[0][1])).status_code == 200
    assert client.get("/api/me").status_code == 401  # ancien cookie refusé

    limiter._hits.clear()
    assert login(client, password=NEW_PASSWORD).status_code == 200
    assert client.get("/api/me").status_code == 200


def test_reset_lifts_a_login_lockout(client, sent):
    register(client)
    for _ in range(config.LOGIN_MAX_PER_ACCOUNT_IP):
        login(client, password="mauvais-mot-de-passe")
    assert login(client).status_code == 429
    forgot(client)
    assert reset(client, token_from(sent[0][1])).status_code == 200
    assert login(client, password=NEW_PASSWORD).status_code == 200


def test_forgot_password_is_rate_limited_per_email(client, sent):
    register(client)
    for _ in range(config.FORGOT_MAX_PER_EMAIL):
        assert forgot(client).status_code == 200
    blocked = forgot(client)
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0
    assert len(sent) == config.FORGOT_MAX_PER_EMAIL


def test_rate_limit_answers_the_same_for_unknown_emails(client, sent):
    for _ in range(config.FORGOT_MAX_PER_EMAIL):
        assert forgot(client, "fantome@example.com").status_code == 200
    assert forgot(client, "fantome@example.com").status_code == 429  # pas de différence avec un compte réel


def test_invalid_email_format_is_a_422(client, sent):
    assert client.post("/api/forgot-password", json={"email": "pas-un-email"}).status_code == 422


def test_without_smtp_the_link_is_logged_in_development(client, caplog):
    import logging

    register(client)
    with caplog.at_level(logging.WARNING, logger="app.mailer"):
        forgot(client)
    assert any("/reset-password#token=" in record.getMessage() for record in caplog.records)


def test_smtp_failure_never_reaches_the_response(client, monkeypatch):
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.invalide.test")
    monkeypatch.setattr(config, "SMTP_PORT", 1)
    register(client)
    assert forgot(client).status_code == 200

from sqlalchemy import select, text

from app.crypto import decrypt_data
from app.db import SessionLocal, engine
from app.models import Tenant, User
from tests.conftest import register
from tests.test_auth import login

EMAIL = "esdras@example.com"


def test_tenant_email_is_encrypted_in_database(client):
    register(client)
    with SessionLocal() as db:
        tenant = db.scalars(select(Tenant)).one()
        user = db.scalars(select(User)).one()
    assert EMAIL not in tenant.email_encrypted and "esdras" not in tenant.email_encrypted
    assert decrypt_data(tenant.email_encrypted) == EMAIL
    # Nonce aléatoire : l'e-mail du tenant et celui du compte ne se ressemblent pas en base.
    assert tenant.email_encrypted != user.email_encrypted


def test_raw_sql_never_shows_the_address(client):
    register(client)
    with engine.connect() as connection:
        dump = " ".join(
            str(value)
            for table in ("users", "tenants")
            for row in connection.execute(text(f"SELECT * FROM {table}"))
            for value in row
        )
    assert EMAIL not in dump and "@example.com" not in dump


def test_tenant_email_is_returned_in_tenant_information(client):
    register(client)
    user = login(client).json()["user"]
    assert user["tenant"]["email"] == EMAIL
    assert user["tenant"]["name"] == "Tenant Esdras G"
    assert user["tenant"]["id"].startswith("tnt_")
    assert client.get("/api/me").json()["user"]["tenant"]["email"] == EMAIL


def test_email_is_normalised_before_encryption(client):
    register(client, email="  Esdras@Example.COM ")
    with SessionLocal() as db:
        tenant = db.scalars(select(Tenant)).one()
    assert decrypt_data(tenant.email_encrypted) == EMAIL


def test_migration_fills_tenant_email_on_existing_database(client):
    """Base créée avant cette version : tenants sans colonne email_encrypted."""
    register(client)
    with SessionLocal() as db:
        user_email = db.scalars(select(User)).one().email_encrypted
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE tenants DROP COLUMN email_encrypted"))
        connection.execute(text("ALTER TABLE users DROP COLUMN password_changed_at"))
        connection.execute(text("DROP TABLE password_reset_tokens"))

    from app.migrate_v2 import migrate

    migrate()
    migrate()  # relançable

    with SessionLocal() as db:
        tenant = db.scalars(select(Tenant)).one()
    assert decrypt_data(tenant.email_encrypted) == EMAIL
    assert tenant.email_encrypted != user_email
    assert login(client).json()["user"]["tenant"]["email"] == EMAIL

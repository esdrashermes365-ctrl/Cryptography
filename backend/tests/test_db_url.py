from app.db import _sqlalchemy_database_url


def test_neon_postgresql_url_uses_psycopg_driver():
    assert (
        _sqlalchemy_database_url("postgresql://user:pass@host/db?sslmode=require")
        == "postgresql+psycopg://user:pass@host/db?sslmode=require"
    )


def test_legacy_postgres_url_uses_psycopg_driver():
    assert (
        _sqlalchemy_database_url("postgres://user:pass@host/db")
        == "postgresql+psycopg://user:pass@host/db"
    )


def test_explicit_sqlalchemy_driver_is_preserved():
    url = "postgresql+psycopg://user:pass@host/db"
    assert _sqlalchemy_database_url(url) == url

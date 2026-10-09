"""Ajoute la table du journal d'audit à une base existante.

    python -m app.migrate_audit_logs
"""
from app.models import AuditEvent  # noqa: F401 (enregistre le modèle dans Base.metadata)
from app.db import engine


def migrate() -> None:
    AuditEvent.__table__.create(bind=engine, checkfirst=True)
    print("Table audit_events prête.")


if __name__ == "__main__":
    migrate()

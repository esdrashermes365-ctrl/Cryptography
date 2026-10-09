"""Migration d'une base existante vers la version avec mot de passe oublié et e-mail du tenant.

    python -m app.migrate_v2

Ce que fait le script (relançable sans risque) :
  1. crée la table password_reset_tokens ;
  2. ajoute users.password_changed_at ;
  3. ajoute tenants.email_encrypted, la remplit avec l'e-mail du compte re-chiffré
     (nonce neuf : la valeur diffère de celle de users.email_encrypted), puis la rend obligatoire.

Sauvegardez la base avant de le lancer.
"""
from sqlalchemy import inspect, text

from app import models  # noqa: F401  (enregistre les tables dans Base.metadata)
from app.crypto import decrypt_data, encrypt_data
from app.db import Base, engine


def migrate() -> None:
    tables = set(inspect(engine).get_table_names())
    if not {"users", "tenants"} <= tables:
        raise RuntimeError("Les tables users et tenants sont absentes. Lancez d'abord create_tables.")

    Base.metadata.create_all(bind=engine)  # ne crée que ce qui manque (password_reset_tokens)

    with engine.begin() as connection:
        user_columns = {c["name"] for c in inspect(connection).get_columns("users")}
        if "password_changed_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL"))

        tenant_columns = {c["name"] for c in inspect(connection).get_columns("tenants")}
        if "email_encrypted" not in tenant_columns:
            connection.execute(text("ALTER TABLE tenants ADD COLUMN email_encrypted TEXT NULL"))

        rows = connection.execute(
            text(
                "SELECT t.id AS tenant_id, u.id AS user_id, u.email_encrypted AS user_email "
                "FROM tenants t JOIN users u ON u.id = t.user_id "
                "WHERE t.email_encrypted IS NULL"
            )
        ).mappings().all()
        for row in rows:
            try:
                email = decrypt_data(row["user_email"])
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(
                    f"L'e-mail de l'utilisateur {row['user_id']} est illisible avec "
                    "ENCRYPTION_SECRET_KEY. Vérifiez que la clé est celle utilisée à l'inscription."
                ) from exc
            connection.execute(
                text("UPDATE tenants SET email_encrypted = :value WHERE id = :tenant_id"),
                {"value": encrypt_data(email), "tenant_id": row["tenant_id"]},
            )

        missing = connection.execute(
            text("SELECT COUNT(*) FROM tenants WHERE email_encrypted IS NULL")
        ).scalar_one()
        if missing:
            raise RuntimeError(f"{missing} tenant(s) sans e-mail : migration annulée.")

        if connection.dialect.name == "mysql":
            connection.execute(text("ALTER TABLE tenants MODIFY COLUMN email_encrypted TEXT NOT NULL"))

    print(f"Migration terminée ({len(rows)} tenant(s) mis à jour).")


if __name__ == "__main__":
    migrate()

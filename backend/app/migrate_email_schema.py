from sqlalchemy import inspect, text

from app.crypto import email_index, encrypt_data
from app.db import engine


def migrate_email_schema():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        raise RuntimeError("La table users est absente. Créez d'abord les tables.")

    columns = {column["name"]: column for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "email_encrypted" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN email_encrypted TEXT NULL")
            )
        if "email_hash" not in columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN email_hash VARCHAR(64) NULL")
            )

        columns = {
            column["name"]: column
            for column in inspect(connection).get_columns("users")
        }
        if "email" in columns:
            rows = connection.execute(
                text(
                    "SELECT id, email, email_encrypted, email_hash "
                    "FROM users ORDER BY id"
                )
            ).mappings().all()

            for row in rows:
                if row["email_encrypted"] and row["email_hash"]:
                    continue
                if not row["email"]:
                    raise RuntimeError(
                        f"Impossible de migrer l'email de l'utilisateur {row['id']}."
                    )

                email = row["email"].strip().lower()
                connection.execute(
                    text(
                        "UPDATE users SET email_encrypted = :encrypted, "
                        "email_hash = :email_hash WHERE id = :user_id"
                    ),
                    {
                        "encrypted": encrypt_data(email),
                        "email_hash": email_index(email),
                        "user_id": row["id"],
                    },
                )

        missing_values = connection.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE email_encrypted IS NULL OR email_hash IS NULL"
            )
        ).scalar_one()
        if missing_values:
            raise RuntimeError(
                "Des utilisateurs n'ont pas pu être migrés: email chiffré/hash absent."
            )

        duplicates = connection.execute(
            text(
                "SELECT email_hash FROM users GROUP BY email_hash "
                "HAVING COUNT(*) > 1 LIMIT 1"
            )
        ).first()
        if duplicates:
            raise RuntimeError(
                "Plusieurs comptes ont le même email normalisé; "
                "corrigez les doublons avant la migration."
            )

        indexes = inspect(connection).get_indexes("users")
        unique_hash_index_exists = any(
            index["unique"] and index["column_names"] == ["email_hash"]
            for index in indexes
        )
        if not unique_hash_index_exists:
            connection.execute(
                text("CREATE UNIQUE INDEX ix_users_email_hash ON users (email_hash)")
            )

        if connection.dialect.name == "mysql":
            connection.execute(
                text(
                    "ALTER TABLE users MODIFY COLUMN email_encrypted TEXT NOT NULL, "
                    "MODIFY COLUMN email_hash VARCHAR(64) NOT NULL"
                )
            )
            if "email" in columns:
                connection.execute(text("UPDATE users SET email = NULL"))
                connection.execute(
                    text("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL")
                )
        elif connection.dialect.name == "postgresql":
            connection.execute(
                text(
                    "ALTER TABLE users ALTER COLUMN email_encrypted SET NOT NULL"
                )
            )
            connection.execute(
                text("ALTER TABLE users ALTER COLUMN email_hash SET NOT NULL")
            )
            if "email" in columns:
                connection.execute(
                    text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL")
                )
                connection.execute(text("UPDATE users SET email = NULL"))
        else:
            raise RuntimeError(
                f"Migration non prise en charge pour {connection.dialect.name}."
            )

    print("Migration des emails terminée.")


if __name__ == "__main__":
    migrate_email_schema()

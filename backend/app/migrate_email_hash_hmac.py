"""Recalcule users.email_hash en HMAC-SHA256 (clé EMAIL_HASH_KEY).

Les anciens comptes ont un SHA-256 simple. À lancer une fois, après avoir ajouté
EMAIL_HASH_KEY et JWT_SECRET_KEY au .env, depuis le dossier backend :

    python -m app.migrate_email_hash_hmac
"""
from sqlalchemy import select

from app.crypto import decrypt_data, email_index
from app.db import SessionLocal
from app.models import User


def migrate() -> None:
    updated = unchanged = 0
    with SessionLocal() as db:
        for user in db.scalars(select(User)):
            new_hash = email_index(decrypt_data(user.email_encrypted))
            if user.email_hash == new_hash:
                unchanged += 1
                continue
            user.email_hash = new_hash
            updated += 1
        db.commit()
    print(f"{updated} compte(s) mis à jour, {unchanged} déjà à jour.")


if __name__ == "__main__":
    migrate()

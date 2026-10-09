from app import models  # noqa: F401
from app.db import Base, engine


def create_all_tables():
    print("Création des tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables users, tenants, password_reset_tokens et audit_events prêtes.")


if __name__ == "__main__":
    create_all_tables()

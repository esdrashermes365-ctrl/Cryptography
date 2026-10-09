"""Compatibilité avec l'ancienne commande de préparation de la base."""
from app.create_tables import create_all_tables


if __name__ == "__main__":
    create_all_tables()

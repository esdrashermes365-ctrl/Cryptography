import os
import mysql.connector
from dotenv import load_dotenv

# Charger les variables du fichier .env
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crypto_db")

def create_database():
    try:
        # 1. Connexion au serveur MySQL (sans spécifier de BDD)
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()

        # 2. Création de la base de données si elle n'existe pas
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        print(f"✅ Base de données '{DB_NAME}' prête !")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"❌ Erreur lors de la création de la base de données : {e}")

if __name__ == "__main__":
    create_database()
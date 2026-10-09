"""Configuration centralisée. Tout vient de l'environnement (.env en local).

Le serveur refuse de démarrer si une clé manque, est mal formée, ou si deux
clés sont identiques : une clé = un usage.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"{name} manquant dans le fichier .env")
    return value


def _hex_key(name: str) -> bytes:
    raw = _required(name)
    try:
        key = bytes.fromhex(raw)
    except ValueError as exc:
        raise ValueError(f"{name} doit être une chaîne hexadécimale") from exc
    if len(key) != 32:
        raise ValueError(f"{name} doit faire 32 octets (64 caractères hexadécimaux)")
    return key


def _int(name: str, default: int, minimum: int = 1) -> int:
    value = int(os.getenv(name, default))
    if value < minimum:
        raise ValueError(f"{name} doit être supérieur ou égal à {minimum}")
    return value


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "oui"}


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PROD = APP_ENV == "production"

DATABASE_URL = _required("DATABASE_URL")

# Trois clés distinctes, trois usages distincts.
ENCRYPTION_KEY = _hex_key("ENCRYPTION_SECRET_KEY")  # AES-256-GCM des données en base
JWT_KEY = _hex_key("JWT_SECRET_KEY")                # signature des jetons de session
EMAIL_HASH_KEY = _hex_key("EMAIL_HASH_KEY")         # HMAC de l'index de recherche e-mail
if len({ENCRYPTION_KEY, JWT_KEY, EMAIL_HASH_KEY}) != 3:
    raise ValueError(
        "ENCRYPTION_SECRET_KEY, JWT_SECRET_KEY et EMAIL_HASH_KEY doivent être différentes"
    )

# CORS : liste d'origines séparées par des virgules, jamais "*" avec les cookies.
CORS_ORIGINS = _list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
if "*" in CORS_ORIGINS:
    raise ValueError("CORS_ORIGINS ne peut pas contenir '*' (cookies de session)")

# Session
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session")
SESSION_LIFETIME_MINUTES = _int("SESSION_LIFETIME_MINUTES", 60)
COOKIE_SECURE = _bool("COOKIE_SECURE", IS_PROD)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise ValueError("COOKIE_SAMESITE doit valoir lax, strict ou none")
if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
    raise ValueError("COOKIE_SAMESITE=none exige COOKIE_SECURE=true")
FORCE_HTTPS = _bool("FORCE_HTTPS", IS_PROD)

# Mots de passe
PASSWORD_MIN_LENGTH = _int("PASSWORD_MIN_LENGTH", 12, minimum=8)
PASSWORD_MAX_LENGTH = _int("PASSWORD_MAX_LENGTH", 128)
ARGON2_TIME_COST = _int("ARGON2_TIME_COST", 3)
ARGON2_MEMORY_KIB = _int("ARGON2_MEMORY_KIB", 65536)
ARGON2_PARALLELISM = _int("ARGON2_PARALLELISM", 4)

# Limitation des tentatives
LOGIN_WINDOW_SECONDS = _int("LOGIN_WINDOW_SECONDS", 900)
LOGIN_MAX_PER_ACCOUNT_IP = _int("LOGIN_MAX_PER_ACCOUNT_IP", 5)
LOGIN_MAX_PER_ACCOUNT = _int("LOGIN_MAX_PER_ACCOUNT", 20)
LOGIN_MAX_PER_IP = _int("LOGIN_MAX_PER_IP", 40)
REGISTER_MAX_PER_IP = _int("REGISTER_MAX_PER_IP", 10)
REGISTER_WINDOW_SECONDS = _int("REGISTER_WINDOW_SECONDS", 3600)

# Mot de passe oublié
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
RESET_TOKEN_MINUTES = _int("RESET_TOKEN_MINUTES", 30)
FORGOT_WINDOW_SECONDS = _int("FORGOT_WINDOW_SECONDS", 3600)
FORGOT_MAX_PER_IP = _int("FORGOT_MAX_PER_IP", 10)
FORGOT_MAX_PER_EMAIL = _int("FORGOT_MAX_PER_EMAIL", 3)
RESET_MAX_PER_IP = _int("RESET_MAX_PER_IP", 10)

# Envoi des e-mails (SMTP). Sans SMTP_HOST, le lien est écrit dans les logs du
# serveur : pratique en développement, refusé en production.
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = _int("SMTP_PORT", 587)
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@localhost").strip()
SMTP_SSL = _bool("SMTP_SSL", False)           # True : port 465 (SSL direct)
SMTP_STARTTLS = _bool("SMTP_STARTTLS", True)  # False seulement pour un serveur local de test
if IS_PROD and not SMTP_HOST:
    raise ValueError("SMTP_HOST manquant : le mot de passe oublié exige un serveur SMTP en production")

# Limites des opérations cryptographiques
MAX_TEXT_CHARS = _int("MAX_TEXT_CHARS", 1_000_000)
MAX_UPLOAD_BYTES = _int("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
CRYPTO_MAX_PER_USER = _int("CRYPTO_MAX_PER_USER", 60)
CRYPTO_WINDOW_SECONDS = _int("CRYPTO_WINDOW_SECONDS", 60)

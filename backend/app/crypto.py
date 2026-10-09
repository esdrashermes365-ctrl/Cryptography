import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import ENCRYPTION_KEY, EMAIL_HASH_KEY

# Conservé pour compatibilité : ne plus utiliser pour autre chose que le chiffrement AES.
KEY = ENCRYPTION_KEY


def encrypt_data(plain_text: str) -> str:
    """Chiffre un texte avec AES-256-GCM (nonce aléatoire de 96 bits en préfixe)."""
    nonce = os.urandom(12)
    ciphertext = AESGCM(ENCRYPTION_KEY).encrypt(nonce, plain_text.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_data(cipher_text_b64: str) -> str:
    """Déchiffre une valeur lue en base de données."""
    payload = base64.b64decode(cipher_text_b64)
    nonce, ciphertext = payload[:12], payload[12:]
    return AESGCM(ENCRYPTION_KEY).decrypt(nonce, ciphertext, None).decode("utf-8")


def normalize_email(email: str) -> str:
    return str(email).strip().lower()


def email_index(email: str) -> str:
    """Empreinte HMAC-SHA256 de l'e-mail, pour retrouver un compte sans le lire.

    Sans EMAIL_HASH_KEY, impossible de tester des adresses connues contre la base.
    """
    return hmac.new(
        EMAIL_HASH_KEY, normalize_email(email).encode("utf-8"), hashlib.sha256
    ).hexdigest()

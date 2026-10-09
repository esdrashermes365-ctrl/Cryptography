"""Hachage et vérification d'empreintes : Argon2id, bcrypt, SHA-256, SHA-512."""
import hashlib
import hmac

import bcrypt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

from app import config

HASH_ALGORITHMS = ("Argon2id", "Bcrypt", "SHA-256", "SHA-512")

_argon2 = PasswordHasher(
    time_cost=config.ARGON2_TIME_COST,
    memory_cost=config.ARGON2_MEMORY_KIB,
    parallelism=config.ARGON2_PARALLELISM,
    type=Type.ID,
)

# bcrypt ignore tout après 72 octets et refuse l'octet nul. On passe donc par une
# empreinte SHA-256 de longueur fixe : aucune troncature silencieuse.
BCRYPT_SHA256_PREFIX = "bcrypt-sha256$v1$"
_BCRYPT_DOMAIN = b"cryptography/hash-service/bcrypt-sha256/v1\x00"


def _bcrypt_input(payload: bytes) -> bytes:
    return hashlib.sha256(_BCRYPT_DOMAIN + payload).digest()


def _check_algorithm(algorithm: str) -> None:
    if algorithm not in HASH_ALGORITHMS:
        raise ValueError(f"Algorithme de hachage non supporté : {algorithm}")


def hash_payload(payload: str, algorithm: str) -> dict:
    if not isinstance(payload, str) or not payload:
        raise ValueError("La donnée à hacher ne peut pas être vide.")
    _check_algorithm(algorithm)
    data = payload.encode("utf-8")

    if algorithm == "Argon2id":
        digest = _argon2.hash(payload)
    elif algorithm == "Bcrypt":
        salt = bcrypt.gensalt(rounds=12)
        digest = BCRYPT_SHA256_PREFIX + bcrypt.hashpw(_bcrypt_input(data), salt).decode("ascii")
    elif algorithm == "SHA-256":
        digest = hashlib.sha256(data).hexdigest()
    else:
        digest = hashlib.sha512(data).hexdigest()
    return {"hash": digest, "algorithm": algorithm}


def verify_payload(payload: str, hash_value: str, algorithm: str) -> bool:
    if not isinstance(payload, str) or not payload:
        raise ValueError("La donnée source ne peut pas être vide.")
    if not isinstance(hash_value, str) or not hash_value.strip():
        raise ValueError("L'empreinte à vérifier ne peut pas être vide.")
    _check_algorithm(algorithm)
    hash_value = hash_value.strip()
    data = payload.encode("utf-8")

    if algorithm == "Argon2id":
        try:
            return _argon2.verify(hash_value, payload)
        except (InvalidHashError, VerificationError):
            return False

    if algorithm == "Bcrypt":
        try:
            if hash_value.startswith(BCRYPT_SHA256_PREFIX):
                stored = hash_value[len(BCRYPT_SHA256_PREFIX):].encode("ascii")
                candidate = _bcrypt_input(data)
            else:
                # Empreinte bcrypt standard produite ailleurs ($2a$, $2b$, $2y$).
                if len(data) > 72 or b"\x00" in data:
                    return False
                stored = hash_value.encode("ascii")
                candidate = data
            return bcrypt.checkpw(candidate, stored)
        except (UnicodeEncodeError, ValueError):
            return False

    expected = (hashlib.sha256 if algorithm == "SHA-256" else hashlib.sha512)(data).hexdigest()
    return hmac.compare_digest(expected, hash_value.lower())

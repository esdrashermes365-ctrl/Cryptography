import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import config
from app.db import get_db
from app.models import User

# ---------------------------------------------------------------- mots de passe

password_hasher = PasswordHasher(
    time_cost=config.ARGON2_TIME_COST,
    memory_cost=config.ARGON2_MEMORY_KIB,
    parallelism=config.ARGON2_PARALLELISM,
    type=Type.ID,
)

# Hachage factice : sert à dépenser le même temps quand l'e-mail n'existe pas,
# pour qu'on ne puisse pas deviner les comptes en mesurant la réponse.
_DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(32))

_COMMON_PASSWORDS = {
    "password", "motdepasse", "azerty", "qwerty", "123456", "12345678",
    "123456789", "1234567890", "azertyuiop", "azerty123", "password123",
    "motdepasse123", "iloveyou", "admin", "administrateur", "bienvenue",
}


def validate_password(password: str, *, email: str = "", full_name: str = "") -> None:
    """Politique centrée sur la longueur. Lève ValueError avec un message lisible."""
    if len(password) < config.PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Le mot de passe doit contenir au moins {config.PASSWORD_MIN_LENGTH} caractères"
        )
    if len(password) > config.PASSWORD_MAX_LENGTH:
        raise ValueError(
            f"Le mot de passe ne doit pas dépasser {config.PASSWORD_MAX_LENGTH} caractères"
        )
    lowered = password.lower()
    stripped = lowered.strip("0123456789!?.-_ ")
    if lowered in _COMMON_PASSWORDS or stripped in _COMMON_PASSWORDS:
        raise ValueError("Ce mot de passe est trop courant")
    if len(set(password)) < 5:
        raise ValueError("Ce mot de passe est trop répétitif")
    if email and lowered in {email.lower(), email.lower().split("@")[0]}:
        raise ValueError("Le mot de passe ne doit pas être votre adresse e-mail")
    if full_name and lowered == full_name.strip().lower():
        raise ValueError("Le mot de passe ne doit pas être votre nom")


def verify_password(stored_hash: str | None, password: str) -> bool:
    """Vérifie en temps comparable que le compte existe ou non."""
    try:
        password_hasher.verify(stored_hash or _DUMMY_HASH, password)
        return stored_hash is not None
    except (VerificationError, InvalidHashError):
        return False


# ---------------------------------------------------------- limitation de débit


class RateLimiter:
    """Fenêtre glissante en mémoire.

    Suffisant pour un seul processus. Avec plusieurs workers ou serveurs,
    remplacer par un stockage partagé (Redis).
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _purge(self, key: str, window: int, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()
        return hits

    def retry_after(self, key: str, limit: int, window: int) -> int:
        """0 si l'action est permise, sinon le nombre de secondes à attendre."""
        now = time.monotonic()
        with self._lock:
            hits = self._purge(key, window, now)
            if len(hits) < limit:
                return 0
            return max(1, int(window - (now - hits[0])) + 1)

    def hit(self, key: str, window: int) -> None:
        now = time.monotonic()
        with self._lock:
            self._purge(key, window, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Derrière un proxy, lancer uvicorn avec --proxy-headers et --forwarded-allow-ips.
    return request.client.host if request.client else "inconnue"


def too_many_requests(seconds: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Trop de tentatives. Réessayez plus tard.",
        headers={"Retry-After": str(seconds)},
    )


# --------------------------------------------------------------------- session


def create_session_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=config.SESSION_LIFETIME_MINUTES),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, config.JWT_KEY, algorithm="HS256")


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=config.SESSION_LIFETIME_MINUTES * 60,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(
        key=config.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Vérifie la session côté serveur. À mettre sur toute route protégée."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide ou expirée"
    )
    token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(
            token,
            config.JWT_KEY,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    # Un changement de mot de passe coupe toutes les sessions émises avant lui.
    if user.password_changed_at is not None:
        changed = user.password_changed_at
        if changed.tzinfo is None:  # SQLite rend des dates sans fuseau
            changed = changed.replace(tzinfo=timezone.utc)
        issued_at = payload.get("iat")
        if issued_at is None or issued_at < int(changed.timestamp()):
            raise unauthorized
    return user


def enforce_user_rate_limit(user: User = Depends(get_current_user)) -> User:
    """Dépendance des routes cryptographiques : plafond d'opérations par compte.

    Argon2, bcrypt et la génération de clés RSA coûtent cher en CPU.
    """
    key = f"crypto-user:{user.id}"
    wait = limiter.retry_after(
        key, config.CRYPTO_MAX_PER_USER, config.CRYPTO_WINDOW_SECONDS
    )
    if wait:
        raise too_many_requests(wait)
    limiter.hit(key, config.CRYPTO_WINDOW_SECONDS)
    return user

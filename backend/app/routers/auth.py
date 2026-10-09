import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.crypto import decrypt_data, email_index, encrypt_data, normalize_email
from app.db import get_db
from app.mailer import send_reset_email
from app.models import PasswordResetToken, Tenant, User
from app.security import (
    clear_session_cookie,
    client_ip,
    create_session_token,
    get_current_user,
    limiter,
    password_hasher,
    set_session_cookie,
    too_many_requests,
    validate_password,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])

FORGOT_MESSAGE = (
    "Si un compte correspond à cette adresse, un e-mail contenant un lien de "
    "réinitialisation vient d'être envoyé."
)
INVALID_RESET_LINK = "Ce lien de réinitialisation est invalide ou a expiré."


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str = Field(alias="fullName", min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)
    confirm_password: str = Field(alias="confirmPassword", min_length=1, max_length=1024)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=1024)
    confirm_password: str = Field(alias="confirmPassword", min_length=1, max_length=1024)


def user_payload(user: User, tenant: Tenant) -> dict:
    """Réponse limitée aux champs utiles à l'interface. Rien n'est stocké en clair."""
    return {
        "fullName": user.full_name,
        "email": decrypt_data(user.email_encrypted),
        "tenant": {
            "id": tenant.id,
            "name": decrypt_data(tenant.encrypted_secret),
            "email": decrypt_data(tenant.email_encrypted),
            "createdAt": tenant.created_at.isoformat() if tenant.created_at else None,
        },
    }


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _token_hash(token: str) -> str:
    # Le jeton a 256 bits d'entropie : un SHA-256 simple suffit, pas besoin d'Argon2.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ------------------------------------------------------------------ inscription


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    ip_key = f"register-ip:{client_ip(request)}"
    wait = limiter.retry_after(
        ip_key, config.REGISTER_MAX_PER_IP, config.REGISTER_WINDOW_SECONDS
    )
    if wait:
        raise too_many_requests(wait)
    limiter.hit(ip_key, config.REGISTER_WINDOW_SECONDS)

    full_name = data.full_name.strip()
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom complet est requis",
        )
    if data.password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les mots de passe ne correspondent pas",
        )

    email = normalize_email(data.email)
    try:
        validate_password(data.password, email=email, full_name=full_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    email_hash = email_index(email)
    if db.query(User).filter(User.email_hash == email_hash).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet email est déjà utilisé",
        )

    tenant_name = f"Tenant {full_name}"
    user = User(
        full_name=full_name,
        email_encrypted=encrypt_data(email),
        email_hash=email_hash,
        password_hash=password_hasher.hash(data.password),
    )
    db.add(user)

    try:
        db.flush()
        db.add(
            Tenant(
                id=f"tnt_{secrets.token_hex(8)}",
                user_id=user.id,
                tenant_name=tenant_name,
                encrypted_secret=encrypt_data(tenant_name),
                # Nonce différent de celui de users.email_encrypted : deux valeurs distinctes en base.
                email_encrypted=encrypt_data(email),
            )
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if db.query(User).filter(User.email_hash == email_hash).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cet email est déjà utilisé",
            ) from exc
        raise

    return {"message": "Compte créé avec succès. Vous pouvez vous connecter."}


# -------------------------------------------------------------------- connexion


@router.post("/login")
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email = normalize_email(data.email)
    email_hash = email_index(email)
    ip = client_ip(request)

    window = config.LOGIN_WINDOW_SECONDS
    pair_key = f"login-pair:{ip}:{email_hash}"
    account_key = f"login-account:{email_hash}"
    ip_key = f"login-ip:{ip}"
    wait = max(
        limiter.retry_after(pair_key, config.LOGIN_MAX_PER_ACCOUNT_IP, window),
        limiter.retry_after(account_key, config.LOGIN_MAX_PER_ACCOUNT, window),
        limiter.retry_after(ip_key, config.LOGIN_MAX_PER_IP, window),
    )
    if wait:
        raise too_many_requests(wait)

    user = db.query(User).filter(User.email_hash == email_hash).first()
    # Même travail que le compte existe ou non : pas de différence de durée.
    if not verify_password(user.password_hash if user else None, data.password):
        for key in (pair_key, account_key, ip_key):
            limiter.hit(key, window)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )
    limiter.reset(pair_key)

    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = password_hasher.hash(data.password)
        db.commit()

    tenant = db.query(Tenant).filter(Tenant.user_id == user.id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Le tenant du compte est introuvable",
        )

    set_session_cookie(response, create_session_token(user.id))
    return {"user": user_payload(user, tenant)}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.user_id == user.id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Le tenant du compte est introuvable",
        )
    return {"user": user_payload(user, tenant)}


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"message": "Déconnecté"}


# ------------------------------------------------------------ mot de passe oublié


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Répond toujours pareil, que le compte existe ou non (pas d'énumération de comptes)."""
    email = normalize_email(data.email)
    email_hash = email_index(email)
    window = config.FORGOT_WINDOW_SECONDS
    ip_key = f"forgot-ip:{client_ip(request)}"
    email_key = f"forgot-email:{email_hash}"
    wait = max(
        limiter.retry_after(ip_key, config.FORGOT_MAX_PER_IP, window),
        limiter.retry_after(email_key, config.FORGOT_MAX_PER_EMAIL, window),
    )
    if wait:
        raise too_many_requests(wait)
    limiter.hit(ip_key, window)
    limiter.hit(email_key, window)

    user = db.query(User).filter(User.email_hash == email_hash).first()
    if user:
        now = _now()
        # Un seul lien actif par compte : un nouveau remplace les précédents.
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
        db.query(PasswordResetToken).filter(PasswordResetToken.expires_at < now).delete()
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_token_hash(token),
                expires_at=now + timedelta(minutes=config.RESET_TOKEN_MINUTES),
            )
        )
        db.commit()
        # Le jeton est dans le fragment (#) : il n'est ni envoyé au serveur web ni dans les logs d'accès.
        link = f"{config.FRONTEND_URL}/reset-password#token={token}"
        background.add_task(send_reset_email, decrypt_data(user.email_encrypted), link)

    return {"message": FORGOT_MESSAGE}


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    ip_key = f"reset-ip:{client_ip(request)}"
    wait = limiter.retry_after(ip_key, config.RESET_MAX_PER_IP, config.FORGOT_WINDOW_SECONDS)
    if wait:
        raise too_many_requests(wait)
    limiter.hit(ip_key, config.FORGOT_WINDOW_SECONDS)

    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_RESET_LINK)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _token_hash(data.token))
        .first()
    )
    if record is None or record.used_at is not None or _aware(record.expires_at) < _now():
        raise invalid
    user = db.get(User, record.user_id)
    if user is None:
        raise invalid

    # Vérifications du mot de passe avant de consommer le lien : une faute de saisie ne le brûle pas.
    if data.password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les mots de passe ne correspondent pas",
        )
    email = decrypt_data(user.email_encrypted)
    try:
        validate_password(data.password, email=email, full_name=user.full_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    now = _now()
    user.password_hash = password_hasher.hash(data.password)
    user.password_changed_at = now  # coupe les sessions ouvertes avant ce changement
    record.used_at = now
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.id != record.id
    ).delete()
    db.commit()

    # Le compte a pu être bloqué par trop d'essais : la personne vient de prouver qu'elle contrôle l'e-mail.
    email_hash = user.email_hash
    limiter.reset(f"login-account:{email_hash}")
    limiter.reset(f"login-pair:{client_ip(request)}:{email_hash}")

    return {"message": "Mot de passe modifié. Vous pouvez vous connecter."}

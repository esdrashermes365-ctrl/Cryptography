from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base


# Table Utilisateur (e-mail chiffré)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)

    # E-mail chiffré en AES-256-GCM
    email_encrypted = Column(Text, nullable=False)

    # HMAC-SHA256 (clé EMAIL_HASH_KEY) de l'e-mail : recherche et unicité sans lire l'adresse
    email_hash = Column(String(64), unique=True, nullable=False, index=True)

    # Mot de passe haché avec Argon2id
    password_hash = Column(String(255), nullable=False)

    # Date du dernier changement de mot de passe : les sessions émises avant sont refusées
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Table Tenant
class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(50), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    tenant_name = Column(String(255), nullable=False)
    encrypted_secret = Column(Text, nullable=False)  # Données chiffrées en AES-256-GCM
    # E-mail du tenant, chiffré en AES-256-GCM (jamais en clair en base)
    email_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Jetons de réinitialisation du mot de passe : seule l'empreinte SHA-256 est stockée
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(32), nullable=False)
    algorithm = Column(String(32), nullable=False)
    success = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

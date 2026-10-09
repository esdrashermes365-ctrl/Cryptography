from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import config
from app.audit import record_audit_event
from app.crypto_service import decrypt_payload, encrypt_payload
from app.db import get_db
from app.models import User
from app.security import enforce_user_rate_limit, get_current_user

router = APIRouter(
    prefix="/api/crypto",
    tags=["cryptography"],
    dependencies=[Depends(enforce_user_rate_limit)],
)


class EncryptRequest(BaseModel):
    payload: str = Field(min_length=1, max_length=config.MAX_TEXT_CHARS)
    algorithm: str = Field(default="AES-256-GCM", max_length=32)
    key: Optional[str] = Field(default=None, max_length=10_000)


class DecryptRequest(BaseModel):
    data: str = Field(min_length=1, max_length=config.MAX_TEXT_CHARS * 2)
    algorithm: str = Field(max_length=32)
    key: str = Field(min_length=1, max_length=10_000)
    iv: Optional[str] = Field(default=None, max_length=100)
    tag: Optional[str] = Field(default=None, max_length=100)


@router.post("/encrypt")
def encrypt_endpoint(
    req: EncryptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = encrypt_payload(req.payload, req.algorithm, req.key)
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="encrypt", algorithm=req.algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=f"Erreur de chiffrement : {exc}") from exc
    record_audit_event(
        db, user_id=user.id, action="encrypt", algorithm=req.algorithm, success=True
    )
    return result


@router.post("/decrypt")
def decrypt_endpoint(
    req: DecryptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        plain_text = decrypt_payload(req.data, req.algorithm, req.key, req.iv, req.tag)
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="decrypt", algorithm=req.algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=f"Erreur de déchiffrement : {exc}") from exc
    record_audit_event(
        db, user_id=user.id, action="decrypt", algorithm=req.algorithm, success=True
    )
    return {"plainText": plain_text}

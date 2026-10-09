from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import config
from app.audit import record_audit_event
from app.db import get_db
from app.hash_service import hash_payload, verify_payload
from app.models import User
from app.security import enforce_user_rate_limit, get_current_user

router = APIRouter(
    prefix="/api/hash",
    tags=["hashing"],
    dependencies=[Depends(enforce_user_rate_limit)],
)


class HashRequest(BaseModel):
    payload: str = Field(min_length=1, max_length=config.MAX_TEXT_CHARS)
    algorithm: str = Field(max_length=32)


class VerifyHashRequest(BaseModel):
    payload: str = Field(min_length=1, max_length=config.MAX_TEXT_CHARS)
    hash: str = Field(min_length=1, max_length=1024)
    algorithm: str = Field(max_length=32)


@router.post("/create")
def create_hash_route(
    req: HashRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = hash_payload(req.payload, req.algorithm)
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="hash", algorithm=req.algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    record_audit_event(
        db, user_id=user.id, action="hash", algorithm=req.algorithm, success=True
    )
    return result


@router.post("/verify")
def verify_hash_route(
    req: VerifyHashRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        is_valid = verify_payload(req.payload, req.hash, req.algorithm)
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="verify_hash", algorithm=req.algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    record_audit_event(
        db,
        user_id=user.id,
        action="verify_hash",
        algorithm=req.algorithm,
        success=is_valid,
    )
    return {
        "match": is_valid,
        "message": "Empreinte valide" if is_valid else "Empreinte non correspondante",
    }

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app import config
from app.audit import record_audit_event
from app.db import get_db
from app.models import User
from app.security import enforce_user_rate_limit, get_current_user
from app.signature_service import sign_file, verify_file

router = APIRouter(
    prefix="/api/signature",
    tags=["signature"],
    dependencies=[Depends(enforce_user_rate_limit)],
)

# Le formulaire multipart ajoute quelques centaines d'octets autour du fichier.
_ENVELOPE_BYTES = 64 * 1024


def _read_limited(request: Request, upload: UploadFile) -> bytes:
    """Lit le fichier en refusant ce qui dépasse la limite, sans le charger en entier avant."""
    too_big = HTTPException(
        status_code=413,
        detail=f"Fichier trop volumineux (maximum {config.MAX_UPLOAD_BYTES // (1024 * 1024)} Mo).",
    )
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > config.MAX_UPLOAD_BYTES + _ENVELOPE_BYTES:
        raise too_big
    data = upload.file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise too_big
    return data


@router.post("/sign")
def sign_route(
    request: Request,
    file: UploadFile = File(...),
    hash_algorithm: str = Form("SHA-256", max_length=16),
    key_size: int = Form(2048),
    private_key: Optional[str] = Form(None, max_length=20_000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = _read_limited(request, file)
    try:
        result = sign_file(
            data,
            hash_name=hash_algorithm,
            key_size=key_size,
            private_key_pem=private_key,
        )
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="sign", algorithm=hash_algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    record_audit_event(
        db, user_id=user.id, action="sign", algorithm=hash_algorithm, success=True
    )
    return result


@router.post("/verify")
def verify_route(
    request: Request,
    file: UploadFile = File(...),
    signature: str = Form(..., max_length=2_000),
    public_key: str = Form(..., max_length=20_000),
    hash_algorithm: str = Form("SHA-256", max_length=16),
    expected_digest: Optional[str] = Form(None, max_length=256),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = _read_limited(request, file)
    try:
        result = verify_file(
            data,
            signature_b64=signature,
            public_key_pem=public_key,
            hash_name=hash_algorithm,
            expected_digest=expected_digest,
        )
    except ValueError as exc:
        record_audit_event(
            db, user_id=user.id, action="verify_signature", algorithm=hash_algorithm, success=False
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    record_audit_event(
        db,
        user_id=user.id,
        action="verify_signature",
        algorithm=hash_algorithm,
        success=result["valid"],
    )
    return result

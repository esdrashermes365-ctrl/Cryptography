from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit_event(
    db: Session, *, user_id: int, action: str, algorithm: str, success: bool
) -> None:
    db.add(
        AuditEvent(
            user_id=user_id,
            action=action,
            algorithm=algorithm,
            success=success,
        )
    )
    db.commit()

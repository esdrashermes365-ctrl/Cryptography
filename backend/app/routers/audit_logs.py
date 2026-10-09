from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuditEvent, User
from app.security import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("")
def list_audit_events(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.user_id == user.id)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .offset(offset)
        .limit(limit + 1)
        .all()
    )
    has_more = len(events) > limit
    return {
        "items": [
            {
                "id": event.id,
                "action": event.action,
                "algorithm": event.algorithm,
                "success": event.success,
                "createdAt": event.created_at.isoformat(),
            }
            for event in events[:limit]
        ],
        "hasMore": has_more,
    }

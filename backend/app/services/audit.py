from sqlalchemy.orm import Session
from ..models import AuditLog, User

def log_action(db: Session, user: User | None, action: str, entity: str | None = None, entity_id: str | None = None, data: dict | None = None):
    db.add(AuditLog(
        school_id=user.school_id if user else None,
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        data=data,
    ))

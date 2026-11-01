from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .auth import decode_access_token
from .models import User, UserRole, School, SubscriptionStatus

bearer = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="نیاز به ورود دارید")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="توکن نامعتبر است")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="کاربر فعال نیست")
    return user

def require_roles(*roles: UserRole):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="دسترسی کافی ندارید")
        return user
    return dep

def tenant_school(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> School:
    if user.role == UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=400, detail="ادمین پلتفرم مدرسه جاری ندارد")
    school = db.get(School, user.school_id)
    if not school or not school.is_active:
        raise HTTPException(status_code=403, detail="مدرسه غیرفعال است")
    return school

def require_active_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if user.role == UserRole.PLATFORM_ADMIN:
        return user
    school = db.get(School, user.school_id)
    if not school or not school.is_active:
        raise HTTPException(status_code=403, detail="مدرسه غیرفعال است")
    now = datetime.now(timezone.utc)
    active = False
    if school.subscription_status == SubscriptionStatus.TRIAL and school.trial_ends_at and school.trial_ends_at > now:
        active = True
    if school.subscription_status == SubscriptionStatus.ACTIVE and school.subscription_ends_at and school.subscription_ends_at > now:
        active = True
    if not active:
        if user.role in (UserRole.MANAGER, UserRole.DEPUTY):
            raise HTTPException(status_code=402, detail="اشتراک مدرسه به پایان رسیده است")
        raise HTTPException(status_code=403, detail="اشتراک مدرسه فعال نیست")
    return user

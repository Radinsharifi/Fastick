from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import User,UserRole,School,SubscriptionRequest,SubscriptionStatus
from ..schemas import SubscriptionRequestIn,SubscriptionApproveIn
from ..services.audit import log_action

router=APIRouter(prefix="/subscription",tags=["subscription"])

@router.get("/status")
def status(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    if not user.school_id:return {"platform_admin":True}
    s=db.get(School,user.school_id)
    return {"status":s.subscription_status.value,"trial_ends_at":s.trial_ends_at,"subscription_ends_at":s.subscription_ends_at}

@router.post("/request")
def request_subscription(data:SubscriptionRequestIn,user:User=Depends(require_roles(UserRole.MANAGER)),db:Session=Depends(get_db)):
    row=SubscriptionRequest(school_id=user.school_id,requested_by_id=user.id,**data.model_dump());db.add(row);log_action(db,user,"subscription_requested","subscription_request");db.commit();db.refresh(row);return {"id":row.id,"status":row.status}

@router.get("/admin/schools")
def admin_schools(user:User=Depends(require_roles(UserRole.PLATFORM_ADMIN)),db:Session=Depends(get_db)):
    schools=db.scalars(select(School).order_by(School.created_at.desc())).all()
    return [{"id":s.id,"name":s.name,"code":s.code,"status":s.subscription_status.value,"trial_ends_at":s.trial_ends_at,"subscription_ends_at":s.subscription_ends_at,"is_active":s.is_active} for s in schools]

@router.get("/admin/requests")
def admin_requests(user:User=Depends(require_roles(UserRole.PLATFORM_ADMIN)),db:Session=Depends(get_db)):
    rows=db.scalars(select(SubscriptionRequest).where(SubscriptionRequest.status=="pending").order_by(SubscriptionRequest.created_at)).all()
    return [{"id":r.id,"school_id":r.school_id,"months":r.months,"amount_toman":r.amount_toman,"reference":r.reference,"note":r.note,"created_at":r.created_at} for r in rows]

@router.post("/admin/schools/{school_id}/activate")
def activate(school_id:int,data:SubscriptionApproveIn,user:User=Depends(require_roles(UserRole.PLATFORM_ADMIN)),db:Session=Depends(get_db)):
    s=db.get(School,school_id)
    if not s:raise HTTPException(404,"مدرسه پیدا نشد")
    now=datetime.now(timezone.utc)
    base=s.subscription_ends_at if s.subscription_ends_at and s.subscription_ends_at>now else now
    s.subscription_ends_at=base+timedelta(days=data.days);s.subscription_status=SubscriptionStatus.ACTIVE;s.is_active=True
    log_action(db,user,"school_subscription_activated","school",str(s.id),{"days":data.days});db.commit();return {"ok":True,"subscription_ends_at":s.subscription_ends_at}

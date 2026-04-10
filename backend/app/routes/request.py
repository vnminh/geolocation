from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DbUpsertReq, User
from app.schemas import Envelope, RequestCreateIn, RequestUpdateIn

router = APIRouter(tags=["request"])


@router.post("/request", response_model=Envelope)
def create_request(payload: RequestCreateIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    req = DbUpsertReq(
        user_id=payload.user_id,
        image_url=payload.image_url,
        cot=payload.cot,
        lat=payload.lat,
        lon=payload.lon,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return Envelope(success=True, data={"id": req.id})


@router.patch("/request/{request_id}", response_model=Envelope)
def update_request(request_id: int, payload: RequestUpdateIn, db: Session = Depends(get_db)) -> Envelope:
    req = db.query(DbUpsertReq).filter(DbUpsertReq.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    next_status = DbUpsertReq.RequestStatus(payload.status)
    req.status = next_status
    if next_status == DbUpsertReq.RequestStatus.accepted:
        if user.role != User.UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin can accept request")
        req.accepted_by = user.id
    else:
        req.accepted_by = None

    db.commit()
    db.refresh(req)
    return Envelope(success=True, data={"id": req.id})

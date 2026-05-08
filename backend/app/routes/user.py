from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import Envelope, ForgetPasswordIn, ProfilePatchIn, ResetPasswordIn, UserSigninIn, UserSignupIn
from app.services.auth import generate_temp_password, hash_password, verify_password
from app.services.mail import send_temporary_password_email

router = APIRouter(tags=["user"])


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "status": user.status.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.get("/user", response_model=Envelope)
def list_users(
    limit: int = Query(10, ge=1),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
) -> Envelope:
    offset = (page - 1) * limit
    base_query = db.query(User)
    total = base_query.count()
    total_pages = max(1, (total + limit - 1) // limit)
    rows = base_query.order_by(User.id.asc()).offset(offset).limit(limit).all()
    return Envelope(
        success=True,
        data={
            "items": [_serialize_user(row) for row in rows],
            "total": total,
            "limit": limit,
            "page": page,
            "total_pages": total_pages,
        },
    )


@router.post("/user/signup", response_model=Envelope)
def signup(payload: UserSignupIn, db: Session = Depends(get_db)) -> Envelope:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email,
        name=payload.name,
        password=hash_password(payload.password),
        role=User.UserRole(payload.role),
        status=User.UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return Envelope(success=True, data=_serialize_user(user))


@router.post("/user/signin", response_model=Envelope)
def signin(payload: UserSigninIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.status == User.UserStatus.block:
        raise HTTPException(status_code=403, detail="Account is blocked")
    return Envelope(success=True, data=_serialize_user(user))


def _reset_password_for_user(db: Session, user: User) -> User:
    temp_password = generate_temp_password(10)
    user.password = hash_password(temp_password)
    db.flush()
    send_temporary_password_email(user.email, temp_password)
    return user


@router.patch("/profile", response_model=Envelope)
def update_profile(payload: ProfilePatchIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.id == payload.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name
    if payload.role is not None:
        user.role = User.UserRole(payload.role)
    if payload.status is not None:
        user.status = User.UserStatus(payload.status)
    if payload.password is not None:
        user.password = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return Envelope(success=True, data=_serialize_user(user))


@router.post("/password", response_model=Envelope)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.id == payload.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        _reset_password_for_user(db, user)
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to reset password") from exc

    return Envelope(success=True, data=_serialize_user(user))


@router.post("/user/forget-password", response_model=Envelope)
def forget_password(payload: ForgetPasswordIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        _reset_password_for_user(db, user)
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to send temporary password") from exc

    return Envelope(success=True, data=_serialize_user(user))

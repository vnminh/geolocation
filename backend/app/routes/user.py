from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import Envelope, ProfilePatchIn, ResetPasswordIn, UserSigninIn, UserSignupIn
from app.services.auth import generate_temp_password, hash_password, verify_password

router = APIRouter(tags=["user"])


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
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return Envelope(success=True, data={"id": user.id, "name": user.name, "role": user.role.value})


@router.post("/user/signin", response_model=Envelope)
def signin(payload: UserSigninIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return Envelope(success=True, data={"id": user.id, "name": user.name, "role": user.role.value})


@router.patch("/profile", response_model=Envelope)
def update_profile(payload: ProfilePatchIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.id == payload.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name
    if payload.role is not None:
        user.role = User.UserRole(payload.role)
    if payload.password is not None:
        user.password = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return Envelope(success=True, data={"id": user.id, "name": user.name, "role": user.role.value})


@router.post("/password", response_model=Envelope)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)) -> Envelope:
    user = db.query(User).filter(User.id == payload.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = generate_temp_password()
    user.password = hash_password(temp_password)
    db.commit()
    db.refresh(user)

    # Intentionally not returning temp password to keep API surface consistent with api_note.
    return Envelope(success=True, data={"id": user.id, "name": user.name, "role": user.role.value})

import enum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "user"


    class UserRole(str, enum.Enum):
        user = "user"
        admin = "admin"

    class UserStatus(str, enum.Enum):
        active = "active"
        block = "block"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.user,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.active,
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    predictions: Mapped[list["Prediction"]] = relationship("Prediction", back_populates="user")
    accepted_requests: Mapped[list["DbUpsertReq"]] = relationship(
        "DbUpsertReq",
        back_populates="accepted_admin",
        foreign_keys="DbUpsertReq.accepted_by",
    )


class Prediction(Base):
    __tablename__ = "prediction"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    cot: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("0"))
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="predictions")
    request: Mapped["DbUpsertReq | None"] = relationship(back_populates="prediction", uselist=False)


class DbUpsertReq(Base):
    __tablename__ = "db_upsert_req"


    class RequestStatus(str, enum.Enum):
        decline = "decline"
        reviewing = "reviewing"
        accepted = "accepted"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    prediction_id: Mapped[int] = mapped_column(ForeignKey("prediction.id"), nullable=False, unique=True, index=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status"),
        default=RequestStatus.reviewing,
        nullable=False,
    )
    accepted_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_lat: Mapped[float] = mapped_column(Float, nullable=False)
    updated_lon: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_cot: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    prediction: Mapped[Prediction] = relationship(back_populates="request", foreign_keys=[prediction_id])
    accepted_admin: Mapped[User | None] = relationship(back_populates="accepted_requests", foreign_keys=[accepted_by])

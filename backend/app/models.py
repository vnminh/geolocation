import enum

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "user"


    class UserRole(str, enum.Enum):
        user = "user"
        admin = "admin"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.user,
    )

    requests: Mapped[list["DbUpsertReq"]] = relationship(
        "DbUpsertReq",
        back_populates="user",
        foreign_keys="DbUpsertReq.user_id",
    )
    accepted_requests: Mapped[list["DbUpsertReq"]] = relationship(
        "DbUpsertReq",
        back_populates="accepted_admin",
        foreign_keys="DbUpsertReq.accepted_by",
    )


class DbUpsertReq(Base):
    __tablename__ = "db_upsert_req"


    class RequestStatus(str, enum.Enum):
        decline = "decline"
        reviewing = "reviewing"
        accepted = "accepted"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    cot: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status"),
        default=RequestStatus.reviewing,
        nullable=False,
    )
    accepted_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    user: Mapped[User] = relationship(back_populates="requests", foreign_keys=[user_id])
    accepted_admin: Mapped[User | None] = relationship(back_populates="accepted_requests", foreign_keys=[accepted_by])

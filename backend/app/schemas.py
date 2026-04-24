from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class Envelope(BaseModel):
    success: bool = True
    data: dict


class PredictionAnswer(BaseModel):
    lat: float | None = None
    lon: float | None = None
    location: str | None = None
    type: str | None = None
    cot: str
    model_output: str | None = None


class PredictionData(BaseModel):
    image_url: str
    answer: PredictionAnswer
    is_deleted: bool = False
    request_id: int | None = None


class PredictionDeleteData(BaseModel):
    id: int
    is_deleted: bool


class UserSignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)
    password: str = Field(min_length=6)
    role: Literal["user", "admin"] = "user"


class UserSigninIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    role: Literal["user", "admin"]
    status: Literal["active", "block"]
    created_at: str | None = None
    updated_at: str | None = None


class ProfilePatchIn(BaseModel):
    id: int
    password: str | None = None
    name: str | None = None
    role: Literal["user", "admin"] | None = None
    status: Literal["active", "block"] | None = None

    @model_validator(mode="after")
    def validate_any_update(self) -> "ProfilePatchIn":
        if all(value is None for value in [self.password, self.name, self.role, self.status]):
            raise ValueError("At least one of password, name, role, status must be provided")
        return self


class ResetPasswordIn(BaseModel):
    id: int


class RequestCreateIn(BaseModel):
    prediction_id: int


class RequestUpdateIn(BaseModel):
    status: Literal["decline", "reviewing", "accepted"]
    user_id: int


class RequestPatchIn(BaseModel):
    id: int
    status: Literal["decline", "reviewing", "accepted"] | None = None
    user_id: int | None = None
    updated_lat: float | None = None
    updated_lon: float | None = None
    location: str | None = None
    updated_cot: str | None = None

    @model_validator(mode="after")
    def validate_patch_payload(self) -> "RequestPatchIn":
        has_update = any(
            value is not None
            for value in [
                self.status,
                self.updated_lat,
                self.updated_lon,
                self.location,
                self.updated_cot,
            ]
        )
        if not has_update:
            raise ValueError("At least one updatable field must be provided")
        if self.status is not None and self.user_id is None:
            raise ValueError("user_id is required when updating status")
        return self


class RequestAutoCorrectIn(BaseModel):
    request_id: int
    user_id: int


class RequestIdOut(BaseModel):
    id: int


class HistoryQueryIn(BaseModel):
    user_id: int

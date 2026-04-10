from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class Envelope(BaseModel):
    success: bool = True
    data: dict


class PredictionAnswer(BaseModel):
    lat: float | None = None
    lon: float | None = None
    cot: str
    model_output: str | None = None


class PredictionData(BaseModel):
    image_url: str
    answer: PredictionAnswer


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


class ProfilePatchIn(BaseModel):
    id: int
    password: str | None = None
    name: str | None = None
    role: Literal["user", "admin"] | None = None

    @model_validator(mode="after")
    def validate_any_update(self) -> "ProfilePatchIn":
        if all(value is None for value in [self.password, self.name, self.role]):
            raise ValueError("At least one of password, name, role must be provided")
        return self


class ResetPasswordIn(BaseModel):
    id: int


class RequestCreateIn(BaseModel):
    user_id: int
    image_url: str
    cot: str | None = None
    lat: float
    lon: float


class RequestUpdateIn(BaseModel):
    status: Literal["decline", "reviewing", "accepted"]
    user_id: int


class RequestIdOut(BaseModel):
    id: int

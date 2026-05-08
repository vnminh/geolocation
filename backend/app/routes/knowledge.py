from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from app.database import SessionLocal
from app.models import User
from app.schemas import Envelope, KnowledgeDeleteIn
from app.services.inference import PipelineService
from app.services.knowledge import KnowledgeIndex, KnowledgeService

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
knowledge_service = KnowledgeService(PipelineService())


def _require_admin(authorization: str | None) -> None:
    prefix = "Bearer fake-session-"
    if not authorization or not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Missing or invalid session")
    try:
        user_id = int(authorization[len(prefix):])
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Missing or invalid session") from exc

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role != User.UserRole.admin:
            raise HTTPException(status_code=403, detail="Knowledge management is admin only")


@router.post("", response_model=Envelope)
async def search_knowledge(
    image: UploadFile = File(...),
    index_name: KnowledgeIndex = Form(...),
    page: int = Form(1, ge=1),
    authorization: str | None = Header(None),
) -> Envelope:
    _require_admin(authorization)
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    suffix = Path(image.filename or "query.jpg").suffix or ".jpg"
    temp_path: Path | None = None
    try:
        content = await image.read()
        with NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        data = knowledge_service.search(temp_path, index_name, page)
        return Envelope(success=True, data=data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Knowledge search failed: {exc}") from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def _delete_knowledge_point(point_id: str, authorization: str | None) -> Envelope:
    _require_admin(authorization)
    try:
        knowledge_service.delete(point_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Knowledge delete failed: {exc}") from exc

    return Envelope(success=True, data={"id": point_id, "deleted": True})


@router.delete("", response_model=Envelope)
@router.delete("/", response_model=Envelope, include_in_schema=False)
def delete_knowledge(
    payload: KnowledgeDeleteIn,
    authorization: str | None = Header(None),
) -> Envelope:
    return _delete_knowledge_point(payload.id, authorization)


@router.delete("/{point_id}", response_model=Envelope)
def delete_knowledge_by_id(
    point_id: str,
    authorization: str | None = Header(None),
) -> Envelope:
    return _delete_knowledge_point(point_id, authorization)

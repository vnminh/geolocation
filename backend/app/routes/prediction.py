from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..schemas import Envelope, PredictionAnswer, PredictionData
from ..services.inference import PipelineService

router = APIRouter(tags=["prediction"])
pipeline = PipelineService()


@router.post("/prediction", response_model=Envelope)
async def prediction(image: UploadFile = File(...)) -> Envelope:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    ext = Path(image.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid4().hex}{ext.lower()}"
    save_path = Path(settings.upload_dir) / filename

    content = await image.read()
    save_path.write_bytes(content)

    result = pipeline.predict(save_path)
    image_url = f"{settings.public_base_url}/uploads/{filename}"

    return Envelope(
        success=True,
        data=PredictionData(
            image_url=image_url,
            answer=PredictionAnswer(
                lat=result.lat,
                lon=result.lon,
                cot=result.cot,
                model_output=result.model_output,
            ),
        ).model_dump(),
    )

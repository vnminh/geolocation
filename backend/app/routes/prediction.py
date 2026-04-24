import asyncio
import json
import re
from pathlib import Path
from uuid import uuid4

from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.config import settings
from app.database import SessionLocal
from app.models import DbUpsertReq, Prediction, User
from app.schemas import Envelope, PredictionAnswer, PredictionData, PredictionDeleteData
from app.services.inference import PipelineService

router = APIRouter(tags=["prediction"])
pipeline = PipelineService()


@router.get("/history", response_model=Envelope)
def history(
    user_id: int = Query(...),
    limit: int = Query(10, ge=1),
    page: int = Query(1, ge=1),
) -> Envelope:
    offset = (page - 1) * limit

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        base_query = db.query(Prediction).filter(
            Prediction.user_id == user_id,
            Prediction.is_deleted.is_(False),
        )
        total = base_query.count()
        total_pages = max(1, (total + limit - 1) // limit)
        rows = base_query.order_by(Prediction.id.desc()).offset(offset).limit(limit).all()

        items = [
            {
                "id": row.id,
                "user_id": row.user_id,
                "image_url": row.image_url,
                "cot": row.cot,
                "lat": row.lat,
                "lon": row.lon,
                "is_deleted": row.is_deleted,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
        return Envelope(
            success=True,
            data={
                "items": items,
                "total": total,
                "limit": limit,
                "page": page,
                "total_pages": total_pages,
            },
        )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _iter_text_tokens(text: str) -> list[str]:
    # Keep whitespace in chunks so frontend can render natural typing flow.
    return re.findall(r"\S+\s*", text)


def _save_prediction_and_request_if_needed(result, image_url: str) -> int | None:
    
    if result.lat is None or result.lon is None:
        return None

    with SessionLocal() as db:
        user = db.query(User).order_by(User.id.asc()).first()
        if not user:
            return None

        prediction = Prediction(
            user_id=user.id,
            image_url=image_url,
            cot=result.cot,
            lat=float(result.lat),
            lon=float(result.lon),
        )
        db.add(prediction)
        db.flush()

        request_id: int | None = None
        if getattr(result, "type", None) == "new_location_request":
            extracted_location = pipeline.extract_locations_from_text(prediction.cot)
            req = DbUpsertReq(
                prediction_id=int(prediction.id),
                updated_lat=float(prediction.lat),
                updated_lon=float(prediction.lon),
                updated_cot=prediction.cot,
                location=extracted_location,
            )
            db.add(req)
            db.flush()
            request_id = int(req.id)

        db.commit()
        return request_id


@router.post("/prediction", response_model=Envelope)
async def prediction(image: UploadFile = File(...)) -> Envelope:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    ext = Path(image.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid4().hex}{ext.lower()}"
    save_path = Path(settings.upload_dir) / filename

    content = await image.read()
    save_path.write_bytes(content)

    try:
        result = pipeline.predict(save_path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Inference backend error: {exc}") from exc
    image_url = f"{settings.public_base_url}/uploads/{filename}"
    request_id = await run_in_threadpool(_save_prediction_and_request_if_needed, result, image_url)

    return Envelope(
        success=True,
        data=PredictionData(
            image_url=image_url,
            answer=PredictionAnswer(
                lat=result.lat,
                lon=result.lon,
                location=result.location,
                type=result.type,
                cot=result.cot,
                model_output=result.model_output,
            ),
            is_deleted=False,
            request_id=request_id,
        ).model_dump(),
    )


@router.post("/prediction/stream")
async def prediction_stream(image: UploadFile = File(...)) -> StreamingResponse:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    ext = Path(image.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid4().hex}{ext.lower()}"
    save_path = Path(settings.upload_dir) / filename

    content = await image.read()
    save_path.write_bytes(content)
    image_url = f"{settings.public_base_url}/uploads/{filename}"

    async def event_stream():
        yield _sse("start", {"success": True, "image_url": image_url})

        retrieval_ans: dict = {}
        retrieval_context = ""
        try:
            yield _sse("stage", {"name": "retrieval", "status": "started"})
            retrieval_bundle = await run_in_threadpool(pipeline.run_retrieval_stage, save_path)
            retrieval_ans = retrieval_bundle.get("retrieval", {})
            retrieval_context = str(retrieval_bundle.get("retrieval_context", ""))

            yield _sse(
                "stage",
                {
                    "name": "retrieval",
                    "status": "completed",
                    "type": retrieval_ans.get("type") if isinstance(retrieval_ans, dict) else None,
                    "top_count": len(retrieval_ans.get("top", [])) if isinstance(retrieval_ans, dict) else 0,
                    "mean_lat": retrieval_ans.get("mean_lat") if isinstance(retrieval_ans, dict) else None,
                    "mean_lon": retrieval_ans.get("mean_lon") if isinstance(retrieval_ans, dict) else None,
                    "variance_km": retrieval_ans.get("variance_km") if isinstance(retrieval_ans, dict) else None,
                },
            )

            yield _sse("stage", {"name": "predict", "status": "started"})
            result = await run_in_threadpool(
                pipeline.run_prediction_stage,
                save_path,
                retrieval_context,
                retrieval_ans,
            )

            stream_text = result.cot or result.model_output or ""
            for token in _iter_text_tokens(stream_text):
                yield _sse(
                    "stage", 
                    {
                        "name": "predict",
                        "status": "thinking",
                        "text": token,
                    }
                )
                await asyncio.sleep(0.1)

            yield _sse(
                "stage",
                {
                    "name": "predict",
                    "status": "completed",
                    "type": result.type,
                    "lat": result.lat,
                    "lon": result.lon,
                },
            )
            request_id = await run_in_threadpool(_save_prediction_and_request_if_needed, result, image_url)
            final_payload = Envelope(
                success=True,
                data=PredictionData(
                    image_url=image_url,
                    answer=PredictionAnswer(
                        lat=result.lat,
                        lon=result.lon,
                        location=result.location,
                        type=result.type,
                        cot=result.cot,
                        model_output=result.model_output,
                    ),
                    is_deleted=False,
                    request_id=request_id,
                ).model_dump(),
            ).model_dump()

            yield _sse("final", final_payload)
            yield _sse("done", {"success": True})
        except Exception as exc:
            yield _sse("error", {"success": False, "detail": f"Inference backend error: {exc}"})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.delete("/prediction/{prediction_id}", response_model=Envelope)
def delete_prediction(prediction_id: int) -> Envelope:
    with SessionLocal() as db:
        prediction = db.query(Prediction).filter(
            Prediction.id == prediction_id,
            Prediction.is_deleted.is_(False),
        ).first()
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        prediction.is_deleted = True
        db.commit()

        return Envelope(
            success=True,
            data=PredictionDeleteData(id=prediction.id, is_deleted=prediction.is_deleted).model_dump(),
        )

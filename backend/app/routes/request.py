from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DbUpsertReq, Prediction, User
from app.schemas import Envelope, RequestAutoCorrectIn, RequestCreateIn, RequestPatchIn, RequestUpdateIn
from app.services.inference import PipelineService

router = APIRouter(tags=["request"])
pipeline = PipelineService()


def _serialize_request(row: DbUpsertReq) -> dict:
    prediction = row.prediction
    has_active_prediction = prediction is not None and not prediction.is_deleted
    return {
        "id": row.id,
        "prediction_id": row.prediction_id,
        "user_id": prediction.user_id if has_active_prediction else None,
        "image_url": prediction.image_url if has_active_prediction else None,
        "cot": prediction.cot if has_active_prediction else None,
        "updated_cot": row.updated_cot,
        "location": row.location,
        "lat": prediction.lat if has_active_prediction else None,
        "lon": prediction.lon if has_active_prediction else None,
        "is_deleted": (prediction.is_deleted if prediction is not None else None),
        "updated_lat": row.updated_lat,
        "updated_lon": row.updated_lon,
        "prediction_created_at": prediction.created_at.isoformat() if has_active_prediction and prediction.created_at else None,
        "status": row.status.value,
        "accepted_by": row.accepted_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _apply_status_update(req: DbUpsertReq, status: str, user_id: int, db: Session) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    previous_status = req.status
    next_status = DbUpsertReq.RequestStatus(status)
    req.status = next_status

    upserted = False
    if next_status == DbUpsertReq.RequestStatus.accepted:
        if user.role != User.UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin can accept request")
        if previous_status != DbUpsertReq.RequestStatus.reviewing:
            raise HTTPException(status_code=400, detail="Only reviewing request can be accepted")
        if req.prediction is None or req.prediction.is_deleted:
            raise HTTPException(status_code=404, detail="Prediction not found for this request")

        upserted = pipeline.upsert_approved_request(
            image_url=req.prediction.image_url,
            lat=float(req.updated_lat),
            lon=float(req.updated_lon),
            location=req.location,
        )
        if not upserted:
            raise HTTPException(status_code=502, detail="Accepted request could not be upserted to vector DB")
        req.accepted_by = user.id
    else:
        req.accepted_by = None

    return upserted


@router.get("/request", response_model=Envelope)
def list_requests(
    limit: int = Query(10, ge=1),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
) -> Envelope:
    offset = (page - 1) * limit
    base_query = db.query(DbUpsertReq).join(Prediction).filter(Prediction.is_deleted.is_(False))
    total = base_query.count()
    total_pages = max(1, (total + limit - 1) // limit)
    rows = base_query.order_by(DbUpsertReq.id.desc()).offset(offset).limit(limit).all()
    data = [_serialize_request(row) for row in rows]
    return Envelope(
        success=True,
        data={
            "items": data,
            "total": total,
            "limit": limit,
            "page": page,
            "total_pages": total_pages,
        },
    )


@router.post("/request", response_model=Envelope)
def create_request(payload: RequestCreateIn, db: Session = Depends(get_db)) -> Envelope:
    prediction = db.query(Prediction).filter(
        Prediction.id == payload.prediction_id,
        Prediction.is_deleted.is_(False),
    ).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    existing = db.query(DbUpsertReq).filter(DbUpsertReq.prediction_id == payload.prediction_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Request already exists for this prediction")

    req = DbUpsertReq(
        prediction_id=payload.prediction_id,
        updated_lat=float(prediction.lat),
        updated_lon=float(prediction.lon),
        location=pipeline.extract_locations_from_text(prediction.cot),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return Envelope(success=True, data=_serialize_request(req))


@router.patch("/request/{request_id}", response_model=Envelope)
def update_request(request_id: int, payload: RequestUpdateIn, db: Session = Depends(get_db)) -> Envelope:
    req = db.query(DbUpsertReq).filter(DbUpsertReq.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    upserted = _apply_status_update(req=req, status=payload.status, user_id=payload.user_id, db=db)

    db.commit()
    db.refresh(req)
    response = _serialize_request(req)
    response["upserted"] = upserted
    return Envelope(success=True, data=response)


@router.patch("/request", response_model=Envelope)
def patch_request(payload: RequestPatchIn, db: Session = Depends(get_db)) -> Envelope:
    req = db.query(DbUpsertReq).filter(DbUpsertReq.id == payload.id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    upserted = False
    if payload.status is not None:
        if payload.user_id is None:
            raise HTTPException(status_code=400, detail="user_id is required when updating status")
        upserted = _apply_status_update(req=req, status=payload.status, user_id=payload.user_id, db=db)

    if payload.updated_lat is not None:
        req.updated_lat = float(payload.updated_lat)
    if payload.updated_lon is not None:
        req.updated_lon = float(payload.updated_lon)

    if payload.updated_cot is not None:
        req.updated_cot = payload.updated_cot
        req.location = pipeline.extract_locations_from_text(payload.updated_cot)
    elif payload.location is not None:
        req.location = payload.location

    db.commit()
    db.refresh(req)
    response = _serialize_request(req)
    response["upserted"] = upserted
    return Envelope(success=True, data=response)


@router.post("/request/auto-correct/", response_model=Envelope)
def auto_correct_request(payload: RequestAutoCorrectIn, db: Session = Depends(get_db)) -> Envelope:
    req = db.query(DbUpsertReq).filter(DbUpsertReq.id == payload.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != User.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admin can auto-correct request")
    if req.prediction is None or req.prediction.is_deleted:
        raise HTTPException(status_code=404, detail="Prediction not found for this request")

    try:
        corrected = pipeline.run_gpt4o_autocorrect_for_request(req.prediction.image_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Auto-correct failed: {exc}") from exc

    if corrected.lat is None or corrected.lon is None:
        raise HTTPException(status_code=502, detail="Auto-correct did not return valid coordinates")

    req.updated_lat = float(corrected.lat)
    req.updated_lon = float(corrected.lon)

    next_updated_cot = (corrected.cot or corrected.model_output or "").strip()
    req.updated_cot = next_updated_cot or None
    if req.updated_cot is not None:
        req.location = pipeline.extract_locations_from_text(req.updated_cot)

    db.commit()
    db.refresh(req)
    response = _serialize_request(req)
    response["auto_corrected"] = True
    return Envelope(success=True, data=response)

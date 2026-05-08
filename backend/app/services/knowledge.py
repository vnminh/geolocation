from math import ceil
from pathlib import Path
from typing import Any, Literal

from PIL import Image
from qdrant_client.http import models as qdrant_models

from app.config import settings
from app.services.inference import PipelineService


KnowledgeIndex = Literal["dino_emb", "geoclip_img_emb"]
PAGE_SIZE = 10


class KnowledgeService:
    def __init__(self, pipeline: PipelineService) -> None:
        self.pipeline = pipeline

    @staticmethod
    def _image_url_from_payload(payload: dict[str, Any]) -> str | None:
        for key in ("image_url", "url", "image", "image_path", "path", "filename"):
            value = payload.get(key)
            if not isinstance(value, str) or not value.strip():
                continue

            image_ref = value.strip()
            if image_ref.startswith(("http://", "https://", "data:")):
                return image_ref

            local_path = Path(image_ref)
            if local_path.is_file():
                try:
                    relative = local_path.resolve().relative_to(Path(settings.upload_dir).resolve())
                except ValueError:
                    return None
                return f"{settings.public_base_url}/uploads/{relative.as_posix()}"

            upload_path = Path(settings.upload_dir) / local_path.name
            if upload_path.is_file():
                return f"{settings.public_base_url}/uploads/{local_path.name}"

        return None

    def search(self, image_path: Path, index_name: KnowledgeIndex, page: int) -> dict[str, Any]:
        self.pipeline._ensure_retrieval_runtime()
        if self.pipeline.qdrant_client is None:
            raise RuntimeError("Qdrant client is not initialized")

        with Image.open(image_path) as source:
            image = source.convert("RGB")
            if index_name == "dino_emb":
                query_vector = self.pipeline._dino_embed_image(image)
            else:
                query_vector = self.pipeline._geoclip_embed_image(image)

        total = int(
            self.pipeline.qdrant_client.count(
                collection_name=settings.qdrant_collection,
                exact=True,
            ).count
        )
        total_pages = max(1, ceil(total / PAGE_SIZE))
        safe_page = min(page, total_pages)

        points = self.pipeline.qdrant_client.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector.tolist(),
            using=index_name,
            limit=PAGE_SIZE,
            offset=(safe_page - 1) * PAGE_SIZE,
            timeout=300,
            with_payload=True,
            with_vectors=False,
        ).points

        items = []
        for point in points:
            payload = point.payload or {}
            items.append(
                {
                    "id": str(point.id),
                    "score": float(point.score),
                    "image_url": self._image_url_from_payload(payload),
                    "payload": payload,
                }
            )

        return {
            "items": items,
            "total": total,
            "limit": PAGE_SIZE,
            "page": safe_page,
            "total_pages": total_pages,
            "index_name": index_name,
            "collection": settings.qdrant_collection,
        }

    def delete(self, point_id: str) -> bool:
        self.pipeline._ensure_retrieval_runtime()
        if self.pipeline.qdrant_client is None:
            raise RuntimeError("Qdrant client is not initialized")

        normalized_id: str | int = int(point_id) if point_id.isdigit() else point_id
        existing = self.pipeline.qdrant_client.retrieve(
                collection_name=settings.qdrant_collection,
                ids=[normalized_id],
                with_payload=False,
                with_vectors=False,
            )
        if not existing:
            return False
        self.pipeline.qdrant_client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=qdrant_models.PointIdsList(points=[normalized_id]),
            wait=True,
        )
        return True

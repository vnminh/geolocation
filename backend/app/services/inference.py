import io
import importlib
import json
import logging
import math
import re
from base64 import b64encode
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import requests
import torch
import torch.nn.functional as F
from geoclip import GeoCLIP
from PIL import Image
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from transformers import AutoImageProcessor, AutoModel, pipeline as hf_pipeline

from app.config import settings


logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Analyze the provided image to infer both the approximate latitude/longitude and the specific neighborhood/district. Prioritize these steps:
1. Identify architectural patterns, street furniture, and unique infrastructure
2. Decode textual clues (signage/license plates) for language or local references
3. Cross-reference vegetation types with regional biomes
4. Match terrain contours to topographic maps
5. Analyze transportation modes (vehicles/tracks) for urban context
The response must include neighborhood hypothesis even with partial evidence, using format:
<think> Reasoning Process </think>
<answer> Latitude, Longitude </answer>
You must answer the question in this format, whether you have obtained the latitude and longitude through reasoning or not. If not, provide the closest possible values."""

USER_PROMPT = "Analyze the given image and infer its geographic location. Provide reasoning process and then the final answer."

GPT4O_SYSTEM_PROMPT = """Analyze the provided image to infer both the approximate latitude/longitude and the specific neighborhood/district. Prioritize these steps:
1. Identify architectural patterns, street furniture, and unique infrastructure
2. Decode textual clues (signage/license plates) for language or local references
3. Cross-reference vegetation types with regional biomes
4. Match terrain contours to topographic maps
5. Analyze transportation modes (vehicles/tracks) for urban context
The response must include neighborhood hypothesis even with partial evidence.
Return output only via the provided function tool arguments with fields:
- cot: concise reasoning
- location: city,state,country
- lat: latitude in decimal degrees
- lon: longitude in decimal degrees
Do not use XML-style tags like <think> or <answer>. If uncertain, provide the closest possible values."""

GPT4O_USER_PROMPT = "Analyze the given image and infer its geographic location. Return cot, location (city,state,country), lat, lon via tool output."



@dataclass
class PredictionResult:
    lat: float | None
    lon: float | None
    location: str | None
    type: str | None
    cot: str
    model_output: str


def build_retrieval_context_from_top(top: list[dict[str, Any]]) -> str:
    if not top:
        return ""
    lines = ["Here are visually similar reference images from a geographic database:"]
    for i, item in enumerate(top, 1):
        payload = item.get("payload", {})
        lines.append(f"\\n[Rank {i}]")
        lines.append(f"  Visual similarity: ({item.get('dino_score')})")
        lines.append(f"  Geolocation similarity: ({item.get('geoclip_score')})")
        if payload.get("location"):
            lines.append(f"  Location: {payload.get('location')}")
        lines.append(f"  Coordinates: (lat:{payload.get('lat')}, lon:{payload.get('lon')})")
    lines.append("\\nUse these references as additional context clues to help determine the location.")
    return "\n".join(lines)


def extract_coordinates(text: str) -> tuple[float | None, float | None]:
    answer_pattern = r"<answer>\s*[\"\']?([-\d.]+)[\"\']?\s*,\s*[\"\']?([-\d.]+)[\"\']?\s*</answer>"
    m = re.search(answer_pattern, text, re.IGNORECASE)
    if m:
        return float(m.group(1)), float(m.group(2))

    coord_pattern = r"([-]?\d{1,3}\.\d+)\s*,\s*([-]?\d{1,3}\.\d+)"
    m = re.search(coord_pattern, text)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None, None

def extract_cot(text: str) -> str:
    think_pattern = r"<think>\s*(.*?)\s*</think>"
    m = re.search(think_pattern, text, re.IGNORECASE | re.DOTALL)
    if not m:
        return ""
    return m.group(1).strip()

class PipelineService:
    _shared_dino_processor = None
    _shared_dino_model = None
    _shared_geoclip_model = None
    _shared_qdrant_client = None
    _shared_ner_pipeline = None

    def __init__(self) -> None:
        self.use_retrieval = settings.use_retrieval
        self.enable_real_models = settings.enable_real_models
        self.inference_backend = str(settings.inference_backend).strip().lower()

        self.device = self._resolve_device(settings.model_device)
        self.dino_processor = PipelineService._shared_dino_processor
        self.dino_model = PipelineService._shared_dino_model
        self.geoclip_model = PipelineService._shared_geoclip_model
        self.qdrant_client = PipelineService._shared_qdrant_client
        self.ner_pipeline = PipelineService._shared_ner_pipeline

    @staticmethod
    def _resolve_device(device_cfg: str | None) -> str:
        cfg = str(device_cfg or "auto").strip().lower()
        if cfg == "auto":
            return "cuda:0" if torch.cuda.is_available() else "cpu"
        if cfg in {"cpu", "cuda", "cuda:0"}:
            return cfg
        return "cpu"

    def _ensure_retrieval_runtime(self) -> None:
        if not self.use_retrieval:
            return
        if self.dino_processor is not None and self.dino_model is not None and self.geoclip_model is not None:
            return

        if (
            PipelineService._shared_dino_processor is not None
            and PipelineService._shared_dino_model is not None
            and PipelineService._shared_geoclip_model is not None
            and PipelineService._shared_qdrant_client is not None
        ):
            self.dino_processor = PipelineService._shared_dino_processor
            self.dino_model = PipelineService._shared_dino_model
            self.geoclip_model = PipelineService._shared_geoclip_model
            self.qdrant_client = PipelineService._shared_qdrant_client
            return

        model_dino = "facebook/dinov2-base"

        dino_processor = AutoImageProcessor.from_pretrained(model_dino)
        dino_model = AutoModel.from_pretrained(model_dino).to(self.device).eval()
        geoclip_model = GeoCLIP().to(self.device).eval()

        if not settings.qdrant_url:
            raise RuntimeError("QDRANT_URL is required when USE_RETRIEVAL=true")
        qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)

        PipelineService._shared_dino_processor = dino_processor
        PipelineService._shared_dino_model = dino_model
        PipelineService._shared_geoclip_model = geoclip_model
        PipelineService._shared_qdrant_client = qdrant_client

        self.dino_processor = dino_processor
        self.dino_model = dino_model
        self.geoclip_model = geoclip_model
        self.qdrant_client = qdrant_client

    @torch.inference_mode()
    def _dino_embed_image(self, img: Image.Image) -> np.ndarray:
        if self.dino_processor is None or self.dino_model is None:
            raise RuntimeError("DINO runtime is not initialized")
        inputs = self.dino_processor(images=img, return_tensors="pt").to(self.device)
        out = self.dino_model(**inputs).last_hidden_state
        cls = F.normalize(out[:, 0, :], dim=1).squeeze(0).cpu().numpy().astype(np.float32)
        return cls

    @torch.inference_mode()
    def _geoclip_embed_image(self, image: Image.Image) -> np.ndarray:
        if self.geoclip_model is None:
            raise RuntimeError("GeoCLIP runtime is not initialized")
        image = self.geoclip_model.image_encoder.preprocess_image(image)
        image = image.to(self.device)
        feats = self.geoclip_model.image_encoder.CLIP.get_image_features(pixel_values=image).pooler_output
        feats = self.geoclip_model.image_encoder.mlp(feats)
        return feats.squeeze(0).cpu().numpy().astype(np.float32)

    @torch.inference_mode()
    def _geoclip_embed_location(self, lat:float, lon:float) -> np.ndarray:
        if self.geoclip_model is None:
            raise RuntimeError("GeoCLIP runtime is not initialized")
        location = torch.Tensor([[lat, lon]])
        location = location.to(self.device)
        feats = self.geoclip_model.location_encoder(location)
        return feats.squeeze(0).cpu().numpy().astype(np.float32)
    
    @staticmethod
    def _dot(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))

    @staticmethod
    def _haversine_km(lat1, lon1, lat2, lon2):
        r = 6371.0088  # Earth's mean radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    @staticmethod
    def _mean_top_answer(cands: list[dict[str, Any]], k: int = 5) -> dict[str, Any]:
        top = cands[:k]
        if not top:
            return {"top": [], "variance_km": None}

        valid_coords = [
            (float(x["payload"]["lat"]), float(x["payload"]["lon"]))
            for x in top
            if x.get("payload") and x["payload"].get("lat") is not None and x["payload"].get("lon") is not None
        ]
        if not valid_coords:
            return {"top": top, "variance_km": None}

        lat = float(np.mean([x[0] for x in valid_coords]))
        lon = float(np.mean([x[1] for x in valid_coords]))
        distances = [PipelineService._haversine_km(lat, lon, c_lat, c_lon) for c_lat, c_lon in valid_coords]
        variance_km = float(np.mean(distances)) if distances else 0.0
        return {"mean_lat": lat, "mean_lon": lon, "top": top, "variance_km": variance_km}

    def _upsert_known_location_point(
        self,
        img_vector: np.ndarray,
        loc_vector: np.ndarray,
        dino_vector:np.ndarray,
        payload_location: str,
        infer_lat: float,
        infer_lon: float,
    ) -> bool:
        if self.qdrant_client is None:
            return False
        
        # point = qdrant_models.PointStruct(
        #     id=str(uuid4()),
        #     vector={
        #         "geoclip_img_emb": img_vector.astype(np.float32).tolist(),
        #         "geoclip_loc_emb": loc_vector.astype(np.float32).tolist(),
        #         "dino_emb": dino_vector.astype(np.float32).tolist(),
        #     },
        #     payload={
        #         "lat": float(infer_lat),
        #         "lon": float(infer_lon),
        #         "location": payload_location,
        #         "source": "auto_ingest_known_location",
        #     },
        # )
        # self.qdrant_client.upsert(collection_name=settings.qdrant_collection, points=[point], wait=False)
        return True

    def _upsert_after_inference(self, retrieval_ans: dict[str, Any], infer_result: PredictionResult) -> bool:
        if self.qdrant_client is None:
            return False
        if infer_result.lat is None or infer_result.lon is None:
            return False

        query_img_vec = retrieval_ans.get("query_img_vec")
        infer_lat = float(infer_result.lat)
        infer_lon = float(infer_result.lon)
        query_img_loc_vec = self._geoclip_embed_location(infer_lat, infer_lon)
        dino_vec = retrieval_ans.get("context_vec")
        if not isinstance(query_img_vec, np.ndarray):
            return False

        top_candidates = retrieval_ans.get("top", []) if isinstance(retrieval_ans.get("top", []), list) else []
        payload_location = "auto-known-location"
        for item in top_candidates:
            payload = item.get("payload") or {}
            loc_name = payload.get("location")
            if loc_name:
                payload_location = str(loc_name)
                break

        return self._upsert_known_location_point(
            img_vector=query_img_vec,
            loc_vector=query_img_loc_vec,
            dino_vector=dino_vec,
            payload_location=payload_location,
            infer_lat=float(infer_result.lat),
            infer_lon=float(infer_result.lon),
        )

    def _resolve_local_image_path(self, image_url: str) -> Path | None:
        image_url = str(image_url).strip()
        if not image_url:
            return None

        direct = Path(image_url)
        if direct.is_file():
            return direct

        uploads_prefix = f"{settings.public_base_url}/uploads/"
        if image_url.startswith(uploads_prefix):
            filename = image_url[len(uploads_prefix):]
            local_path = Path(settings.upload_dir) / filename
            if local_path.is_file():
                return local_path
        return None

    def _ensure_ner_runtime(self) -> None:
        if self.ner_pipeline is not None:
            return
        if PipelineService._shared_ner_pipeline is not None:
            self.ner_pipeline = PipelineService._shared_ner_pipeline
            return

        ner_device = 0 if self.device.startswith("cuda") and torch.cuda.is_available() else -1
        ner_pipeline = hf_pipeline(
            "token-classification",
            model="dslim/bert-base-NER",
            aggregation_strategy="simple",
            device=ner_device,
        )
        PipelineService._shared_ner_pipeline = ner_pipeline
        self.ner_pipeline = ner_pipeline

    @staticmethod
    def _dedupe_keep_order(values: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for value in values:
            key = value.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(value.strip())
        return ordered

    def extract_locations_from_text(self, text: str | None) -> str | None:
        content = str(text or "").strip()
        if not content:
            return None

        self._ensure_ner_runtime()
        try:
            entities = self.ner_pipeline(content[:4000])
        except Exception:
            logger.exception("NER extraction failed")
            return None

        locations: list[str] = []
        for entity in entities:
            if not isinstance(entity, dict):
                continue

            label = str(entity.get("entity_group") or entity.get("entity") or "").upper()
            if "LOC" not in label:
                continue

            token = str(entity.get("word") or "")
            token = token.replace("##", "").strip()
            token = re.sub(r"\s+", " ", token)
            if token:
                locations.append(token)

        unique_locations = self._dedupe_keep_order(locations)
        if not unique_locations:
            return None
        return ", ".join(unique_locations)

    def run_gpt4o_autocorrect_for_request(self, image_url: str) -> PredictionResult:
        image_path = self._resolve_local_image_path(image_url)
        if image_path is None:
            raise RuntimeError("Image for auto-correct request could not be resolved from image_url")

        image = Image.open(image_path).convert("RGB")
        result = self._run_gpt4o_pipeline(image)
        if not result.cot:
            result.cot = result.model_output or ""

        inferred_location = self.extract_locations_from_text(result.cot)
        if inferred_location:
            result.location = inferred_location
        return result

    def upsert_approved_request(self, image_url: str, lat: float, lon: float, location: str | None) -> bool:
        self._ensure_retrieval_runtime()
        if self.qdrant_client is None:
            return False

        image_path = self._resolve_local_image_path(image_url)
        if image_path is None:
            return False

        image = Image.open(image_path).convert("RGB")
        geoclip_img_vec = self._geoclip_embed_image(image)
        geoclip_loc_vec = self._geoclip_embed_location(float(lat), float(lon))
        dino_vec = self._dino_embed_image(image)
        payload_location = str(location).strip() if location else "approved-request"
        return self._upsert_known_location_point(
            img_vector=geoclip_img_vec,
            loc_vector=geoclip_loc_vec,
            dino_vector=dino_vec,
            payload_location=payload_location,
            infer_lat=float(lat),
            infer_lon=float(lon),
        )

    def _staged_retrieval(self, query_img: Image.Image) -> dict[str, Any]:
        self._ensure_retrieval_runtime()
        if self.qdrant_client is None:
            raise RuntimeError("Qdrant client is not initialized")

        q_geoclip_img = self._geoclip_embed_image(query_img)
        q_dino = self._dino_embed_image(query_img)

        duplicate_top = self.qdrant_client.query_points(
            collection_name=settings.qdrant_collection,
            query=q_geoclip_img.tolist(),
            using="geoclip_img_emb",
            limit=1,
            timeout=300,
            with_payload=True,
            score_threshold=0.9,
        ).points

        
        if duplicate_top:
            payload = duplicate_top[0].payload or {}
            lat = payload.get("lat")
            lon = payload.get("lon")
            top = [
                {
                    "id": duplicate_top[0].id,
                    "geoclip_score": duplicate_top[0].score,
                    "dino_score": duplicate_top[0].score,
                    "payload": payload,
                }
            ]
            return {
                "type": "duplicate_image",
                "top": top,
                "mean_lat": float(lat) if lat is not None else None,
                "mean_lon": float(lon) if lon is not None else None,
                "variance_km": 0.0,
                "upserted": False,
            }

        stage1 = self.qdrant_client.query_points(
            collection_name=settings.qdrant_collection,
            query=q_geoclip_img.tolist(),
            using="geoclip_loc_emb",
            limit=50,
            timeout=300,
            with_vectors=["geoclip_img_emb"],
            with_payload=True,
            score_threshold=0.3,
        ).points

        stage2: list[dict[str, Any]] = []
        for candidate in stage1:
            vector_map = candidate.vector or {}
            geoclip_img_raw = vector_map.get("geoclip_img_emb") if isinstance(vector_map, dict) else None
            if geoclip_img_raw is None:
                continue

            geoclip_img_vec = np.array(geoclip_img_raw, dtype=np.float32)
            visual_score = self._dot(q_geoclip_img, geoclip_img_vec)
            stage2.append(
                {
                    "id": candidate.id,
                    "geoloc_score": candidate.score,
                    "visual_score": visual_score,
                    "payload": candidate.payload or {},
                }
            )

        stage2 = sorted(stage2, key=lambda x: x["visual_score"], reverse=True)
        retrieval = self._mean_top_answer(stage2)
        retrieval["query_img_vec"] = q_geoclip_img
        retrieval["context_vec"] = q_dino

        variance_km = retrieval.get("variance_km")
        if not retrieval.get("top"):
            retrieval["type"] = "new_location_request"
            retrieval["upserted"] = False
            return retrieval

        if variance_km is not None and float(variance_km) < 50:
            retrieval["type"] = "new_image_known_location"
            retrieval["upserted"] = False
            return retrieval

        retrieval["type"] = "new_location_request"
        retrieval["upserted"] = False
        return retrieval

    def _mock_retrieval(self, image: Image.Image) -> dict[str, Any]:
        # Deterministic fallback from image bytes for stable local development behavior.
        raw = io.BytesIO()
        image.save(raw, format="JPEG")
        content = raw.getvalue()
        total = int(sum(content[: min(len(content), 4096)]))

        lat = (total % 18000) / 100 - 90
        lon = (total % 36000) / 100 - 180

        top = [
            {
                "id": 1,
                "geoclip_score": round(0.75 + ((total % 10) / 100), 4),
                "dino_score": round(0.85 + ((total % 10) / 100), 4),
                "payload": {
                    "lat": lat,
                    "lon": lon,
                    "location": "mock-reference-1",
                },
            },
            {
                "id": 2,
                "geoclip_score": 0.74,
                "dino_score": 0.84,
                "payload": {
                    "lat": max(-90.0, min(90.0, lat + 0.6)),
                    "lon": max(-180.0, min(180.0, lon + 0.9)),
                    "location": "mock-reference-2",
                },
            },
            {
                "id": 3,
                "geoclip_score": 0.73,
                "dino_score": 0.83,
                "payload": {
                    "lat": max(-90.0, min(90.0, lat - 0.5)),
                    "lon": max(-180.0, min(180.0, lon - 0.7)),
                    "location": "mock-reference-3",
                },
            },
        ]

        mean_lat = sum(float(x["payload"]["lat"]) for x in top[:3]) / 3
        mean_lon = sum(float(x["payload"]["lon"]) for x in top[:3]) / 3
        return {
            "top": top,
            "mean_lat": mean_lat,
            "mean_lon": mean_lon,
            "variance_km": 15.0,
            "location": "mock-location",
            "type": "mock",
            "upserted": False,
        }

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _parse_modal_response(self, payload: dict[str, Any]) -> PredictionResult:
        # Support raw shape and wrapped API shape.
        body = payload.get("data", payload) if isinstance(payload, dict) else {}
        answer = body.get("answer", body) if isinstance(body, dict) else {}

        lat = self._to_float(answer.get("lat", answer.get("latitude")))
        lon = self._to_float(answer.get("lon", answer.get("longitude")))

        cot = answer.get("cot") or answer.get("reasoning") or body.get("cot") or ""
        model_output = answer.get("model_output") or body.get("model_output") or ""
        pred_type = answer.get("type") or body.get("type")

        # If modal only sends text, extract coordinates from text content.
        if (lat is None or lon is None) and model_output:
            parsed_lat, parsed_lon = extract_coordinates(model_output)
            lat = lat if lat is not None else parsed_lat
            lon = lon if lon is not None else parsed_lon

        location = answer.get("location") or body.get("location")
        return PredictionResult(
            lat=lat,
            lon=lon,
            location=str(location) if location else None,
            type=str(pred_type) if pred_type else None,
            cot=str(cot),
            model_output=str(model_output),
        )

    def _run_gpt4o_pipeline(self, image: Image.Image) -> PredictionResult:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required for GPT-4o fallback")

        try:
            openai_module = importlib.import_module("openai")
            openai_client_cls = getattr(openai_module, "OpenAI")
        except Exception as exc:
            raise RuntimeError("openai package is not installed. Run: pip install openai") from exc

        raw = io.BytesIO()
        image.save(raw, format="JPEG")
        data_url = f"data:image/jpeg;base64,{b64encode(raw.getvalue()).decode('utf-8')}"

        client = openai_client_cls(api_key=settings.openai_api_key)
        try:
            logger.warning("GPT4o start: model=%s timeout=%.1fs", settings.openai_model, settings.openai_timeout_seconds)
            completion = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": GPT4O_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": GPT4O_USER_PROMPT},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
                tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "submit_geolocation",
                            "description": "Submit inferred geolocation for the input image",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "cot": {
                                        "type": "string",
                                        "description": "Concise reasoning for how the location was inferred from visual cues.",
                                    },
                                    "location": {
                                        "type": "string",
                                        "description": "Place label formatted exactly as city,state,country.",
                                    },
                                    "lat": {
                                        "type": "number",
                                        "description": "Predicted latitude in decimal degrees (range -90 to 90).",
                                    },
                                    "lon": {
                                        "type": "number",
                                        "description": "Predicted longitude in decimal degrees (range -180 to 180).",
                                    },
                                },
                                "required": ["cot", "location", "lat", "lon"],
                                "additionalProperties": False,
                            },
                        },
                    }
                ],
                tool_choice={"type": "function", "function": {"name": "submit_geolocation"}},
                timeout=settings.openai_timeout_seconds,
            )
        except Exception as exc:
            logger.exception("GPT4o call failed: model=%s", settings.openai_model)
            raise RuntimeError(
                f"OpenAI chat completion failed for model '{settings.openai_model}': {exc}"
            ) from exc

        message = completion.choices[0].message
        model_output = message.content or ""
        cot = ""
        location = None
        lat = None
        lon = None
        parsed_args: dict[str, Any] = {}

        tool_calls = getattr(message, "tool_calls", None) or []
        logger.warning(
            "GPT4o response received: has_tool_calls=%s content_len=%d",
            bool(tool_calls),
            len(model_output),
        )
        if tool_calls:
            args_raw = tool_calls[0].function.arguments or "{}"
            try:
                parsed_args = json.loads(args_raw)
            except json.JSONDecodeError:
                logger.warning("OpenAI tool arguments are not valid JSON: %s", args_raw)
            cot = str(parsed_args.get("cot") or "")
            location = str(parsed_args.get("location")) if parsed_args.get("location") is not None else None
            lat = self._to_float(parsed_args.get("lat"))
            lon = self._to_float(parsed_args.get("lon"))
        else:
            logger.warning("GPT4o returned no tool_calls; falling back to text coordinate extraction")

        if not model_output and parsed_args:
            model_output = json.dumps(parsed_args, ensure_ascii=False)

        if lat is None or lon is None:
            parsed_lat, parsed_lon = extract_coordinates(model_output)
            lat = lat if lat is not None else parsed_lat
            lon = lon if lon is not None else parsed_lon
        logger.warning(
            "GPT4o parsed result: has_lat=%s has_lon=%s has_location=%s",
            lat is not None,
            lon is not None,
            location is not None,
        )
        return PredictionResult(
            lat=lat,
            lon=lon,
            location=location,
            type="new_location_request",
            cot=cot,
            model_output=model_output,
        )

    def _run_modal_pipeline(self, image: Image.Image, retrieval_context: str) -> PredictionResult:
        if not settings.modal_infer_url:
            raise RuntimeError("MODAL_INFER_URL is required when INFERENCE_BACKEND=modal")

        raw = io.BytesIO()
        image.save(raw, format="JPEG")
        raw.seek(0)

        files = {
            "image": ("upload.jpg", raw.getvalue(), "image/jpeg"),
        }
        data = {
            "use_retrieval": str(self.use_retrieval).lower(),
            "system_prompt": SYSTEM_PROMPT,
            "user_prompt": USER_PROMPT,
            "retrieval_context": retrieval_context,
        }
        headers: dict[str, str] = {}
        if settings.modal_api_key:
            headers["Authorization"] = f"Bearer {settings.modal_api_key}"

        response = requests.post(
            settings.modal_infer_url,
            headers=headers,
            data=data,
            files=files,
            timeout=settings.modal_timeout_seconds,
        )
        response.raise_for_status()

        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Modal function returned unsupported response type; expected JSON object")

        result = self._parse_modal_response(payload)

        if not result.cot:
            result.cot = "Forwarded to modal inference backend"
        if not result.model_output:
            result.model_output = ""
        return result

    def _run_real_pipeline(self, image: Image.Image, retrieval_ans: dict[str, Any], retrieval_context: str) -> PredictionResult:
        retrieval_type = str(retrieval_ans.get("type", "")) if isinstance(retrieval_ans, dict) else ""

        if self.inference_backend == "modal":
            result = self._run_modal_pipeline(image, retrieval_context=retrieval_context)
            if (result.lat is None or result.lon is None) and retrieval_ans:
                result.lat = float(retrieval_ans.get("mean_lat")) if retrieval_ans.get("mean_lat") is not None else result.lat
                result.lon = float(retrieval_ans.get("mean_lon")) if retrieval_ans.get("mean_lon") is not None else result.lon
            if retrieval_type == "new_location_request":
                result.type = "new_location_request"
            if not result.type:
                result.type = retrieval_type or "retrieval_backed"
            if not result.cot:
                result.cot = retrieval_context
            return result

        raise RuntimeError(
            "INFERENCE_BACKEND is not supported. Use INFERENCE_BACKEND=modal for forwarded inference."
        )

    def run_retrieval_stage(self, image_path: Path) -> dict[str, Any]:
        image = Image.open(image_path).convert("RGB")
        if not self.use_retrieval:
            return {"retrieval": {}, "retrieval_context": ""}

        if self.enable_real_models:
            retrieval_ans = self._staged_retrieval(image)
        else:
            retrieval_ans = self._mock_retrieval(image)

        retrieval_context = build_retrieval_context_from_top(retrieval_ans.get("top", []))
        return {"retrieval": retrieval_ans, "retrieval_context": retrieval_context}

    def run_prediction_stage(
        self,
        image_path: Path,
        retrieval_context: str,
        retrieval_ans: dict[str, Any],
    ) -> PredictionResult:
        image = Image.open(image_path).convert("RGB")

        if self.enable_real_models:
            result = self._run_real_pipeline(image, retrieval_ans=retrieval_ans, retrieval_context=retrieval_context)
            retrieval_type = str(retrieval_ans.get("type", "")) if isinstance(retrieval_ans, dict) else ""
            if retrieval_type == "new_image_known_location":
                retrieval_ans["upserted"] = self._upsert_after_inference(retrieval_ans, result)
            return result

        logger.warning("Prediction running in mock mode (ENABLE_REAL_MODELS=false); GPT4o is not invoked")
        model_output = (
            "<think>This is mock pipeline emulating inference flow with retrieval context and coordinate extraction fallback.</think>\n"
            f"<answer>{retrieval_ans.get('mean_lat', 0.0):.6f}, {retrieval_ans.get('mean_lon', 0.0):.6f}</answer>"
        )

        pred_lat, pred_lon = extract_coordinates(model_output)
        if pred_lat is None or pred_lon is None:
            pred_lat = float(retrieval_ans["mean_lat"]) if "mean_lat" in retrieval_ans else None
            pred_lon = float(retrieval_ans["mean_lon"]) if "mean_lon" in retrieval_ans else None

        cot = extract_cot(model_output)
        pred_type = str(retrieval_ans.get("type", "mock")) if isinstance(retrieval_ans, dict) else "mock"

        pred_location = str(retrieval_ans.get("location")) if retrieval_ans.get("location") is not None else None
        return PredictionResult(
            lat=pred_lat,
            lon=pred_lon,
            location=pred_location,
            type=pred_type,
            cot=cot,
            model_output=model_output,
        )

    def warmup(self) -> None:
        self._ensure_ner_runtime()

        if not self.enable_real_models:
            return

        if self.inference_backend == "modal":
            if self.use_retrieval:
                self._ensure_retrieval_runtime()

            if not settings.modal_infer_url:
                raise RuntimeError("MODAL_INFER_URL is required when INFERENCE_BACKEND=modal")

            # Optional standalone server health verification at app startup.
            if settings.modal_health_url:
                headers: dict[str, str] = {}
                if settings.modal_api_key:
                    headers["Authorization"] = f"Bearer {settings.modal_api_key}"
                resp = requests.get(
                    settings.modal_health_url,
                    headers=headers,
                    timeout=min(settings.modal_timeout_seconds, 15.0),
                )
                resp.raise_for_status()
            return

        raise RuntimeError("Unsupported INFERENCE_BACKEND. Set INFERENCE_BACKEND=modal")

    def predict(self, image_path: Path) -> PredictionResult:
        retrieval_bundle = self.run_retrieval_stage(image_path)
        retrieval_ans = retrieval_bundle.get("retrieval", {})
        retrieval_context = str(retrieval_bundle.get("retrieval_context", ""))
        return self.run_prediction_stage(image_path, retrieval_context, retrieval_ans)

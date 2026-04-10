import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

from ..config import settings

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


@dataclass
class PredictionResult:
    lat: float | None
    lon: float | None
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


class PipelineService:
    def __init__(self) -> None:
        self.use_retrieval = settings.use_retrieval
        self.enable_real_models = settings.enable_real_models

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

        mean_top3_lat = sum(float(x["payload"]["lat"]) for x in top[:3]) / 3
        mean_top3_lon = sum(float(x["payload"]["lon"]) for x in top[:3]) / 3
        return {
            "top": top,
            "mean_top3_lat": mean_top3_lat,
            "mean_top3_lon": mean_top3_lon,
        }

    def _run_real_pipeline(self, image: Image.Image) -> PredictionResult:
        raise NotImplementedError(
            "Real model pipeline is disabled by default. Set ENABLE_REAL_MODELS=true and integrate runtime dependencies."
        )

    def predict(self, image_path: Path) -> PredictionResult:
        image = Image.open(image_path).convert("RGB")

        if self.enable_real_models:
            return self._run_real_pipeline(image)

        retrieval_ans = self._mock_retrieval(image) if self.use_retrieval else {}
        retrieval_context = build_retrieval_context_from_top(retrieval_ans.get("top", []))

        model_output = (
            "<think>Mock pipeline emulating notebook flow with retrieval context and coordinate extraction fallback.</think>\n"
            f"<answer>{retrieval_ans.get('mean_top3_lat', 0.0):.6f}, {retrieval_ans.get('mean_top3_lon', 0.0):.6f}</answer>"
        )

        pred_lat, pred_lon = extract_coordinates(model_output)
        if pred_lat is None or pred_lon is None:
            pred_lat = float(retrieval_ans["mean_top3_lat"]) if "mean_top3_lat" in retrieval_ans else None
            pred_lon = float(retrieval_ans["mean_top3_lon"]) if "mean_top3_lon" in retrieval_ans else None

        cot = (
            "Prompt used:\n"
            f"SYSTEM: {SYSTEM_PROMPT}\n"
            f"USER: {USER_PROMPT}\n\n"
            f"Retrieval Context:\n{retrieval_context}"
        )

        return PredictionResult(lat=pred_lat, lon=pred_lon, cot=cot, model_output=model_output)

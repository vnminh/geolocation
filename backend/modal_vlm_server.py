import io
import os
import re
from typing import Any

import modal
from fastapi import FastAPI, File, Form, UploadFile
from huggingface_hub import login
from peft import PeftModel
from PIL import Image
from qwen_vl_utils import process_vision_info
# from transformers import BitsAndBytesConfig, Qwen2_5_VLForConditionalGeneration, AutoProcessor
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor


APP_NAME = "geotagging-vlm-server"
HF_CACHE_DIR = "/cache/huggingface"
hf_cache_volume = modal.Volume.from_name("geotagging-hf-cache", create_if_missing=True)

# Standalone VLM server image.
modal_image = (
    modal.Image.debian_slim(python_version="3.11")
    .env(
        {
            "HF_HOME": HF_CACHE_DIR,
            "TRANSFORMERS_CACHE": HF_CACHE_DIR,
            "HUGGINGFACE_HUB_CACHE": HF_CACHE_DIR,
        }
    )
    .pip_install(
        "fastapi",
        "python-multipart",
        "Pillow",
        "torch",
        "torchvision",
        "transformers",
        "peft",
        "qwen-vl-utils",
        # "bitsandbytes>=0.46.1",
        "huggingface-hub",
    )
)

app = modal.App(APP_NAME)


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

MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"

runtime: dict[str, Any] = {
    "model": None,
    "processor": None,
    "device": None,
}


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


def _ensure_vlm_runtime() -> None:
    if runtime["model"] is not None and runtime["processor"] is not None:
        return

    import torch

    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN is required in modal environment")
    login(token=hf_token)

    device = "cuda:0" if torch.cuda.is_available() else "cpu"

    model_dtype = torch.bfloat16

    base_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        device_map="auto" if device.startswith("cuda") else "cpu",
        dtype=model_dtype,
    )

    sftModel = PeftModel.from_pretrained(
        model=base_model,
        model_id="leevox/sftGRE",
        is_trainable=False,
    ).merge_and_unload()

    s1_model = PeftModel.from_pretrained(
        model=sftModel,
        model_id="leevox/stage1GRE",
        is_trainable=False,
    ).merge_and_unload()

    s2_model = PeftModel.from_pretrained(
        model=s1_model,
        model_id="leevox/stage2GRE",
        is_trainable=False,
    ).merge_and_unload()

    processor = AutoProcessor.from_pretrained(MODEL_ID)

    runtime["model"] = s2_model.eval()
    runtime["processor"] = processor
    runtime["device"] = device


def _format_messages(img: Image.Image, system_prompt: str, user_prompt: str, retrieval_context: str) -> list[dict[str, Any]]:
    merged_user_prompt = user_prompt
    if retrieval_context.strip():
        merged_user_prompt = f"{user_prompt}\n\n{retrieval_context.strip()}"
    return [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": img},
                {"type": "text", "text": merged_user_prompt},
            ],
        },
    ]


def _generate_text(messages: list[dict[str, Any]], max_new_tokens: int = 2048) -> str:
    import torch

    model = runtime["model"]
    processor = runtime["processor"]
    device = runtime["device"]
    if model is None or processor is None:
        raise RuntimeError("VLM runtime is not initialized")

    text_input = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    image_inputs, _ = process_vision_info(messages)
    image_input = image_inputs[0] if image_inputs else None

    model_inputs = processor(
        text=[text_input],
        images=[image_input],
        return_tensors="pt",
        padding=True,
    )
    model_inputs = model_inputs.to(device)

    with torch.inference_mode():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=0.0,
        )

    trimmed_ids = generated_ids[:, model_inputs.input_ids.shape[1] :]
    output_text = processor.batch_decode(
        trimmed_ids,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0]
    return output_text


def _run_vlm_predict(
    image_bytes: bytes,
    system_prompt: str,
    user_prompt: str,
    use_retrieval: bool,
    retrieval_context: str,
) -> dict[str, Any]:
    _ = use_retrieval
    _ensure_vlm_runtime()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    messages = _format_messages(image, system_prompt, user_prompt, retrieval_context)
    model_output = _generate_text(messages)

    parsed_lat, parsed_lon = extract_coordinates(model_output)
    cot = extract_cot(model_output) or "Generated by modal standalone VLM + adapter"
    
    return {
        "lat": parsed_lat,
        "lon": parsed_lon,
        "cot": cot,
        "model_output": model_output,
    }


@app.function(
    image=modal_image,
    timeout=1200,
    gpu="L4",
    min_containers=1,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    volumes={HF_CACHE_DIR: hf_cache_volume},
)
@modal.asgi_app()
def fastapi_app() -> FastAPI:
    web_app = FastAPI(title="GeoTagging Standalone Modal VLM")

    _ensure_vlm_runtime()

    @web_app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "model": MODEL_ID}

    @web_app.post("/predict")
    async def predict(
        image: UploadFile = File(...),
        use_retrieval: str = Form("true"),
        system_prompt: str = Form(SYSTEM_PROMPT),
        user_prompt: str = Form(USER_PROMPT),
        retrieval_context: str = Form(""),
    ) -> dict[str, Any]:
        content = await image.read()
        use_retrieval_bool = str(use_retrieval).strip().lower() in {"1", "true", "yes", "y"}

        result = _run_vlm_predict(
            image_bytes=content,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            use_retrieval=use_retrieval_bool,
            retrieval_context=retrieval_context,
        )

        return {"answer": result}

    return web_app


# Geo Tagging Backend (FastAPI)

## Run

1. Create and activate a virtual environment.
2. Install dependencies:
   pip install -r requirements.txt
3. Copy environment file:
   cp .env.example .env
4. Update MySQL credentials in `.env`.
5. Optional: import explicit schema:
   mysql -u root -p < schema.sql
6. Start API:
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

## API Endpoints

- POST /prediction
- POST /prediction/stream
- POST /user/signup
- POST /user/signin
- PATCH /profile
- POST /password
- POST /request
- PATCH /request/{id}

## MySQL Schema Mapping

- `user` table: user accounts and role enum (`user`, `admin`)
- `db_upsert_req` table: request payload and review status enum (`decline`, `reviewing`, `accepted`)

## Notes

- Prediction service currently mirrors the notebook pipeline flow with mock retrieval + coordinate extraction fallback for stable local development.
- To integrate the full notebook runtime (Qdrant + DINO + GeoCLIP + Qwen LoRA), enable `ENABLE_REAL_MODELS=true` and implement runtime model loading in `app/services/inference.py`.

## Standalone Modal Inference Server

Run this first, then use its URL in this backend for forwarding.

1. Login to Modal:
   modal token new
2. Start standalone Modal server locally with live URL:
   modal serve modal_vlm_server.py
3. Copy the generated public URL and set:
   - `MODAL_INFER_URL=<your_modal_url>/predict`
   - `MODAL_HEALTH_URL=<your_modal_url>/health`
4. In `.env`, enable forwarded inference:
   - `INFERENCE_BACKEND=modal`
   - `ENABLE_REAL_MODELS=true`
   - `USE_RETRIEVAL=true`
   - `QDRANT_URL=<your_qdrant_url>`
   - `QDRANT_API_KEY=<your_qdrant_api_key>`
   - `QDRANT_COLLECTION=mp16_geo_multistage`
5. Start backend API:
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

Optional production deploy:

- `modal deploy modal_vlm_server.py`
- Use the deployed app URL with `/predict` and `/health` paths.

### Reduce Repeated Model Downloads and Cold Starts

- `modal_vlm_server.py` is configured with a persistent Modal Volume for Hugging Face cache at `/cache/huggingface`.
- The web function is configured with `min_containers=1` to keep one container warm.
- In dev, `modal serve` watches files and can restart containers on file changes. Avoid writing frequently changing files in `App/backend` while serving.
- For stable latency testing, prefer `modal deploy` instead of `modal serve`.

## Runtime Split

- Backend server warmup loads retrieval stack: GeoCLIP + DINO + Qdrant client.
- Backend prediction builds retrieval context from top neighbors and forwards full input to modal.
- Modal server warmup loads VLM + LoRA adapter, then performs generation for `/predict`.

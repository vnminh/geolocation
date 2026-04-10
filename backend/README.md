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

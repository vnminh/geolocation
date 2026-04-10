from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import ensure_runtime_dirs, settings
from app.database import engine
from app.models import Base
from app.routes.prediction import router as prediction_router
from app.routes.request import router as request_router
from app.routes.user import router as user_router


def create_app() -> FastAPI:
    ensure_runtime_dirs()
    Base.metadata.create_all(bind=engine)

    app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    @app.get("/health")
    def health() -> dict:
        return {"success": True, "data": {"status": "ok"}}

    app.include_router(prediction_router)
    app.include_router(user_router)
    app.include_router(request_router)

    return app


app = create_app()

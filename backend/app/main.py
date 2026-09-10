"""
ShiftRAG — FastAPI Entry Point
Universal Format Shifter for RAG: messy docs → clean markdown → vectors

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.routes import router as api_router
from app.core import qdrant_db
from app.services.embedder import embedder_service

# -------------------------------------------------
# Logging
# -------------------------------------------------
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# -------------------------------------------------
# Lifespan — warm up Qdrant + embedder on startup
# -------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {settings.app_name} v{settings.app_version} ({settings.environment})")
    # Warm Qdrant (creates collection)
    try:
        qdrant_db.get_qdrant_client()
        logger.info("✓ Qdrant ready")
    except Exception as e:
        logger.error(f"✗ Qdrant init failed: {e}")

    # Warm embedder (optional — lazy load is fine too)
    try:
        # Don't block startup on model download; just log info
        info = embedder_service.info()
        logger.info(f"Embedder: {info}")
    except Exception as e:
        logger.warning(f"Embedder warmup skipped: {e}")

    logger.info(f"✓ API ready at http://{settings.host}:{settings.port}")
    logger.info(f"  Docs: http://{settings.host}:{settings.port}/docs")

    yield
    logger.info("Shutting down ShiftRAG...")


# -------------------------------------------------
# App
# -------------------------------------------------
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Universal Format Shifter for RAG — ingest messy PDFs, XLSX with merged cells, PPTX, DOCX, "
        "convert via Docling spatial mapping → clean Markdown → FastEmbed vectors → Qdrant index."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS — allow frontend dev servers and E2B previews
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permissive for demo; tighten in production via settings.cors_origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes — mounted under /api and also bare for convenience
app.include_router(api_router, prefix="/api", tags=["ShiftRAG"])
app.include_router(api_router, prefix="", tags=["ShiftRAG (root)"])


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "ok",
        "docs": "/docs",
        "endpoints": {
            "shift": "POST /api/shift (multipart file upload)",
            "search": "GET /api/search?q=your+query",
            "documents": "GET /api/documents",
            "stats": "GET /api/stats",
            "health": "GET /api/health",
        },
        "frontend": "http://localhost:3000",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception(f"Unhandled error at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)[:300]}", "path": str(request.url.path)},
    )


# -------------------------------------------------
# Local dev entry
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )

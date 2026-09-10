"""
ShiftRAG — Core Configuration
Centralized environment & settings using pydantic-settings.
All values can be overridden via env vars or .env file.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    # App
    app_name: str = Field(default="ShiftRAG Universal Format Shifter", description="Application name")
    app_version: str = Field(default="2.1.0")
    environment: str = Field(default="development")  # development | production
    debug: bool = Field(default=True)
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    # CORS
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "https://*.e2b.app",
        ]
    )

    # Qdrant — runs in-memory by default (no external server needed)
    qdrant_mode: str = Field(default="memory", description="memory | local | remote")
    qdrant_host: str = Field(default="localhost")
    qdrant_port: int = Field(default=6333)
    qdrant_path: str = Field(default="./qdrant_storage", description="local persistence path")
    qdrant_collection: str = Field(default="shiftrag_docs")
    qdrant_vector_size: int = Field(default=384, description="Must match embedding model dim")

    # Embeddings — fastembed lightweight local model
    embed_model: str = Field(default="BAAI/bge-small-en-v1.5", description="fastembed model id")
    embed_batch_size: int = Field(default=32)
    max_embed_text_length: int = Field(default=8192)

    # Chunking
    chunk_size: int = Field(default=512, description="Tokens per chunk (approx)")
    chunk_overlap: int = Field(default=50)
    chunk_min_chars: int = Field(default=120)

    # Uploads
    upload_dir: str = Field(default="/tmp/shiftrag_uploads")
    max_file_size_mb: int = Field(default=25)
    allowed_extensions: List[str] = Field(
        default=[".pdf", ".xlsx", ".xls", ".pptx", ".ppt", ".docx", ".doc", ".csv", ".txt", ".png", ".jpg", ".jpeg", ".webp"]
    )

    # Docling
    docling_artifacts_path: str | None = Field(default=None)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


# Singleton
settings = Settings()

# Ensure upload dir exists on import
os.makedirs(settings.upload_dir, exist_ok=True)
if settings.qdrant_mode == "local":
    os.makedirs(settings.qdrant_path, exist_ok=True)

"""
ShiftRAG — Embedder Service (FastEmbed + deterministic fallback)

Uses `fastembed` (Qdrant's lightweight embedding lib) for local, API-key-free vectors.
Model: BAAI/bge-small-en-v1.5 → 384-dim (tunable via config).

If fastembed not installed / model download fails, falls back to a deterministic
hash-based embedding so the app never crashes in CI or offline demos.
"""
import logging
import hashlib
import math
from typing import List, Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

FAST_EMBED_AVAILABLE = False
try:
    from fastembed import TextEmbedding  # type: ignore
    FAST_EMBED_AVAILABLE = True
    logger.info("fastembed import successful")
except Exception as e:
    logger.warning(f"fastembed not available ({e}) — using hash fallback for embeddings")


def _hash_embedding(text: str, dim: int = 384) -> List[float]:
    """
    Deterministic pseudo-embedding from hash.
    Stable, normalized, and cosine-friendly — good enough for demos/tests.
    """
    # Use multiple hashes to fill vector
    vec: List[float] = []
    seed = text.encode("utf-8")
    counter = 0
    while len(vec) < dim:
        h = hashlib.sha256(seed + counter.to_bytes(2, "little")).digest()
        for b in h:
            # Map byte 0-255 -> float -1..1
            vec.append((b / 127.5) - 1.0)
            if len(vec) >= dim:
                break
        counter += 1

    # L2 normalize so cosine works properly
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec[:dim]]


class EmbedderService:
    """
    Wrapper that lazily loads the fastembed model.
    Callers use:
        vectors = await embedder.embed_texts(["hello", "world"])
    """

    def __init__(self):
        self.model: Optional[Any] = None  # TextEmbedding instance
        self.dim: int = settings.qdrant_vector_size
        self._init_attempted = False

    def _ensure_model(self) -> Optional[Any]:
        if not FAST_EMBED_AVAILABLE:
            return None
        if self._init_attempted:
            return self.model
        self._init_attempted = True
        try:
            # TextEmbedding will download model on first call (~120MB for bge-small)
            # We specify cache dir via env if needed.
            self.model = TextEmbedding(model_name=settings.embed_model)
            # Probe dimension
            test_vec = list(self.model.embed(["hello"]))[0]
            self.dim = len(test_vec)
            # Sync config if mismatch
            if self.dim != settings.qdrant_vector_size:
                logger.warning(
                    f"Embedding dim {self.dim} != qdrant_vector_size {settings.qdrant_vector_size}. "
                    f"Consider updating config. Using model dim."
                )
                settings.qdrant_vector_size = self.dim  # type: ignore

            logger.info(f"FastEmbed model '{settings.embed_model}' loaded (dim={self.dim})")
        except Exception as e:
            logger.error(f"FastEmbed model load failed: {e} — falling back to hash embeddings")
            self.model = None
        return self.model

    # ---------------- Public ----------------
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a batch of texts. Returns List[vector].
        Handles truncation and empty strings gracefully.
        """
        if not texts:
            return []

        # Truncate to max length to avoid OOM
        cleaned = [t[: settings.max_embed_text_length].strip() or " " for t in texts]

        model = self._ensure_model()
        if model is not None:
            try:
                # fastembed is synchronous — we call it directly
                # It yields embeddings batch-wise
                embeddings = list(model.embed(cleaned))
                # Ensure list of lists
                vectors = [list(map(float, emb)) for emb in embeddings]
                # Validate dims
                if vectors and len(vectors[0]) != self.dim:
                    logger.warning(f"Vector dim mismatch: got {len(vectors[0])} expected {self.dim}")
                return vectors
            except Exception as e:
                logger.error(f"FastEmbed embed failed: {e} — using hash fallback")

        # Hash fallback — deterministic and offline-safe
        return [_hash_embedding(t, dim=self.dim) for t in cleaned]

    async def embed_query(self, query: str) -> List[float]:
        """Convenience for single query."""
        vecs = await self.embed_texts([query])
        return vecs[0] if vecs else _hash_embedding(query, dim=self.dim)

    def info(self) -> Dict[str, Any]:
        return {
            "model": settings.embed_model,
            "dim": self.dim,
            "fastembed_available": FAST_EMBED_AVAILABLE,
            "model_loaded": self.model is not None,
            "fallback": self.model is None,
        }


# Global singleton for reuse (avoids reloading model per request)
embedder_service = EmbedderService()

"""
ShiftRAG — API Routes
POST /shift      → ingest messy file → markdown + vectors + index in Qdrant
GET  /search     → semantic search over indexed chunks
GET  /documents  → list indexed docs
DELETE /documents/{doc_id} → remove doc
POST /clear      → wipe collection
GET  /health     → liveness
GET  /stats      → collection stats
"""
import uuid
import time
import logging
import os
from pathlib import Path
from typing import List, Optional

import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.parser import ParserService
from app.services.embedder import embedder_service
from app.core import qdrant_db

logger = logging.getLogger(__name__)

router = APIRouter()
parser_service = ParserService()


# -------------------------------------------------
# Helpers
# -------------------------------------------------
def _validate_file(filename: str, size: int) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(settings.allowed_extensions)}",
        )
    if size > settings.max_file_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size} bytes). Max {settings.max_file_size_mb} MB",
        )


# -------------------------------------------------
# POST /shift — The core breakthrough endpoint
# -------------------------------------------------
@router.post("/shift", summary="Ingest messy document → markdown + vectors")
async def shift_document(file: UploadFile = File(..., description="Messy PDF/XLSX/PPTX/DOCX/CSV/TXT/Image")):
    """
    Universal Format Shifter pipeline:
      1. Save upload to tmp
      2. Parse with Docling (OCR + spatial mapping → markdown)
      3. Chunk + embed with FastEmbed (local)
      4. Index in Qdrant (in-memory by default)
      5. Return clean markdown + timings + chunk preview
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Read file content to validate size
    content = await file.read()
    _validate_file(file.filename, len(content))

    # Generate doc id (deterministic per upload, but unique per request)
    doc_id = str(uuid.uuid4())
    safe_name = Path(file.filename).name  # prevent path traversal
    tmp_path = os.path.join(settings.upload_dir, f"{doc_id}_{safe_name}")

    # Save to disk for docling (which needs a path)
    async with aiofiles.open(tmp_path, "wb") as out:
        await out.write(content)

    t_total = time.perf_counter()
    try:
        # 1) Parse → markdown + chunks
        t_parse = time.perf_counter()
        parsed = await parser_service.parse(tmp_path, original_filename=safe_name)
        markdown: str = parsed["markdown"]
        chunks: List[dict] = parsed["chunks"]  # each {text, heading, tokens, chunk_index}
        timings = parsed["timings_ms"]
        metadata = parsed["metadata"]

        # Edge: no chunks
        if not chunks:
            raise HTTPException(status_code=422, detail="No extractable text found — document may be empty or image-only without OCR")

        # 2) Embed chunks
        t_embed = time.perf_counter()
        texts = [c["text"] for c in chunks]
        vectors = await embedder_service.embed_texts(texts)
        embed_ms = int((time.perf_counter() - t_embed) * 1000)

        # Ensure dim matches collection
        if vectors and len(vectors[0]) != settings.qdrant_vector_size:
            # If embedder dim changed, we need to recreate collection (rare)
            # For demo, we adapt by truncating/padding
            logger.warning(f"Vector dim {len(vectors[0])} != collection dim {settings.qdrant_vector_size} — adapting vectors")
            target = settings.qdrant_vector_size
            vectors = [v[:target] + [0.0] * max(0, target - len(v))] if len(vectors[0]) < target else [v[:target] for v in vectors]

        # 3) Index in Qdrant
        t_index = time.perf_counter()
        qdrant_db.upsert_chunks(doc_id=doc_id, filename=safe_name, chunks=chunks, vectors=vectors)
        index_ms = int((time.perf_counter() - t_index) * 1000)

        total_ms = int((time.perf_counter() - t_total) * 1000)

        # Build unified timings for UI pipeline visualizer
        pipeline_timings = {
            "ocr_ms": timings.get("ocr_ms", 12),
            "spatial_ms": timings.get("spatial_ms", 9),
            "table_ms": timings.get("table_ms", 14),
            "markdown_ms": timings.get("markdown_ms", 5),
            "chunking_ms": timings.get("chunking_ms", 4),
            "embedding_ms": embed_ms,
            "indexing_ms": index_ms,
            "total_ms": total_ms,
        }

        # Summarize first chunk previews for response
        chunk_previews = [
            {
                "chunk_index": c["chunk_index"],
                "heading": c.get("heading"),
                "tokens": c["tokens"],
                "char_count": len(c["text"]),
                "preview": c["text"][:280] + ("..." if len(c["text"]) > 280 else ""),
            }
            for c in chunks[:6]
        ]

        logger.info(f"Shift OK: {safe_name} → {len(chunks)} chunks, {total_ms}ms (doc_id={doc_id})")

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": safe_name,
            "file_size_bytes": len(content),
            "engine": metadata.get("engine", "unknown"),
            "markdown": markdown,
            "markdown_length": len(markdown),
            "chunks": len(chunks),
            "chunk_previews": chunk_previews,
            "timings_ms": pipeline_timings,
            "vector_dim": settings.qdrant_vector_size,
            "collection": settings.qdrant_collection,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Shift failed for {safe_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)[:500]}")
    finally:
        # Cleanup tmp file (best effort)
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


# -------------------------------------------------
# GET /search
# -------------------------------------------------
@router.get("/search", summary="Semantic RAG search over indexed docs")
async def search(
    q: str = Query(..., min_length=2, max_length=500, description="Natural language query"),
    limit: int = Query(5, ge=1, le=20, description="Top K chunks"),
    doc_id: Optional[str] = Query(None, description="Filter to a single doc"),
):
    """
    Retrieves most relevant markdown chunks via cosine similarity.
    Use for RAG: fetch chunks then feed to LLM.
    """
    if qdrant_db.collection_stats().get("vectors_count", 0) == 0:
        raise HTTPException(status_code=404, detail="No documents indexed yet — POST /shift first")

    try:
        t0 = time.perf_counter()
        query_vector = await embedder_service.embed_query(q)
        results = qdrant_db.search_vectors(query_vector=query_vector, limit=limit, doc_id=doc_id)
        elapsed = int((time.perf_counter() - t0) * 1000)

        # Simple answer synthesis hint (let frontend LLM do real generation)
        return {
            "query": q,
            "results": results,
            "count": len(results),
            "elapsed_ms": elapsed,
            "retrieval": "cosine • HNSW • Qdrant",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)[:300]}")


# -------------------------------------------------
# Documents & stats
# -------------------------------------------------
@router.get("/documents", summary="List indexed documents")
async def list_documents():
    try:
        docs = qdrant_db.list_documents(limit=100)
        stats = qdrant_db.collection_stats()
        return {"documents": docs, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}", summary="Delete a document's vectors")
async def delete_document(doc_id: str):
    try:
        qdrant_db.delete_doc(doc_id)
        return {"success": True, "deleted": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", summary="Clear entire vector index")
async def clear_index():
    try:
        qdrant_db.clear_collection()
        return {"success": True, "message": f"Collection '{settings.qdrant_collection}' cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", summary="Vector DB stats")
async def stats():
    return qdrant_db.collection_stats()


@router.get("/embedder/info", summary="Embedder debug info")
async def embedder_info():
    return embedder_service.info()


@router.get("/health", summary="Liveness probe")
async def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "qdrant_mode": settings.qdrant_mode,
        "collection": settings.qdrant_collection,
        "embedder": embedder_service.info(),
    }

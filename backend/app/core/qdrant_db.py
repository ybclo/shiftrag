"""
ShiftRAG — Qdrant Vector Database
Handles collection init, upsert, search, and stats.
Runs in-memory by default so `docker-compose up` needs no external Qdrant.
Swap to `qdrant_mode=remote` for production cluster.
"""
import uuid
import logging
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# -------------------------------------------------
# Client singleton
# -------------------------------------------------
_client: Optional[QdrantClient] = None


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is not None:
        return _client

    if settings.qdrant_mode == "memory":
        # In-memory ephemeral — perfect for demos / tests
        _client = QdrantClient(":memory:")
        logger.info("Qdrant: initialized IN-MEMORY client")
    elif settings.qdrant_mode == "local":
        _client = QdrantClient(path=settings.qdrant_path)
        logger.info(f"Qdrant: initialized LOCAL client at {settings.qdrant_path}")
    else:  # remote
        _client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        logger.info(f"Qdrant: initialized REMOTE client at {settings.qdrant_host}:{settings.qdrant_port}")

    _ensure_collection(_client)
    return _client


def _ensure_collection(client: QdrantClient) -> None:
    """Create collection if it doesn't exist."""
    try:
        collections = [c.name for c in client.get_collections().collections]
        if settings.qdrant_collection in collections:
            logger.info(f"Qdrant collection '{settings.qdrant_collection}' exists")
            return

        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.qdrant_vector_size,
                distance=Distance.COSINE,
            ),
        )
        logger.info(f"Qdrant collection '{settings.qdrant_collection}' created (dim={settings.qdrant_vector_size})")

        # Optional payload indexes for filtering
        try:
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name="doc_id",
                field_schema="keyword",
            )
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name="filename",
                field_schema="keyword",
            )
        except Exception as e:
            logger.debug(f"Payload index creation skipped: {e}")

    except Exception as e:
        logger.error(f"Failed to ensure Qdrant collection: {e}")
        raise


# -------------------------------------------------
# CRUD helpers
# -------------------------------------------------
def upsert_chunks(
    doc_id: str,
    filename: str,
    chunks: List[Dict[str, Any]],
    vectors: List[List[float]],
) -> int:
    """
    Insert chunk + vector pairs. Each chunk dict must contain `text`.
    Returns number of points upserted.
    """
    client = get_qdrant_client()
    if len(chunks) != len(vectors):
        raise ValueError("chunks and vectors length mismatch")

    points = []
    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}:{idx}:{chunk['text'][:32]}"))
        payload = {
            "doc_id": doc_id,
            "filename": filename,
            "chunk_index": idx,
            "text": chunk["text"],
            "tokens": chunk.get("tokens", 0),
            "char_count": len(chunk["text"]),
        }
        # keep any extra metadata
        if "heading" in chunk:
            payload["heading"] = chunk["heading"]

        points.append(PointStruct(id=point_id, vector=vector, payload=payload))

    client.upsert(collection_name=settings.qdrant_collection, points=points)
    logger.info(f"Upserted {len(points)} chunks for doc {doc_id} ({filename})")
    return len(points)


def search_vectors(query_vector: List[float], limit: int = 5, doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Semantic search over indexed chunks. Handles both legacy `search` and new `query_points` APIs."""
    client = get_qdrant_client()
    query_filter = None
    if doc_id:
        query_filter = Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))])

    # Compatibility: qdrant-client >=1.10 uses query_points, older uses search
    try:
        if hasattr(client, "search"):
            # Legacy API (qdrant <1.10)
            results = client.search(
                collection_name=settings.qdrant_collection,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )
        elif hasattr(client, "query_points"):
            # New API (qdrant >=1.10) — query_points
            res = client.query_points(
                collection_name=settings.qdrant_collection,
                query=query_vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )
            # query_points returns a QueryResponse with .points
            results = res.points if hasattr(res, "points") else res
        else:
            # Fallback: use `query` (some versions)
            res = client.query(
                collection_name=settings.qdrant_collection,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit,
            )
            results = res

        # Normalize results to list of scored points
        out = []
        for r in results:
            # r may be ScoredPoint
            payload = getattr(r, "payload", {}) or {}
            out.append(
                {
                    "id": str(getattr(r, "id", "")),
                    "score": float(getattr(r, "score", 0.0)),
                    "text": payload.get("text", ""),
                    "filename": payload.get("filename", ""),
                    "doc_id": payload.get("doc_id", ""),
                    "chunk_index": payload.get("chunk_index", 0),
                    "tokens": payload.get("tokens", 0),
                }
            )
        return out
    except Exception as e:
        logger.error(f"Qdrant search failed: {e}")
        raise


def delete_doc(doc_id: str) -> None:
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]),
    )
    logger.info(f"Deleted doc {doc_id} from Qdrant")


def clear_collection() -> None:
    """Delete and recreate collection — nuclear reset."""
    client = get_qdrant_client()
    try:
        client.delete_collection(collection_name=settings.qdrant_collection)
        logger.warning(f"Cleared collection {settings.qdrant_collection}")
    except Exception:
        pass
    _ensure_collection(client)


def collection_stats() -> Dict[str, Any]:
    client = get_qdrant_client()
    try:
        info = client.get_collection(collection_name=settings.qdrant_collection)
        # count distinct doc_ids
        # scroll to get payloads (lightweight for demo)
        doc_ids = set()
        next_offset = None
        while True:
            points, next_offset = client.scroll(
                collection_name=settings.qdrant_collection,
                limit=256,
                offset=next_offset,
                with_payload=True,
            )
            for p in points:
                if p.payload and "doc_id" in p.payload:
                    doc_ids.add(p.payload["doc_id"])
            if next_offset is None:
                break

        # Qdrant client version drift: handle both old and new attribute names
        vectors_count = getattr(info, "vectors_count", None)
        if vectors_count is None:
            vectors_count = getattr(info, "points_count", 0) or 0
        points_count = getattr(info, "points_count", vectors_count) or vectors_count
        indexed = getattr(info, "indexed_vectors_count", 0) or 0
        status = getattr(info, "status", "unknown")

        return {
            "collection": settings.qdrant_collection,
            "vectors_count": vectors_count or 0,
            "points_count": points_count or 0,
            "indexed_vectors_count": indexed or 0,
            "status": str(status),
            "documents": len(doc_ids),
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return {"collection": settings.qdrant_collection, "vectors_count": 0, "documents": 0, "error": str(e)}


def list_documents(limit: int = 100) -> List[Dict[str, Any]]:
    """Aggregate distinct documents from payloads."""
    client = get_qdrant_client()
    docs: Dict[str, Dict[str, Any]] = {}
    next_offset = None
    while len(docs) < limit:
        points, next_offset = client.scroll(
            collection_name=settings.qdrant_collection,
            limit=256,
            offset=next_offset,
            with_payload=True,
        )
        if not points:
            break
        for p in points:
            pl = p.payload or {}
            did = pl.get("doc_id")
            if not did or did in docs:
                if did in docs:
                    docs[did]["chunks"] += 1
                continue
            docs[did] = {
                "doc_id": did,
                "filename": pl.get("filename", "unknown"),
                "chunks": 1,
            }
        if next_offset is None:
            break
    return list(docs.values())

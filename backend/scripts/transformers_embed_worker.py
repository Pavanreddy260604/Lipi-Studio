import json
import math
import os
import sys
from typing import Any, Dict, List

MODEL = None
MODEL_NAME = os.environ.get("TRANSFORMERS_EMBED_MODEL", "BAAI/bge-m3")
LOCAL_FILES_ONLY = os.environ.get("TRANSFORMERS_LOCAL_FILES_ONLY", "false").lower() in ("1", "true", "yes", "on")
TRUST_REMOTE_CODE = os.environ.get("TRANSFORMERS_TRUST_REMOTE_CODE", "false").lower() in ("1", "true", "yes", "on")
DEVICE = os.environ.get("TRANSFORMERS_DEVICE", "").strip()


def get_model():
    global MODEL
    if MODEL is not None:
        return MODEL

    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency: sentence-transformers. Install with: "
            "pip install sentence-transformers torch"
        ) from exc

    kwargs: Dict[str, Any] = {
        "trust_remote_code": TRUST_REMOTE_CODE
    }

    # SentenceTransformer supports local_files_only to avoid network fetches.
    kwargs["local_files_only"] = LOCAL_FILES_ONLY
    if DEVICE:
        kwargs["device"] = DEVICE

    MODEL = SentenceTransformer(MODEL_NAME, **kwargs)
    return MODEL


def to_list_embedding(vector: Any) -> List[float]:
    if hasattr(vector, "tolist"):
        values = vector.tolist()
    else:
        values = list(vector)

    embedding = [float(v) for v in values]
    if not embedding:
        raise ValueError("Empty embedding produced by transformers model")

    if any(not math.isfinite(v) for v in embedding):
        raise ValueError("Transformers model produced non-finite embedding values")

    return embedding


def handle_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    request_id = payload.get("id")
    text = payload.get("text", "")
    if not isinstance(text, str):
        return {"id": request_id, "error": "Field 'text' must be a string"}

    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    embedding = to_list_embedding(vector)
    return {"id": request_id, "embedding": embedding}


def emit(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> None:
    emit({"type": "ready", "model": MODEL_NAME, "local_files_only": LOCAL_FILES_ONLY})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            if isinstance(payload, dict):
                request_id = payload.get("id")
            else:
                emit({"id": request_id, "error": "Payload must be a JSON object"})
                continue

            response = handle_request(payload)
            emit(response)
        except Exception as exc:
            emit({"id": request_id, "error": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    main()

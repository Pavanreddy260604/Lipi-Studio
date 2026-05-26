import os


def main() -> None:
    model_name = os.environ.get("TRANSFORMERS_EMBED_MODEL", "BAAI/bge-m3")
    local_files_only = os.environ.get("TRANSFORMERS_LOCAL_FILES_ONLY", "false").lower() in ("1", "true", "yes", "on")
    device = os.environ.get("TRANSFORMERS_DEVICE", "").strip()

    from sentence_transformers import SentenceTransformer

    kwargs = {
        "trust_remote_code": os.environ.get("TRANSFORMERS_TRUST_REMOTE_CODE", "false").lower() in ("1", "true", "yes", "on"),
        "local_files_only": local_files_only,
    }
    if device:
        kwargs["device"] = device

    print(f"[download_transformers_model] Loading model: {model_name}")
    model = SentenceTransformer(model_name, **kwargs)
    # Warm an encode pass so tokenizer/model artifacts are initialized.
    _ = model.encode("model warmup", normalize_embeddings=True)
    print("[download_transformers_model] Model ready.")


if __name__ == "__main__":
    main()

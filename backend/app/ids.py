import uuid
from datetime import datetime, timezone


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

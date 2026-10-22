import asyncio
from typing import Any

from app.ids import utc_now
from app.logging_setup import get_logger
from app.schemas.domain import DebateMeta, DebateStatus, Phase
from app.services.history import HistoryStore

log = get_logger()

TERMINAL_EVENTS = {"debate_completed", "debate_failed", "debate_cancelled"}
TERMINAL_STATUSES = {"completed", "failed", "cancelled", "interrupted"}


class DebateSession:
    def __init__(self, meta: DebateMeta, store: HistoryStore, events: list[dict] | None = None) -> None:
        self.meta = meta
        self.store = store
        self.events: list[dict] = events or []
        self.subscribers: set[asyncio.Queue] = set()
        self.task: asyncio.Task | None = None
        self.evidence_counter = 0
        self.evidence_by_url: dict[str, dict] = {}
        self._seq = self.events[-1]["seq"] if self.events else 0

    @property
    def id(self) -> str:
        return self.meta.id

    @property
    def finished(self) -> bool:
        return self.meta.status in TERMINAL_STATUSES

    def update_meta(self, **changes: Any) -> None:
        data = self.meta.model_dump()
        data.update(changes)
        data["updated_at"] = utc_now()
        self.meta = DebateMeta(**data)
        self.store.write_meta(self.meta.model_dump(mode="json"))

    def set_status(self, status: DebateStatus, **changes: Any) -> None:
        self.update_meta(status=status, **changes)

    def set_phase(self, phase: Phase, round_: int) -> None:
        self.update_meta(phase=phase, round=round_)

    def emit(self, event_type: str, payload: dict[str, Any], *, persist: bool = True) -> dict:
        if persist:
            self._seq += 1
        event = {
            "seq": self._seq if persist else 0,
            "type": event_type,
            "debate_id": self.id,
            "ts": utc_now(),
            "payload": payload,
        }
        if persist:
            self.events.append(event)
            self.store.append_event(self.id, event)
        for queue in list(self.subscribers):
            queue.put_nowait(event)
        return event

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self.subscribers.discard(queue)

    def events_after(self, seq: int) -> list[dict]:
        return [event for event in self.events if event["seq"] > seq]

    def allocate_evidence_id(self) -> str:
        self.evidence_counter += 1
        return f"E{self.evidence_counter}"

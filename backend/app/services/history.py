import json
import shutil
from pathlib import Path
from threading import Lock

from app.logging_setup import ERROR_LOGGER, get_logger

log = get_logger(ERROR_LOGGER)


class HistoryStore:
    def __init__(self, data_dir: Path) -> None:
        self.root = data_dir / "debates"
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def _meta_path(self, debate_id: str) -> Path:
        return self.root / f"{debate_id}.meta.json"

    def _events_path(self, debate_id: str) -> Path:
        return self.root / f"{debate_id}.events.jsonl"

    def write_meta(self, meta: dict) -> None:
        path = self._meta_path(meta["id"])
        temp = path.with_suffix(".tmp")
        with self._lock:
            temp.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            temp.replace(path)

    def append_event(self, debate_id: str, event: dict) -> None:
        with self._lock:
            with self._events_path(debate_id).open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False) + "\n")

    def read_meta(self, debate_id: str) -> dict | None:
        path = self._meta_path(debate_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            log.error("history_meta_unreadable", debate_id=debate_id)
            return None

    def read_events(self, debate_id: str) -> list[dict]:
        path = self._events_path(debate_id)
        if not path.exists():
            return []
        events = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    log.error("history_event_unreadable", debate_id=debate_id)
        return events

    def list_meta(self) -> list[dict]:
        items = []
        for path in self.root.glob("*.meta.json"):
            try:
                items.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                log.error("history_meta_unreadable", path=str(path))
        items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return items

    def delete(self, debate_id: str) -> None:
        with self._lock:
            for path in (self._meta_path(debate_id), self._events_path(debate_id)):
                if path.exists():
                    path.unlink()

    def clear_all(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)
        self.root.mkdir(parents=True, exist_ok=True)

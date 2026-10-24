import asyncio

from app.agents.personas import build_debaters, build_judge, required_slots, specialist_available
from app.agents.runtime import LLMRuntime
from app.config import SUPPORTED_PROVIDERS, Settings
from app.errors import AgoraError, ConfigurationError, DebateNotFoundError
from app.graph.builder import build_graph
from app.graph.context import DebateContext
from app.ids import new_id, utc_now
from app.logging_setup import ERROR_LOGGER, get_logger
from app.schemas.domain import DebateMeta
from app.services.history import HistoryStore
from app.services.search import SearchService
from app.services.session import TERMINAL_STATUSES, DebateSession

log = get_logger()
error_log = get_logger(ERROR_LOGGER)


class SessionManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.store = HistoryStore(settings.data_dir)
        self.runtime = LLMRuntime(settings)
        self.search = SearchService(settings)
        self.graph = build_graph()
        self.sessions: dict[str, DebateSession] = {}
        self._mark_interrupted()

    def _mark_interrupted(self) -> None:
        for raw in self.store.list_meta():
            if raw.get("status") in {"pending", "running"}:
                raw["status"] = "interrupted"
                raw["updated_at"] = utc_now()
                raw["error"] = "The server restarted before this debate finished."
                self.store.write_meta(raw)

    def validate_configuration(self) -> None:
        slots = required_slots()
        missing = self.settings.missing_keys(slots)
        if missing:
            raise ConfigurationError(
                "Missing API keys: " + ", ".join(missing),
                details={"missing": missing},
            )
        bad = [
            self.settings.llm(slot).slot
            for slot in slots
            if self.settings.llm(slot).provider not in SUPPORTED_PROVIDERS
        ]
        if bad:
            raise ConfigurationError("Unsupported provider configured for: " + ", ".join(bad), details={"slots": bad})

    def readiness(self) -> dict:
        slots = required_slots()
        return {
            "ready": not self.settings.missing_keys(slots),
            "missing_keys": self.settings.missing_keys(slots),
            "specialist": specialist_available(self.settings),
            "web_search": self.search.available,
            "min_rounds": self.settings.min_rounds,
            "max_rounds": self.settings.max_rounds,
            "max_question_length": self.settings.max_question_length,
        }

    def panel(self) -> list[dict]:
        agents = [build_judge(self.settings), *build_debaters(self.settings)]
        return [agent.model_dump(mode="json") for agent in agents]

    async def create(self, question: str, topic: str) -> DebateSession:
        if len(question) > self.settings.max_question_length:
            raise ConfigurationError(
                f"Question exceeds {self.settings.max_question_length} characters",
                details={"max": self.settings.max_question_length},
            )
        self.validate_configuration()
        now = utc_now()
        meta = DebateMeta(
            id=new_id("dbt"), question=question, topic=topic, status="pending", created_at=now, updated_at=now
        )
        session = DebateSession(meta, self.store)
        self.store.write_meta(meta.model_dump(mode="json"))
        self.sessions[session.id] = session
        session.task = asyncio.create_task(self._run(session), name=f"debate-{session.id}")
        return session

    async def _run(self, session: DebateSession) -> None:
        agents = [build_judge(self.settings), *build_debaters(self.settings)]
        ctx = DebateContext(settings=self.settings, session=session, runtime=self.runtime, search=self.search)
        initial = {
            "debate_id": session.id,
            "question": session.meta.question,
            "topic": session.meta.topic,
            "agents": [agent.model_dump(mode="json") for agent in agents],
            "messages": [],
            "evidence": [],
            "interactions": [],
            "rulings": [],
            "penalties": [],
            "departures": [],
            "conflicts": [],
            "scores": {},
            "directives": {},
            "round": 0,
        }
        session.set_status("running")
        session.emit(
            "debate_started",
            {
                "debate": session.meta.model_dump(mode="json"),
                "agents": initial["agents"],
                "limits": {"min_rounds": self.settings.min_rounds, "max_rounds": self.settings.max_rounds},
                "web_search": self.search.available,
            },
        )
        log.info("debate_started", debate_id=session.id, topic=session.meta.topic)
        try:
            await self.graph.ainvoke(
                initial,
                config={"configurable": {"ctx": ctx, "thread_id": session.id}, "recursion_limit": 200},
            )
            session.set_status("completed")
            session.emit("debate_completed", {"debate": session.meta.model_dump(mode="json")})
            log.info("debate_completed", debate_id=session.id)
        except asyncio.CancelledError:
            session.set_status("cancelled")
            session.emit("debate_cancelled", {"debate": session.meta.model_dump(mode="json")})
            log.info("debate_cancelled", debate_id=session.id)
        except AgoraError as exc:
            self._fail(session, exc.code, exc.message, exc.details)
        except Exception as exc:
            error_log.exception("debate_crashed", debate_id=session.id)
            self._fail(session, "internal_error", f"{type(exc).__name__}: {exc}", {})

    def _fail(self, session: DebateSession, code: str, message: str, details: dict) -> None:
        error_log.error("debate_failed", debate_id=session.id, code=code, message=message, details=details)
        session.set_status("failed", error=message)
        session.emit(
            "debate_failed",
            {"debate": session.meta.model_dump(mode="json"), "error": {"code": code, "message": message, "details": details}},
        )

    def find(self, debate_id: str) -> DebateSession | None:
        session = self.sessions.get(debate_id)
        if session:
            return session
        raw = self.store.read_meta(debate_id)
        if not raw:
            return None
        session = DebateSession(DebateMeta(**raw), self.store, events=self.store.read_events(debate_id))
        if session.meta.status not in TERMINAL_STATUSES:
            session.meta = session.meta.model_copy(update={"status": "interrupted"})
        return session

    def get(self, debate_id: str) -> DebateSession:
        session = self.find(debate_id)
        if not session:
            raise DebateNotFoundError(f"Debate {debate_id} not found", details={"debate_id": debate_id})
        return session

    def list(self) -> list[dict]:
        merged = {raw["id"]: raw for raw in self.store.list_meta()}
        for session in self.sessions.values():
            merged[session.id] = session.meta.model_dump(mode="json")
        return sorted(merged.values(), key=lambda item: item["created_at"], reverse=True)

    async def cancel(self, debate_id: str) -> DebateSession:
        session = self.get(debate_id)
        if session.task and not session.task.done():
            session.task.cancel()
            await asyncio.gather(session.task, return_exceptions=True)
        return session

    async def delete(self, debate_id: str) -> None:
        session = self.get(debate_id)
        if session.task and not session.task.done():
            await self.cancel(debate_id)
        self.sessions.pop(debate_id, None)
        self.store.delete(debate_id)

    async def shutdown(self) -> None:
        tasks = [s.task for s in self.sessions.values() if s.task and not s.task.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

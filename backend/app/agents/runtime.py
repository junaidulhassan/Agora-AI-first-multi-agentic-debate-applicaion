import asyncio
import json
import time
from typing import TypeVar

import httpx
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError
from tenacity import AsyncRetrying, RetryCallState, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.agents.llm_factory import build_chat_model
from app.config import Settings
from app.errors import AgentCallError, OutputValidationError
from app.logging_setup import AGENT_LOGGER, get_logger
from app.schemas.domain import AgentProfile
from app.services.session import DebateSession

log = get_logger(AGENT_LOGGER)

T = TypeVar("T", bound=BaseModel)

TRANSIENT_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529}
TRANSIENT_NAME_HINTS = (
    "timeout",
    "connection",
    "ratelimit",
    "overloaded",
    "unavailable",
    "internalserver",
    "resourceexhausted",
    "deadlineexceeded",
    "toomanyrequests",
)


def is_transient(exc: BaseException) -> bool:
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, ConnectionError, httpx.TransportError)):
        return True
    status = getattr(exc, "status_code", None)
    if status is None:
        status = getattr(getattr(exc, "response", None), "status_code", None)
    if isinstance(status, int):
        return status in TRANSIENT_STATUS
    name = type(exc).__name__.lower()
    return any(hint in name for hint in TRANSIENT_NAME_HINTS)


def message_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts)


def _strip_titles(node):
    if isinstance(node, dict):
        return {key: _strip_titles(value) for key, value in node.items() if key != "title"}
    if isinstance(node, list):
        return [_strip_titles(item) for item in node]
    return node


def schema_instruction(schema: type[BaseModel]) -> str:
    compact = json.dumps(_strip_titles(schema.model_json_schema()), separators=(",", ":"))
    return (
        "\n\nOUTPUT FORMAT\nRespond with ONE JSON object and nothing else: no prose before or after it, no markdown "
        f"fences. It must validate against this JSON Schema:\n{compact}\n"
        "Include every required field. Use null for absent optional values."
    )


def parse_structured(text: str, schema: type[T]) -> T:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    if start == -1:
        raise OutputValidationError("no JSON object found in the response")
    try:
        data, _ = json.JSONDecoder().raw_decode(cleaned[start:])
    except json.JSONDecodeError as exc:
        raise OutputValidationError(f"invalid JSON: {exc.msg} at position {exc.pos}") from exc
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        problems = "; ".join(f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()[:8])
        raise OutputValidationError(problems) from exc


class LLMRuntime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._models: dict[str, BaseChatModel] = {}

    def _model(self, agent: AgentProfile) -> BaseChatModel:
        if agent.slot not in self._models:
            self._models[agent.slot] = build_chat_model(self.settings.llm(agent.slot), self.settings.llm_timeout_seconds)
        return self._models[agent.slot]

    async def call(
        self,
        *,
        session: DebateSession,
        agent: AgentProfile,
        system: str,
        user: str,
        schema: type[T],
        purpose: str,
        turn_id: str,
        status_detail: str,
    ) -> T:
        model = self._model(agent)
        started = time.monotonic()
        messages: list[BaseMessage] = [SystemMessage(content=system + schema_instruction(schema)), HumanMessage(content=user)]
        usage_totals = {"input_tokens": 0, "output_tokens": 0}
        retries_used = 0

        log.info(
            "agent_request",
            debate_id=session.id,
            turn_id=turn_id,
            agent_id=agent.id,
            purpose=purpose,
            provider=agent.provider,
            model=agent.model,
            prompt_chars=len(system) + len(user),
        )

        heartbeat = asyncio.create_task(self._heartbeat(session, agent, turn_id, status_detail, started))
        try:
            for attempt_index in range(self.settings.llm_validation_retries + 1):
                response, retries = await self._invoke(model, messages, session, agent, turn_id, purpose, started)
                retries_used += retries
                usage = getattr(response, "usage_metadata", None) or {}
                usage_totals["input_tokens"] += int(usage.get("input_tokens", 0) or 0)
                usage_totals["output_tokens"] += int(usage.get("output_tokens", 0) or 0)
                text = message_text(response)
                try:
                    parsed = parse_structured(text, schema)
                except OutputValidationError as exc:
                    log.warning(
                        "agent_output_invalid",
                        debate_id=session.id,
                        turn_id=turn_id,
                        agent_id=agent.id,
                        purpose=purpose,
                        attempt=attempt_index + 1,
                        problem=str(exc)[:300],
                    )
                    if attempt_index >= self.settings.llm_validation_retries:
                        raise AgentCallError(
                            f"{agent.name} returned output that failed validation: {exc}",
                            agent_id=agent.id,
                            details={"purpose": purpose},
                        ) from exc
                    messages.append(AIMessage(content=text or "{}"))
                    messages.append(
                        HumanMessage(
                            content=f"Your previous reply was rejected: {exc}. Reply again with ONLY one corrected JSON object."
                        )
                    )
                    continue

                log.info(
                    "agent_response",
                    debate_id=session.id,
                    turn_id=turn_id,
                    agent_id=agent.id,
                    purpose=purpose,
                    latency_ms=round((time.monotonic() - started) * 1000),
                    retries=retries_used,
                    validation_attempts=attempt_index + 1,
                    input_tokens=usage_totals["input_tokens"],
                    output_tokens=usage_totals["output_tokens"],
                    output_chars=len(text),
                )
                return parsed
            raise AgentCallError("unreachable", agent_id=agent.id)
        except AgentCallError:
            raise
        except Exception as exc:
            log.error(
                "agent_call_failed",
                debate_id=session.id,
                turn_id=turn_id,
                agent_id=agent.id,
                purpose=purpose,
                error=type(exc).__name__,
                detail=str(exc)[:500],
                latency_ms=round((time.monotonic() - started) * 1000),
                retries=retries_used,
            )
            raise AgentCallError(
                f"{agent.name} could not respond ({type(exc).__name__}): {str(exc)[:240]}",
                agent_id=agent.id,
                details={"purpose": purpose, "provider": agent.provider, "model": agent.model, "key_variable": f"{agent.slot}_API_KEY"},
            ) from exc
        finally:
            heartbeat.cancel()

    async def _invoke(
        self,
        model: BaseChatModel,
        messages: list[BaseMessage],
        session: DebateSession,
        agent: AgentProfile,
        turn_id: str,
        purpose: str,
        started: float,
    ) -> tuple[BaseMessage, int]:
        def before_sleep(state: RetryCallState) -> None:
            exc = state.outcome.exception() if state.outcome else None
            delay = state.next_action.sleep if state.next_action else 0
            log.warning(
                "agent_retry",
                debate_id=session.id,
                turn_id=turn_id,
                agent_id=agent.id,
                purpose=purpose,
                attempt=state.attempt_number,
                error=type(exc).__name__ if exc else None,
                detail=str(exc)[:200] if exc else None,
                retry_in_s=round(delay, 1),
            )
            session.emit(
                "agent_status",
                {
                    "agent_id": agent.id,
                    "status": "waiting",
                    "detail": f"Retry {state.attempt_number} in {round(delay)}s after {type(exc).__name__ if exc else 'error'}",
                    "elapsed_s": round(time.monotonic() - started),
                    "turn_id": turn_id,
                },
                persist=False,
            )

        response: BaseMessage | None = None
        attempts = 0
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self.settings.llm_max_retries),
            wait=wait_exponential_jitter(initial=self.settings.llm_retry_min_wait, max=self.settings.llm_retry_max_wait),
            retry=retry_if_exception(is_transient),
            before_sleep=before_sleep,
            reraise=True,
        ):
            with attempt:
                attempts = attempt.retry_state.attempt_number
                response = await asyncio.wait_for(model.ainvoke(messages), timeout=self.settings.llm_timeout_seconds)
        assert response is not None
        return response, attempts - 1

    async def _heartbeat(
        self, session: DebateSession, agent: AgentProfile, turn_id: str, detail: str, started: float
    ) -> None:
        interval = self.settings.wait_notice_interval
        try:
            while True:
                await asyncio.sleep(interval)
                elapsed = round(time.monotonic() - started)
                session.emit(
                    "agent_status",
                    {
                        "agent_id": agent.id,
                        "status": "waiting",
                        "detail": f"{detail}, still waiting for {agent.name} ({elapsed}s)",
                        "elapsed_s": elapsed,
                        "turn_id": turn_id,
                    },
                    persist=False,
                )
        except asyncio.CancelledError:
            return

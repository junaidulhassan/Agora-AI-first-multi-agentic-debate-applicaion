import asyncio

from app.graph.context import DebateContext
from app.ids import new_id, utc_now
from app.schemas.domain import AgentProfile, Message, Phase

SCORE_MIN = 0.0
SCORE_MAX = 100.0


def resolve_agent_id(raw: str | None, agents: list[AgentProfile], *, allow_judge: bool = False) -> str | None:
    if not raw:
        return None
    needle = raw.strip().lower()
    candidates = [agent for agent in agents if allow_judge or agent.role == "debater"]
    for agent in candidates:
        if agent.id.lower() == needle or agent.name.lower() == needle:
            return agent.id
    for agent in candidates:
        if needle in agent.name.lower() or agent.id.lower() in needle:
            return agent.id
    return None


def debaters(agents: list[AgentProfile]) -> list[AgentProfile]:
    return [agent for agent in agents if agent.role == "debater"]


def clamp_score(value: float) -> float:
    return max(SCORE_MIN, min(SCORE_MAX, value))


def judge_message(
    ctx: DebateContext,
    *,
    kind: str,
    content: str,
    round_: int,
    phase: Phase,
    tone: str = "neutral",
    targets: list[str] | None = None,
    score_delta: float | None = None,
    meta: dict | None = None,
) -> dict:
    message = Message(
        id=new_id("msg"),
        debate_id=ctx.debate_id,
        round=round_,
        phase=phase,
        author_id="judge",
        kind=kind,
        content=content.strip(),
        tone=tone,
        targets=targets or [],
        score_delta=score_delta,
        created_at=utc_now(),
        meta=meta or {},
    )
    return ctx.publish_message(message)


def evidence_lookup(evidence: list[dict]) -> dict[str, dict]:
    return {item["id"]: item for item in evidence}


async def gather_or_cancel(coroutines: list) -> list:
    tasks = [asyncio.ensure_future(coroutine) for coroutine in coroutines]
    if not tasks:
        return []
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    for task in done:
        if task.exception() is not None:
            raise task.exception()
    return [task.result() for task in tasks]


def departed_ids(state: dict) -> set[str]:
    return {item["agent_id"] for item in state.get("departures", [])}


def describe_failure(message: str) -> str:
    text = message.lower()
    if "rate limit" in text or "ratelimit" in text or "429" in text or "resource_exhausted" in text or "quota" in text:
        return "their model kept hitting its provider's rate limit"
    if "401" in text or "403" in text or "authentication" in text or "api key" in text or "permission" in text:
        return "their API key was rejected"
    if "404" in text or "not found" in text or "no longer available" in text:
        return "their model is not available"
    if "413" in text or "too large" in text:
        return "their request was too large for the model"
    if "timeout" in text or "timed out" in text:
        return "their provider timed out repeatedly"
    if "503" in text or "overloaded" in text or "unavailable" in text or "529" in text:
        return "their provider was overloaded or unavailable"
    if "validation" in text or "valid" in text:
        return "their model could not produce a usable answer"
    return "of a technical failure"

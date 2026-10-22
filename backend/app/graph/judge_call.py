from typing import TypeVar

import structlog
from pydantic import BaseModel

from app.agents import prompts
from app.agents.personas import JUDGE_ID
from app.graph.context import DebateContext
from app.ids import new_id
from app.schemas.domain import AgentProfile

T = TypeVar("T", bound=BaseModel)


def judge_budgets(ctx: DebateContext) -> tuple[int, int]:
    transcript, evidence = prompts.prompt_budgets(ctx.settings.llm("JUDGE").max_input_tokens)
    return transcript, evidence // 2


async def judge_call(
    ctx: DebateContext,
    agents: list[AgentProfile],
    *,
    purpose: str,
    detail: str,
    user: str,
    schema: type[T],
) -> T:
    judge = next(agent for agent in agents if agent.id == JUDGE_ID)
    turn_id = new_id("turn")
    structlog.contextvars.bind_contextvars(debate_id=ctx.debate_id, turn_id=turn_id, agent_id=JUDGE_ID)
    try:
        ctx.set_status(JUDGE_ID, "thinking", detail, turn_id)
        result = await ctx.runtime.call(
            session=ctx.session,
            agent=judge,
            system=prompts.judge_system(agents),
            user=user,
            schema=schema,
            purpose=purpose,
            turn_id=turn_id,
            status_detail=detail,
        )
        ctx.set_status(JUDGE_ID, "idle", None, turn_id)
        return result
    finally:
        structlog.contextvars.unbind_contextvars("debate_id", "turn_id", "agent_id")

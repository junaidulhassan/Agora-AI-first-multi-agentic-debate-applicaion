from langchain_core.runnables import RunnableConfig

from app.graph.context import get_context, parse_agents
from app.graph.helpers import debaters, gather_or_cancel
from app.graph.state import DebateState
from app.graph.turns import TurnResult, run_debater_turn


def _collect(results: list[TurnResult]) -> dict:
    return {
        "messages": [item for result in results for item in (result.message, *result.replies)],
        "evidence": [item for result in results for item in result.evidence],
        "interactions": [item for result in results for item in result.interactions],
    }


async def opening_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    panel = debaters(agents)
    ctx.enter_phase("opening", 0)

    def turn(agent):
        return run_debater_turn(
            ctx, state, agents, agent, mode="opening", round_=0, local_messages=[], local_evidence=[]
        )

    if ctx.settings.parallel_openings:
        results = await gather_or_cancel([turn(agent) for agent in panel])
    else:
        results = [await turn(agent) for agent in panel]
    return {"round": 0, **_collect(results)}


async def rebuttal_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    by_id = {agent.id: agent for agent in debaters(agents)}
    round_ = state.get("round", 0) + 1
    ctx.enter_phase("rebuttal", round_)

    plan = state.get("round_plan") or {}
    order = [agent_id for agent_id in plan.get("order", []) if agent_id in by_id]
    order += [agent_id for agent_id in by_id if agent_id not in order]
    assignments = plan.get("assignments", {})

    if ctx.settings.parallel_rebuttals:
        results = await gather_or_cancel(
            [
                run_debater_turn(
                    ctx,
                    state,
                    agents,
                    by_id[agent_id],
                    mode="rebuttal",
                    round_=round_,
                    local_messages=[],
                    local_evidence=[],
                    assignment=assignments.get(agent_id),
                )
                for agent_id in order
            ]
        )
    else:
        results = []
        local_messages: list[dict] = []
        local_evidence: list[dict] = []
        for agent_id in order:
            result = await run_debater_turn(
                ctx,
                state,
                agents,
                by_id[agent_id],
                mode="rebuttal",
                round_=round_,
                local_messages=local_messages,
                local_evidence=local_evidence,
                assignment=assignments.get(agent_id),
            )
            results.append(result)
            local_messages.extend([result.message, *result.replies])
            local_evidence.extend(result.evidence)

    return {"round": round_, **_collect(results)}

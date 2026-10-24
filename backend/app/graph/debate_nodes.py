from langchain_core.runnables import RunnableConfig

from app.errors import PanelCollapsedError
from app.graph.context import DebateContext, get_context, parse_agents
from app.graph.helpers import debaters, departed_ids, gather_or_cancel
from app.graph.state import DebateState
from app.graph.turns import TurnResult, run_debater_turn

MIN_ACTIVE_DEBATERS = 2


def _collect(results: list[TurnResult]) -> dict:
    return {
        "messages": [item for result in results for item in (result.message, *result.replies)],
        "evidence": [item for result in results for item in result.evidence],
        "interactions": [item for result in results for item in result.interactions],
        "departures": [result.departure for result in results if result.departure],
    }


def _ensure_panel(ctx: DebateContext, remaining: int) -> None:
    if remaining < MIN_ACTIVE_DEBATERS:
        raise PanelCollapsedError(
            "Too many debaters left the debate, so it cannot continue.",
            details={"remaining": remaining, "minimum": MIN_ACTIVE_DEBATERS},
        )


async def opening_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    panel = debaters(agents)
    ctx.enter_phase("opening", 0)

    def turn(agent):
        return run_debater_turn(
            ctx,
            state,
            agents,
            agent,
            mode="opening",
            round_=0,
            local_messages=[],
            local_evidence=[],
            departed=set(),
        )

    if ctx.settings.parallel_openings:
        results = await gather_or_cancel([turn(agent) for agent in panel])
    else:
        results = [await turn(agent) for agent in panel]
    update = _collect(results)
    _ensure_panel(ctx, len(panel) - len(update["departures"]))
    return {"round": 0, **update}


async def rebuttal_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    gone = departed_ids(state)
    by_id = {agent.id: agent for agent in debaters(agents) if agent.id not in gone}
    _ensure_panel(ctx, len(by_id))
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
                    departed=set(gone),
                    assignment=assignments.get(agent_id),
                )
                for agent_id in order
            ]
        )
    else:
        results = []
        local_messages: list[dict] = []
        local_evidence: list[dict] = []
        left_now = set(gone)
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
                departed=set(left_now),
                assignment=assignments.get(agent_id),
            )
            results.append(result)
            local_messages.extend([result.message, *result.replies])
            local_evidence.extend(result.evidence)
            if result.departure:
                left_now.add(result.departure["agent_id"])

    update = _collect(results)
    _ensure_panel(ctx, len(by_id) - len(update["departures"]))
    return {"round": round_, **update}

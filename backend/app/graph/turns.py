import asyncio
import re
from dataclasses import dataclass, field

import structlog

from app.agents import prompts
from app.graph.context import DebateContext
from app.agents.personas import JUDGE_ID
from app.graph.helpers import evidence_lookup, judge_message, resolve_agent_id
from app.graph.judge_call import judge_budgets, judge_call
from app.ids import new_id, utc_now
from app.logging_setup import get_logger
from app.schemas.domain import AgentProfile, Engagement, Evidence, Message
from app.schemas.llm import DebaterTurn, JudgeReply, SearchPlan
from app.services.search import SearchOutcome

log = get_logger()

CITATION_PATTERN = re.compile(r"\[E\d+\]")


@dataclass
class TurnResult:
    message: dict
    evidence: list[dict] = field(default_factory=list)
    interactions: list[dict] = field(default_factory=list)
    replies: list[dict] = field(default_factory=list)


def _register_evidence(
    ctx: DebateContext, agent: AgentProfile, outcome: SearchOutcome
) -> tuple[list[dict], list[dict]]:
    created: list[dict] = []
    referenced: list[dict] = []
    for result in outcome.results:
        known = ctx.session.evidence_by_url.get(result.url)
        if known:
            referenced.append(known)
            continue
        evidence_id = ctx.session.allocate_evidence_id()
        evidence = Evidence(
            id=evidence_id,
            debate_id=ctx.debate_id,
            agent_id=agent.id,
            query=outcome.query,
            title=result.title,
            url=result.url,
            domain=result.domain,
            snippet=result.snippet,
            score=result.score,
            verified=True,
            retrieved_at=utc_now(),
        )
        data = evidence.model_dump(mode="json")
        ctx.session.evidence_by_url[result.url] = data
        ctx.session.emit("evidence_added", {"evidence": data})
        created.append(data)
        referenced.append(data)
    return created, referenced


async def run_debater_turn(
    ctx: DebateContext,
    state: dict,
    agents: list[AgentProfile],
    agent: AgentProfile,
    *,
    mode: str,
    round_: int,
    local_messages: list[dict],
    local_evidence: list[dict],
    assignment: dict | None = None,
) -> TurnResult:
    turn_id = new_id("turn")
    structlog.contextvars.bind_contextvars(debate_id=ctx.debate_id, turn_id=turn_id, agent_id=agent.id)
    try:
        messages = [*state.get("messages", []), *local_messages]
        evidence = [*state.get("evidence", []), *local_evidence]
        analysis = state.get("analysis", {})
        question = state["question"]
        scores = prompts.render_scores(state.get("scores", {}), agents)
        conflicts = prompts.render_conflicts(state.get("conflicts", []), agents)
        transcript_budget, evidence_budget = prompts.prompt_budgets(ctx.settings.llm(agent.slot).max_input_tokens)
        transcript = prompts.render_transcript(messages, agents, round_, transcript_budget)
        directive = (state.get("directives") or {}).get(agent.id)
        assignment_directive = (assignment or {}).get("directive")
        directive = " ".join(part for part in (directive, assignment_directive) if part) or None
        targets = (assignment or {}).get("targets", [])
        stances: dict[str, str] = {}
        for item in messages:
            if item.get("stance") and item["author_id"] != agent.id:
                stances[item["author_id"]] = item["stance"]
        focus = agent.focus
        locked_stance = next(
            (m["stance"] for m in messages if m["author_id"] == agent.id and m["kind"] == "opening" and m.get("stance")),
            None,
        )
        current = state.get("round", 0)
        notes = [
            item["message"]
            for item in state.get("penalties", [])
            if item["agent_id"] == agent.id and item["round"] == current
        ]
        notes += [
            f"(your challenge to the Judge was {item['meta'].get('outcome', 'answered')}) {item['content']}"
            for item in messages
            if item["kind"] == "judge_reply" and agent.id in item["targets"] and item["round"] == current
        ]
        judge_note = " ".join(notes) or None

        ctx.set_status(agent.id, "thinking", "Planning research", turn_id)
        max_queries = ctx.settings.max_searches_per_turn
        queries: list[str] = []
        if max_queries > 0:
            plan = await ctx.runtime.call(
                session=ctx.session,
                agent=agent,
                system=prompts.debater_system(agent),
                user=prompts.search_plan_user(
                    agent,
                    question,
                    mode,
                    transcript,
                    prompts.render_evidence(evidence, evidence_budget // 2, 140),
                    focus,
                    directive,
                    max_queries,
                ),
                schema=SearchPlan,
                purpose=f"{mode}_search_plan",
                turn_id=turn_id,
                status_detail="Planning research",
            )
            queries = plan.queries[:max_queries]

        new_evidence: list[dict] = []
        fresh: list[dict] = []
        failures: list[str] = []
        if queries:
            ctx.set_status(agent.id, "searching", " | ".join(queries), turn_id)
            ctx.session.emit("search_started", {"agent_id": agent.id, "queries": queries, "turn_id": turn_id})
            outcomes = await asyncio.gather(
                *(ctx.search.search(query, agent_id=agent.id, debate_id=ctx.debate_id) for query in queries)
            )
            for outcome in outcomes:
                created, referenced = _register_evidence(ctx, agent, outcome)
                new_evidence.extend(created)
                fresh.extend(referenced)
                if not outcome.verified:
                    failures.append(f"'{outcome.query}': {outcome.error or 'no results'}")
                    ctx.session.emit(
                        "search_failed",
                        {"agent_id": agent.id, "query": outcome.query, "error": outcome.error or "no results", "turn_id": turn_id},
                    )

        known_ids = {item["id"] for item in evidence}
        pool = [*evidence, *{item["id"]: item for item in fresh if item["id"] not in known_ids}.values()]
        notes = []
        if fresh:
            notes.append(f"Evidence you just retrieved: {', '.join(dict.fromkeys(item['id'] for item in fresh))}.")
        if failures:
            notes.append(
                "WEB VERIFICATION FAILED for: " + "; ".join(failures) + ". Claims that depend on these searches are "
                "UNVERIFIED; say so explicitly and do not present them as established fact."
            )
        if not queries:
            notes.append("You ran no new searches this turn; rely on the existing evidence pool and flag anything unsourced.")

        ctx.set_status(agent.id, "thinking", "Drafting argument", turn_id)
        turn = await ctx.runtime.call(
            session=ctx.session,
            agent=agent,
            system=prompts.debater_system(agent),
            user=prompts.turn_user(
                agent,
                question,
                analysis,
                mode,
                round_,
                transcript,
                prompts.render_evidence(pool, evidence_budget),
                scores,
                conflicts,
                focus,
                directive,
                targets,
                "\n".join(notes),
                agents,
                judge_note,
                locked_stance,
                stances,
            ),
            schema=DebaterTurn,
            purpose=f"{mode}_argument",
            turn_id=turn_id,
            status_detail="Drafting argument",
        )

        result = _finalize_turn(ctx, agent, agents, turn, mode, round_, turn_id, pool)
        result.evidence = new_evidence
        challenges = [e for e in result.message["engagements"] if e["kind"] == "challenge"]
        if challenges:
            reply = await _answer_challenge(ctx, state, agents, agent, result, challenges, local_messages, round_)
            if reply:
                result.replies.append(reply)
        ctx.set_status(agent.id, "idle", None, turn_id)
        return result
    finally:
        structlog.contextvars.unbind_contextvars("debate_id", "turn_id", "agent_id")


def _finalize_turn(
    ctx: DebateContext,
    agent: AgentProfile,
    agents: list[AgentProfile],
    turn: DebaterTurn,
    mode: str,
    round_: int,
    turn_id: str,
    pool: list[dict],
) -> TurnResult:
    lookup = evidence_lookup(pool)

    def keep(match: re.Match) -> str:
        return match.group(0) if match.group(0)[1:-1] in lookup else ""

    content = CITATION_PATTERN.sub(keep, turn.message).replace("  ", " ").strip()
    cited = list(
        dict.fromkeys(
            [c.strip("[]") for c in turn.citations if c.strip("[]") in lookup]
            + [m[1:-1] for m in CITATION_PATTERN.findall(content)]
        )
    )
    unverified = not any(lookup[c].get("verified", True) for c in cited)

    engagements: list[Engagement] = []
    seen: set[tuple[str, str]] = set()
    for item in turn.engagements:
        target = resolve_agent_id(item.target_agent_id, agents, allow_judge=True)
        kind = "challenge" if target == JUDGE_ID else item.kind
        if kind == "challenge" and target != JUDGE_ID:
            kind = "rebuttal"
        if not target or target == agent.id or (target, kind) in seen:
            continue
        seen.add((target, kind))
        engagements.append(
            Engagement(
                target_id=target,
                kind=kind,
                point=item.point.strip(),
                fallacy=item.fallacy.strip() if item.fallacy else None,
            )
        )

    message = Message(
        id=new_id("msg"),
        debate_id=ctx.debate_id,
        round=round_,
        phase="opening" if mode == "opening" else "rebuttal",
        author_id=agent.id,
        kind="opening" if mode == "opening" else "rebuttal",
        content=content,
        stance=turn.stance,
        confidence=turn.confidence,
        targets=[e.target_id for e in engagements],
        engagements=engagements,
        citations=cited,
        unverified=unverified,
        turn_id=turn_id,
        created_at=utc_now(),
        meta={"claims": turn.claims},
    )
    data = ctx.publish_message(message)

    interactions = []
    for engagement in engagements:
        interaction = ctx.make_interaction(
            round_=round_,
            source=agent.id,
            target=engagement.target_id,
            kind=engagement.kind,
            summary=engagement.point,
            unverified=unverified,
            message_id=message.id,
        )
        interactions.append(ctx.publish_interaction(interaction))
    log.info(
        "agent_turn_completed",
        agent_id=agent.id,
        mode=mode,
        round=round_,
        citations=len(cited),
        engagements=len(engagements),
        unverified=unverified,
    )
    return TurnResult(message=data, interactions=interactions)


async def _answer_challenge(
    ctx: DebateContext,
    state: dict,
    agents: list[AgentProfile],
    agent: AgentProfile,
    result: TurnResult,
    challenges: list[dict],
    local_messages: list[dict],
    round_: int,
) -> dict:
    messages = [*state.get("messages", []), *local_messages, result.message]
    transcript_budget = judge_budgets(ctx)[0]
    names = {item.id: item.name for item in agents}
    rulings = "\n".join(f"Round {r['round']}: {r['summary']}" for r in state.get("rulings", [])[-2:]) or "(none yet)"
    penalties = "\n".join(
        f"- round {p['round']}: {names.get(p['agent_id'], p['agent_id'])} {p['kind']} ({p['delta']:+.0f}): {p['message']}"
        for p in state.get("penalties", [])[-10:]
    ) or "(none)"
    reply = await judge_call(
        ctx,
        agents,
        purpose="challenge_reply",
        detail=f"Answering {agent.name}'s challenge",
        user=prompts.challenge_reply_user(
            state["question"],
            agent,
            result.message.get("stance"),
            " ".join(item["point"] for item in challenges),
            result.message["content"],
            rulings,
            prompts.render_scores(state.get("scores", {}), agents),
            penalties,
            prompts.render_transcript(messages[-12:], agents, round_, transcript_budget),
        ),
        schema=JudgeReply,
    )
    delta = reply.score_delta
    if reply.outcome == "rejected" and delta > 0:
        delta = -delta
    if reply.outcome == "upheld" and delta < 0:
        delta = -delta
    kind = "reward" if reply.outcome == "upheld" else "reprimand" if reply.outcome == "rejected" else "warning"
    message = judge_message(
        ctx,
        kind="judge_reply",
        content=reply.message,
        round_=round_,
        phase="rebuttal",
        tone=reply.tone,
        targets=[agent.id],
        score_delta=delta,
        meta={"outcome": reply.outcome, "challenge": " ".join(item["point"] for item in challenges)},
    )
    interaction = ctx.publish_interaction(
        ctx.make_interaction(
            round_=round_,
            source=JUDGE_ID,
            target=agent.id,
            kind=kind,
            summary=reply.message,
            message_id=message["id"],
        )
    )
    ctx.session.emit(
        "judge_action",
        {
            "action": {
                "kind": kind,
                "target_id": agent.id,
                "tone": reply.tone,
                "score_delta": delta,
                "message_id": message["id"],
                "round": round_,
            }
        },
    )
    result.interactions.append(interaction)
    return message

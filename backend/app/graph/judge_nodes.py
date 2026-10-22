from collections import defaultdict
from langchain_core.runnables import RunnableConfig

from app.agents import prompts
from app.agents.personas import JUDGE_ID, SPECIALIST_ID, build_specialist, specialist_available
from app.graph.context import DebateContext, get_context, parse_agents
from app.graph.judge_call import judge_budgets, judge_call
from app.graph.helpers import clamp_score, debaters, judge_message, resolve_agent_id
from app.graph.state import DebateState
from app.logging_setup import get_logger
from app.schemas.domain import Conflict
from app.schemas.llm import (
    ConflictReport,
    ConvergenceAssessment,
    FinalVerdict,
    QuestionAnalysis,
    RoundRuling,
)

log = get_logger()

MAX_CONFLICTS = 8
DELTA_FLOOR = -25.0
DELTA_CEILING = 20.0


def _emit_scores(ctx: DebateContext, scores: dict[str, float], deltas: dict[str, float], reasons: dict[str, str], round_: int) -> None:
    ctx.session.emit(
        "scores_updated",
        {
            "round": round_,
            "scores": {
                agent_id: {"score": round(score, 1), "delta": round(deltas.get(agent_id, 0.0), 1), "reason": reasons.get(agent_id, "")}
                for agent_id, score in scores.items()
            },
        },
    )


async def intake_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    ctx.enter_phase("intake", 0)

    use_specialist = specialist_available(ctx.settings)
    analysis = await judge_call(
        ctx,
        agents,
        purpose="intake",
        detail="Analyzing the question",
        user=prompts.intake_user(state["question"], state["topic"], agents, use_specialist),
        schema=QuestionAnalysis,
    )

    if use_specialist and analysis.specialist:
        brief_for_specialist = next(
            (brief.focus for brief in analysis.agent_briefs if brief.agent_id.lower() in {SPECIALIST_ID, "specialist"}), None
        )
        agents.append(build_specialist(ctx.settings, analysis.specialist, brief_for_specialist))

    for brief in analysis.agent_briefs:
        target = resolve_agent_id(brief.agent_id, agents)
        if target:
            for agent in agents:
                if agent.id == target:
                    agent.focus = brief.focus

    panel_data = [agent.model_dump(mode="json") for agent in agents]
    ctx.session.emit("panel_updated", {"agents": panel_data})

    scores = {agent.id: ctx.settings.initial_score for agent in debaters(agents)}
    _emit_scores(ctx, scores, {}, {}, 0)

    analysis_data = analysis.model_dump(mode="json")
    message = judge_message(
        ctx,
        kind="analysis",
        content=analysis.moderator_statement,
        round_=0,
        phase="intake",
        tone="stern",
        targets=[agent.id for agent in debaters(agents)],
        meta={
            "refined_question": analysis.refined_question,
            "category": analysis.category,
            "positions": analysis.candidate_positions,
            "definitions": analysis.key_definitions,
            "core_claims": analysis.core_claims,
        },
    )
    return {
        "agents": panel_data,
        "analysis": analysis_data,
        "scores": scores,
        "round": 0,
        "directives": {},
        "conflicts": [],
        "messages": [message],
    }


def _match_existing(item_issue: str, existing_id: str | None, existing: dict[str, dict]) -> dict | None:
    if existing_id and existing_id in existing:
        return existing[existing_id]
    needle = item_issue.strip().lower()
    for conflict in existing.values():
        issue = conflict["issue"].strip().lower()
        if issue == needle or issue in needle or needle in issue:
            return conflict
    return None


async def conflicts_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    round_ = state.get("round", 0)
    ctx.enter_phase("conflicts", round_)

    panel = debaters(agents)
    existing = {conflict["id"]: conflict for conflict in state.get("conflicts", [])}
    report = await judge_call(
        ctx,
        agents,
        purpose="conflict_detection",
        detail="Detecting conflicts and setting turn order",
        user=prompts.conflicts_user(
            state["question"],
            prompts.render_transcript(state.get("messages", []), agents, round_, judge_budgets(ctx)[0]),
            prompts.render_conflicts(list(existing.values()), agents),
            prompts.render_scores(state.get("scores", {}), agents),
            agents,
            round_,
            round_ + 1,
        ),
        schema=ConflictReport,
    )

    counter = len(existing)
    updated: dict[str, dict] = {}
    for item in report.conflicts[:MAX_CONFLICTS]:
        positions = {}
        for position in item.positions:
            agent_id = resolve_agent_id(position.agent_id, agents)
            if agent_id:
                positions[agent_id] = position.claim.strip()
        if len(positions) < 2:
            continue
        previous = _match_existing(item.issue, item.existing_id, existing)
        if previous:
            conflict_id = previous["id"]
        else:
            counter += 1
            conflict_id = f"C{counter}"
        conflict = Conflict(
            id=conflict_id,
            issue=item.issue.strip(),
            agents=list(positions),
            positions=positions,
            status=item.status,
            round_opened=previous["round_opened"] if previous else round_,
            round_updated=round_,
            winner=previous.get("winner") if previous else None,
            resolution=previous.get("resolution") if previous else None,
        )
        updated[conflict_id] = conflict.model_dump(mode="json")
    for conflict_id, conflict in existing.items():
        if conflict_id not in updated and conflict["status"] != "resolved":
            updated[conflict_id] = conflict
    conflicts = list(updated.values())
    ctx.session.emit("conflicts_updated", {"conflicts": conflicts, "round": round_})

    order = []
    for raw in report.speaking_order:
        agent_id = resolve_agent_id(raw, agents)
        if agent_id and agent_id not in order:
            order.append(agent_id)
    order += [agent.id for agent in panel if agent.id not in order]

    assignments: dict[str, dict] = {}
    for assignment in report.assignments:
        agent_id = resolve_agent_id(assignment.agent_id, agents)
        if not agent_id:
            continue
        targets = [t for t in (resolve_agent_id(raw, agents) for raw in assignment.targets) if t and t != agent_id]
        assignments[agent_id] = {
            "targets": targets,
            "conflict_issues": assignment.conflict_issues,
            "directive": assignment.directive.strip(),
        }

    names = {agent.id: agent.name for agent in agents}
    interactions = []
    for agent_id, assignment in assignments.items():
        interaction = ctx.make_interaction(
            round_=round_,
            source=JUDGE_ID,
            target=agent_id,
            kind="instruction",
            summary=assignment["directive"],
        )
        interactions.append(ctx.publish_interaction(interaction))

    message = judge_message(
        ctx,
        kind="conflict_report",
        content=report.moderator_notice,
        round_=round_,
        phase="conflicts",
        tone="stern",
        targets=order,
        meta={
            "speaking_order": [names[agent_id] for agent_id in order],
            "conflicts": [{"id": c["id"], "issue": c["issue"], "status": c["status"]} for c in conflicts],
        },
    )
    return {
        "conflicts": conflicts,
        "round_plan": {"round": round_ + 1, "order": order, "assignments": assignments},
        "messages": [message],
        "interactions": interactions,
    }


def _find_conflict(issue: str, conflicts: dict[str, dict]) -> dict | None:
    return _match_existing(issue, None, conflicts)


async def ruling_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    round_ = state.get("round", 0)
    ctx.enter_phase("ruling", round_)
    names = {agent.id: agent.name for agent in agents}

    this_round = [
        m
        for m in state.get("messages", [])
        if m["round"] == round_ and (m["author_id"] != JUDGE_ID or m["kind"] == "judge_reply")
    ]
    penalties_text = "\n".join(
        f"- round {p['round']}: {names.get(p['agent_id'], p['agent_id'])} {p['kind']} ({p['delta']:+.0f}): {p['message']}"
        for p in state.get("penalties", [])[-12:]
    ) or "(none)"

    ruling = await judge_call(
        ctx,
        agents,
        purpose="round_ruling",
        detail="Evaluating arguments and ruling",
        user=prompts.ruling_user(
            state["question"],
            round_,
            prompts.render_transcript(this_round, agents, round_, judge_budgets(ctx)[0]),
            prompts.render_conflicts(state.get("conflicts", []), agents),
            prompts.render_scores(state.get("scores", {}), agents),
            prompts.render_evidence(state.get("evidence", []), judge_budgets(ctx)[1], 0),
            penalties_text,
        ),
        schema=RoundRuling,
    )

    deltas: dict[str, float] = defaultdict(float)
    reasons: dict[str, list[str]] = defaultdict(list)
    evaluations = []
    interactions = []
    for evaluation in ruling.evaluations:
        agent_id = resolve_agent_id(evaluation.agent_id, agents)
        if not agent_id:
            continue
        deltas[agent_id] += evaluation.score_delta
        note = evaluation.strengths if evaluation.score_delta >= 0 else evaluation.weaknesses
        if note:
            reasons[agent_id].append(note)
        evaluations.append(
            {
                "agent_id": agent_id,
                "logical_validity": evaluation.logical_validity,
                "evidence_quality": evaluation.evidence_quality,
                "relevance": evaluation.relevance,
                "fallacies": evaluation.fallacies,
                "strengths": evaluation.strengths,
                "weaknesses": evaluation.weaknesses,
                "score_delta": evaluation.score_delta,
            }
        )
        interaction = ctx.make_interaction(
            round_=round_,
            source=JUDGE_ID,
            target=agent_id,
            kind="ruling",
            summary=f"Validity {evaluation.logical_validity:.0f}/10, evidence {evaluation.evidence_quality:.0f}/10, relevance {evaluation.relevance:.0f}/10",
        )
        interactions.append(ctx.publish_interaction(interaction))

    conflicts = {conflict["id"]: dict(conflict) for conflict in state.get("conflicts", [])}
    conflict_rulings = []
    for item in ruling.conflict_rulings:
        conflict = _find_conflict(item.issue, conflicts)
        if not conflict:
            continue
        winner = resolve_agent_id(item.winner_agent_id, agents)
        conflict.update(
            status=item.status,
            winner=winner if winner in conflict["agents"] else None,
            resolution=item.reasoning.strip(),
            round_updated=round_,
        )
        conflict_rulings.append(
            {"conflict_id": conflict["id"], "issue": conflict["issue"], "winner": conflict["winner"], "reasoning": conflict["resolution"], "status": item.status}
        )
    conflict_list = list(conflicts.values())
    ctx.session.emit("conflicts_updated", {"conflicts": conflict_list, "round": round_})

    summary_message = judge_message(
        ctx,
        kind="ruling",
        content=ruling.summary,
        round_=round_,
        phase="ruling",
        tone="stern",
        targets=[e["agent_id"] for e in evaluations],
        meta={"evaluations": evaluations, "conflict_rulings": conflict_rulings},
    )

    for reply in this_round:
        if reply["kind"] == "judge_reply" and reply.get("score_delta"):
            for target in reply["targets"]:
                deltas[target] += reply["score_delta"]
                reasons[target].append(f"Challenge to the Judge: {reply['score_delta']:+.0f}")
    messages = [summary_message]
    penalties = []
    directives: dict[str, str] = {}
    for action in ruling.actions[:6]:
        agent_id = resolve_agent_id(action.target_agent_id, agents)
        if not agent_id:
            continue
        delta = action.score_delta
        if action.kind in {"penalty", "reprimand"} and delta > 0:
            delta = -abs(delta)
        if action.kind == "reward" and delta < 0:
            delta = abs(delta)
        deltas[agent_id] += delta
        reasons[agent_id].append(action.message)
        if action.directive:
            directives[agent_id] = action.directive.strip()
        message = judge_message(
            ctx,
            kind=action.kind,
            content=action.message,
            round_=round_,
            phase="ruling",
            tone=action.tone,
            targets=[agent_id],
            score_delta=delta,
            meta={"directive": action.directive},
        )
        messages.append(message)
        interaction = ctx.make_interaction(
            round_=round_,
            source=JUDGE_ID,
            target=agent_id,
            kind=action.kind,
            summary=action.message,
            message_id=message["id"],
        )
        interactions.append(ctx.publish_interaction(interaction))
        ctx.session.emit(
            "judge_action",
            {
                "action": {
                    "kind": action.kind,
                    "target_id": agent_id,
                    "tone": action.tone,
                    "score_delta": delta,
                    "message_id": message["id"],
                    "round": round_,
                }
            },
        )
        if delta < 0:
            penalties.append({"round": round_, "agent_id": agent_id, "kind": action.kind, "delta": delta, "message": action.message})

    scores = dict(state.get("scores", {}))
    applied: dict[str, float] = {}
    for agent_id in scores:
        total = max(DELTA_FLOOR, min(DELTA_CEILING, deltas.get(agent_id, 0.0)))
        updated = clamp_score(scores[agent_id] + total)
        applied[agent_id] = updated - scores[agent_id]
        scores[agent_id] = updated
    _emit_scores(ctx, scores, applied, {k: " ".join(v)[:240] for k, v in reasons.items()}, round_)

    record = {
        "round": round_,
        "summary": ruling.summary,
        "evaluations": evaluations,
        "conflict_rulings": conflict_rulings,
        "deltas": {k: round(v, 1) for k, v in applied.items()},
    }
    ctx.session.emit("ruling", {"ruling": record})
    log.info("round_ruled", round=round_, deltas=record["deltas"], actions=len(ruling.actions))

    return {
        "scores": scores,
        "conflicts": conflict_list,
        "directives": directives,
        "rulings": [record],
        "penalties": penalties,
        "messages": messages,
        "interactions": interactions,
    }


async def convergence_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    round_ = state.get("round", 0)
    settings = ctx.settings
    ctx.enter_phase("convergence", round_)

    if round_ < settings.min_rounds:
        assessment = {
            "converged": False,
            "stalled": False,
            "consensus_level": 0.0,
            "reasoning": f"Cross-examination is mandatory: {round_} of {settings.min_rounds} minimum rounds completed.",
            "outstanding": [c["issue"] for c in state.get("conflicts", []) if c["status"] != "resolved"],
            "forced": False,
        }
        converged = False
    else:
        result = await judge_call(
            ctx,
            agents,
            purpose="convergence",
            detail="Checking whether the debate has converged",
            user=prompts.convergence_user(
                state["question"],
                round_,
                settings.min_rounds,
                settings.max_rounds,
                prompts.render_transcript(state.get("messages", [])[-24:], agents, round_, judge_budgets(ctx)[0]),
                prompts.render_conflicts(state.get("conflicts", []), agents),
                prompts.render_scores(state.get("scores", {}), agents),
            ),
            schema=ConvergenceAssessment,
        )
        forced = round_ >= settings.max_rounds and not result.converged
        converged = result.converged or result.stalled or round_ >= settings.max_rounds
        assessment = {**result.model_dump(mode="json"), "forced": forced}
        if forced:
            assessment["reasoning"] = f"Round limit reached. {result.reasoning}"

    assessment["round"] = round_
    assessment["converged"] = converged
    ctx.session.emit("convergence", assessment)

    message = judge_message(
        ctx,
        kind="convergence",
        content=assessment["reasoning"],
        round_=round_,
        phase="convergence",
        tone="neutral",
        meta={"converged": converged, "consensus_level": assessment["consensus_level"], "outstanding": assessment["outstanding"]},
    )
    return {"converged": converged, "convergence": assessment, "messages": [message]}


def route_after_convergence(state: DebateState) -> str:
    return "verdict" if state.get("converged") else "rebuttal"


async def verdict_node(state: DebateState, config: RunnableConfig) -> dict:
    ctx = get_context(config)
    agents = parse_agents(state)
    round_ = state.get("round", 0)
    ctx.enter_phase("verdict", round_)
    names = {agent.id: agent.name for agent in agents}

    rulings_text = "\n".join(f"Round {r['round']}: {r['summary']}" for r in state.get("rulings", [])) or "(none)"
    verdict = await judge_call(
        ctx,
        agents,
        purpose="final_verdict",
        detail="Deliberating the final verdict",
        user=prompts.verdict_user(
            state["question"],
            state.get("analysis", {}),
            prompts.render_transcript(state.get("messages", []), agents, round_, judge_budgets(ctx)[0]),
            prompts.render_conflicts(state.get("conflicts", []), agents),
            rulings_text,
            prompts.render_scores(state.get("scores", {}), agents),
            prompts.render_evidence(state.get("evidence", []), judge_budgets(ctx)[1], 0),
        ),
        schema=FinalVerdict,
    )

    evidence_ids = {item["id"] for item in state.get("evidence", [])}
    data = verdict.model_dump(mode="json")
    for key in ("winning_arguments", "rejected_arguments"):
        cleaned = []
        for item in data[key]:
            agent_id = resolve_agent_id(item["agent_id"], agents)
            if agent_id:
                cleaned.append({**item, "agent_id": agent_id})
        data[key] = cleaned
    data["key_evidence_ids"] = [e for e in data["key_evidence_ids"] if e in evidence_ids]
    data["standings"] = [
        {"agent_id": agent_id, "name": names.get(agent_id, agent_id), "score": round(score, 1)}
        for agent_id, score in sorted(state.get("scores", {}).items(), key=lambda pair: -pair[1])
    ]
    data["rounds"] = round_
    data["question"] = state["question"]

    ctx.session.emit("verdict", {"verdict": data})
    ctx.session.update_meta(verdict_headline=verdict.headline)
    message = judge_message(
        ctx,
        kind="verdict",
        content=verdict.answer,
        round_=round_,
        phase="verdict",
        tone="neutral",
        meta={"headline": verdict.headline, "confidence": verdict.confidence, "consensus": verdict.consensus},
    )
    ctx.enter_phase("completed", round_)
    return {"verdict": data, "messages": [message]}

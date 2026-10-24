import operator
from typing import Annotated, Any, TypedDict


class DebateState(TypedDict, total=False):
    debate_id: str
    question: str
    topic: str
    agents: list[dict]
    analysis: dict
    messages: Annotated[list[dict], operator.add]
    evidence: Annotated[list[dict], operator.add]
    interactions: Annotated[list[dict], operator.add]
    rulings: Annotated[list[dict], operator.add]
    penalties: Annotated[list[dict], operator.add]
    departures: Annotated[list[dict], operator.add]
    conflicts: list[dict]
    scores: dict[str, float]
    directives: dict[str, str]
    round: int
    round_plan: dict[str, Any]
    convergence: dict[str, Any]
    converged: bool
    verdict: dict[str, Any]

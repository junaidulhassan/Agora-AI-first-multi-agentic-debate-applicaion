from typing import Literal

from pydantic import BaseModel, Field, field_validator


MAX_MESSAGE_WORDS = 90


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


class AgentBrief(BaseModel):
    agent_id: str
    focus: str


class SpecialistSpec(BaseModel):
    title: str
    domain: str
    persona: str
    reasoning_style: str
    bias: str


class QuestionAnalysis(BaseModel):
    refined_question: str
    category: str
    core_claims: list[str] = Field(default_factory=list)
    candidate_positions: list[str] = Field(default_factory=list)
    key_definitions: list[str] = Field(default_factory=list)
    evidence_needs: list[str] = Field(default_factory=list)
    agent_briefs: list[AgentBrief] = Field(default_factory=list)
    specialist: SpecialistSpec | None = None
    moderator_statement: str


class SearchPlan(BaseModel):
    goal: str
    queries: list[str] = Field(default_factory=list)

    @field_validator("queries", mode="before")
    @classmethod
    def listify(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        return value

    @field_validator("queries")
    @classmethod
    def clean_queries(cls, value: list[str]) -> list[str]:
        seen: list[str] = []
        for query in value:
            query = query.strip()
            if query and query not in seen:
                seen.append(query)
        return seen


class EngagementOut(BaseModel):
    target_agent_id: str
    kind: Literal["rebuttal", "agreement", "accusation", "concession", "question", "challenge"]
    point: str
    fallacy: str | None = None


class DebaterTurn(BaseModel):
    message: str
    stance: str
    claims: list[str] = Field(default_factory=list)
    engagements: list[EngagementOut] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    confidence: float = 0.5

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, value: float) -> float:
        return _clamp(value, 0.0, 1.0)

    @field_validator("message", "stance")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be empty")
        return value.strip()

    @field_validator("message")
    @classmethod
    def limit_words(cls, value: str) -> str:
        words = value.split()
        if len(words) <= MAX_MESSAGE_WORDS:
            return value
        clipped = " ".join(words[:MAX_MESSAGE_WORDS])
        cut = max(clipped.rfind(mark) for mark in ".!?")
        if cut > len(clipped) * 0.5:
            return clipped[: cut + 1]
        return clipped.rstrip(",;:") + "..."


class ConflictPosition(BaseModel):
    agent_id: str
    claim: str


class ConflictItem(BaseModel):
    existing_id: str | None = None
    issue: str
    positions: list[ConflictPosition] = Field(default_factory=list)
    status: Literal["open", "narrowing", "resolved"] = "open"


class Assignment(BaseModel):
    agent_id: str
    targets: list[str] = Field(default_factory=list)
    conflict_issues: list[str] = Field(default_factory=list)
    directive: str


class ConflictReport(BaseModel):
    conflicts: list[ConflictItem] = Field(default_factory=list)
    speaking_order: list[str] = Field(default_factory=list)
    assignments: list[Assignment] = Field(default_factory=list)
    moderator_notice: str


class AgentEvaluation(BaseModel):
    agent_id: str
    logical_validity: float
    evidence_quality: float
    relevance: float
    fallacies: list[str] = Field(default_factory=list)
    strengths: str = ""
    weaknesses: str = ""
    score_delta: float = 0.0

    @field_validator("logical_validity", "evidence_quality", "relevance")
    @classmethod
    def clamp_rating(cls, value: float) -> float:
        return _clamp(value, 0.0, 10.0)

    @field_validator("score_delta")
    @classmethod
    def clamp_delta(cls, value: float) -> float:
        return _clamp(value, -15.0, 15.0)


class ConflictRuling(BaseModel):
    issue: str
    winner_agent_id: str | None = None
    reasoning: str
    status: Literal["open", "narrowing", "resolved"] = "narrowing"


class JudgeAction(BaseModel):
    kind: Literal["warning", "reprimand", "penalty", "reward", "instruction"]
    target_agent_id: str
    tone: Literal["neutral", "stern", "angry", "furious", "approving"] = "stern"
    message: str
    score_delta: float = 0.0
    directive: str | None = None

    @field_validator("score_delta")
    @classmethod
    def clamp_delta(cls, value: float) -> float:
        return _clamp(value, -15.0, 10.0)


class RoundRuling(BaseModel):
    summary: str
    evaluations: list[AgentEvaluation] = Field(default_factory=list)
    conflict_rulings: list[ConflictRuling] = Field(default_factory=list)
    actions: list[JudgeAction] = Field(default_factory=list)


class JudgeReply(BaseModel):
    message: str
    outcome: Literal["upheld", "partly", "rejected"]
    tone: Literal["neutral", "stern", "angry", "furious", "approving"] = "stern"
    score_delta: float = 0.0

    @field_validator("score_delta")
    @classmethod
    def clamp_delta(cls, value: float) -> float:
        return _clamp(value, -12.0, 8.0)


class ConvergenceAssessment(BaseModel):
    converged: bool
    stalled: bool = False
    consensus_level: float = 0.0
    reasoning: str
    outstanding: list[str] = Field(default_factory=list)

    @field_validator("consensus_level")
    @classmethod
    def clamp_level(cls, value: float) -> float:
        return _clamp(value, 0.0, 1.0)


class WinningArgument(BaseModel):
    agent_id: str
    argument: str
    why_it_won: str


class RejectedArgument(BaseModel):
    agent_id: str
    argument: str
    why_rejected: str


class FinalVerdict(BaseModel):
    decision: str = ""
    headline: str
    answer: str
    confidence: float
    consensus: Literal["unanimous", "strong", "partial", "contested", "unresolved"]
    winning_arguments: list[WinningArgument] = Field(default_factory=list)
    rejected_arguments: list[RejectedArgument] = Field(default_factory=list)
    remaining_uncertainty: list[str] = Field(default_factory=list)
    key_evidence_ids: list[str] = Field(default_factory=list)
    debate_summary: str

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, value: float) -> float:
        return _clamp(value, 0.0, 1.0)

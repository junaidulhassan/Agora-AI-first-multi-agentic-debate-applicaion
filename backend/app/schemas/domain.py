from typing import Any, Literal

from pydantic import BaseModel, Field

AgentRole = Literal["judge", "debater"]
AgentStatus = Literal["idle", "thinking", "searching", "waiting", "speaking", "penalized"]
Phase = Literal["intake", "opening", "conflicts", "rebuttal", "ruling", "convergence", "verdict", "completed"]
DebateStatus = Literal["pending", "running", "completed", "failed", "cancelled", "interrupted"]
EngagementKind = Literal["rebuttal", "agreement", "accusation", "concession", "question", "challenge"]
InteractionKind = Literal[
    "rebuttal",
    "agreement",
    "accusation",
    "concession",
    "question",
    "challenge",
    "ruling",
    "warning",
    "reprimand",
    "penalty",
    "reward",
    "instruction",
]
MessageKind = Literal[
    "analysis",
    "opening",
    "rebuttal",
    "instruction",
    "conflict_report",
    "ruling",
    "warning",
    "reprimand",
    "penalty",
    "reward",
    "judge_reply",
    "convergence",
    "verdict",
]
Tone = Literal["neutral", "stern", "angry", "furious", "approving"]


class AgentProfile(BaseModel):
    id: str
    slot: str
    name: str
    role: AgentRole
    title: str
    persona: str
    reasoning_style: str
    bias: str
    color_token: str
    icon: str
    provider: str
    model: str
    dynamic: bool = False
    focus: str | None = None
    fight_style: str = ""


class Evidence(BaseModel):
    id: str
    debate_id: str
    agent_id: str
    query: str
    title: str
    url: str
    domain: str
    snippet: str
    score: float | None = None
    verified: bool = True
    retrieved_at: str


class Engagement(BaseModel):
    target_id: str
    kind: EngagementKind
    point: str
    fallacy: str | None = None


class Message(BaseModel):
    id: str
    debate_id: str
    round: int
    phase: Phase
    author_id: str
    kind: MessageKind
    content: str
    tone: Tone = "neutral"
    stance: str | None = None
    confidence: float | None = None
    targets: list[str] = Field(default_factory=list)
    engagements: list[Engagement] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    unverified: bool = False
    score_delta: float | None = None
    turn_id: str | None = None
    created_at: str
    meta: dict[str, Any] = Field(default_factory=dict)


class Interaction(BaseModel):
    id: str
    debate_id: str
    round: int
    source: str
    target: str
    kind: InteractionKind
    summary: str
    unverified: bool = False
    message_id: str | None = None
    created_at: str


class Conflict(BaseModel):
    id: str
    issue: str
    agents: list[str]
    positions: dict[str, str] = Field(default_factory=dict)
    status: Literal["open", "narrowing", "resolved"] = "open"
    round_opened: int
    round_updated: int
    winner: str | None = None
    resolution: str | None = None


class DebateMeta(BaseModel):
    id: str
    question: str
    topic: str
    status: DebateStatus
    phase: Phase | None = None
    round: int = 0
    created_at: str
    updated_at: str
    verdict_headline: str | None = None
    error: str | None = None

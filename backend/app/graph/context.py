from dataclasses import dataclass

from langchain_core.runnables import RunnableConfig

from app.agents.runtime import LLMRuntime
from app.config import Settings
from app.ids import new_id, utc_now
from app.schemas.domain import AgentProfile, AgentStatus, Interaction, Message, Phase
from app.services.search import SearchService
from app.services.session import DebateSession

PHASE_LABELS = {
    "intake": "Question analysis",
    "opening": "Opening statements",
    "conflicts": "Conflict detection",
    "rebuttal": "Cross-examination",
    "ruling": "Judge's ruling",
    "convergence": "Convergence check",
    "verdict": "Final verdict",
    "completed": "Debate complete",
}


@dataclass
class DebateContext:
    settings: Settings
    session: DebateSession
    runtime: LLMRuntime
    search: SearchService

    @property
    def debate_id(self) -> str:
        return self.session.id

    def enter_phase(self, phase: Phase, round_: int) -> None:
        self.session.set_phase(phase, round_)
        self.session.emit("phase_changed", {"phase": phase, "round": round_, "label": PHASE_LABELS[phase]})

    def set_status(
        self,
        agent_id: str,
        status: AgentStatus,
        detail: str | None = None,
        turn_id: str | None = None,
    ) -> None:
        self.session.emit(
            "agent_status",
            {"agent_id": agent_id, "status": status, "detail": detail, "turn_id": turn_id},
        )

    def publish_message(self, message: Message) -> dict:
        data = message.model_dump(mode="json")
        self.session.emit("message", {"message": data})
        return data

    def publish_interaction(self, interaction: Interaction) -> dict:
        data = interaction.model_dump(mode="json")
        self.session.emit("interaction", {"interaction": data})
        return data

    def make_interaction(
        self,
        *,
        round_: int,
        source: str,
        target: str,
        kind: str,
        summary: str,
        unverified: bool = False,
        message_id: str | None = None,
    ) -> Interaction:
        return Interaction(
            id=new_id("int"),
            debate_id=self.debate_id,
            round=round_,
            source=source,
            target=target,
            kind=kind,
            summary=summary,
            unverified=unverified,
            message_id=message_id,
            created_at=utc_now(),
        )


def get_context(config: RunnableConfig) -> DebateContext:
    return config["configurable"]["ctx"]


def parse_agents(state: dict) -> list[AgentProfile]:
    return [AgentProfile.model_validate(item) for item in state["agents"]]

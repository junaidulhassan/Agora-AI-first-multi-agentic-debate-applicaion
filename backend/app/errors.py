from typing import Any


class AgoraError(Exception):
    code = "agora_error"
    status_code = 500

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ConfigurationError(AgoraError):
    code = "configuration_error"
    status_code = 422


class DebateNotFoundError(AgoraError):
    code = "debate_not_found"
    status_code = 404


class DebateStateError(AgoraError):
    code = "invalid_debate_state"
    status_code = 409


class AgentCallError(AgoraError):
    code = "agent_call_failed"
    status_code = 502

    def __init__(self, message: str, *, agent_id: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, details={"agent_id": agent_id, **(details or {})})
        self.agent_id = agent_id


class OutputValidationError(Exception):
    pass

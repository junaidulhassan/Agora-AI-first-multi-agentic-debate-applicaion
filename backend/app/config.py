import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

APP_NAME = "Agora"
APP_TAGLINE = "Where AI argues before it answers"
LOG_PREFIX = "agora"

PROVIDER_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "together": "https://api.together.xyz/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "xai": "https://api.x.ai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "perplexity": "https://api.perplexity.ai",
}

SUPPORTED_PROVIDERS = {"anthropic", "openai", "google", "groq", *PROVIDER_BASE_URLS}


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value or default


def _env_int(name: str, default: int) -> int:
    value = _env(name)
    return int(value) if value is not None else default


def _env_float(name: str, default: float) -> float:
    value = _env(name)
    return float(value) if value is not None else default


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class LLMConfig:
    slot: str
    provider: str
    model: str
    api_key: str | None
    base_url: str | None
    temperature: float | None
    max_tokens: int
    max_input_tokens: int

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    @property
    def key_variable(self) -> str:
        return f"{self.slot}_API_KEY"


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    cors_origins: list[str]
    log_level: str
    log_dir: Path
    log_max_bytes: int
    log_backup_count: int
    data_dir: Path
    default_provider: str
    default_model: str
    default_api_key: str | None
    default_base_url: str | None
    llm_timeout_seconds: float
    llm_max_retries: int
    llm_retry_min_wait: float
    llm_retry_max_wait: float
    llm_validation_retries: int
    llm_max_tokens: int
    wait_notice_interval: float
    tavily_api_key: str | None
    tavily_max_results: int
    tavily_search_depth: str
    tavily_timeout: float
    tavily_retries: int
    max_searches_per_turn: int
    min_rounds: int
    max_rounds: int
    parallel_openings: bool
    parallel_rebuttals: bool
    enable_specialist: bool
    initial_score: float
    max_question_length: int
    slots: dict[str, LLMConfig] = field(default_factory=dict)

    def llm(self, slot: str) -> LLMConfig:
        return self.slots[slot]

    def missing_keys(self, slots: list[str]) -> list[str]:
        return [self.slots[slot].key_variable for slot in slots if not self.slots[slot].configured]


ALL_SLOTS = ["JUDGE", "AGENT_1", "AGENT_2", "AGENT_3", "AGENT_4", "AGENT_5", "AGENT_6", "AGENT_7"]


def _load_slot(
    slot: str,
    default_provider: str,
    default_model: str,
    default_key: str | None,
    default_base_url: str | None,
    max_tokens: int,
) -> LLMConfig:
    provider = (_env(f"{slot}_PROVIDER", default_provider) or default_provider).lower()
    temperature = _env(f"{slot}_TEMPERATURE")
    base_url = _env(f"{slot}_BASE_URL", default_base_url) or PROVIDER_BASE_URLS.get(provider)
    return LLMConfig(
        slot=slot,
        provider=provider,
        model=_env(f"{slot}_MODEL", default_model) or default_model,
        api_key=_env(f"{slot}_API_KEY", default_key),
        base_url=base_url,
        temperature=float(temperature) if temperature is not None else None,
        max_tokens=_env_int(f"{slot}_MAX_TOKENS", max_tokens),
        max_input_tokens=_env_int(f"{slot}_MAX_INPUT_TOKENS", 0),
    )


@lru_cache
def get_settings() -> Settings:
    default_provider = (_env("DEFAULT_PROVIDER", "anthropic") or "anthropic").lower()
    default_model = _env("DEFAULT_MODEL", "claude-haiku-5-5") or "claude-haiku-5-5"
    default_key = _env("DEFAULT_API_KEY")
    default_base_url = _env("DEFAULT_BASE_URL")
    max_tokens = _env_int("LLM_MAX_TOKENS", 8000)

    slots = {
        slot: _load_slot(slot, default_provider, default_model, default_key, default_base_url, max_tokens)
        for slot in ALL_SLOTS
    }

    min_rounds = max(1, _env_int("MIN_ROUNDS", 2))
    max_rounds = max(min_rounds, _env_int("MAX_ROUNDS", 4))

    origins = _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173") or ""

    return Settings(
        host=_env("HOST", "0.0.0.0") or "0.0.0.0",
        port=_env_int("PORT", 8000),
        cors_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        log_level=(_env("LOG_LEVEL", "INFO") or "INFO").upper(),
        log_dir=Path(_env("LOG_DIR", str(BACKEND_DIR / "logs")) or ""),
        log_max_bytes=_env_int("LOG_MAX_BYTES", 5_000_000),
        log_backup_count=_env_int("LOG_BACKUP_COUNT", 5),
        data_dir=Path(_env("DATA_DIR", str(BACKEND_DIR / "data")) or ""),
        default_provider=default_provider,
        default_model=default_model,
        default_api_key=default_key,
        default_base_url=default_base_url,
        llm_timeout_seconds=_env_float("LLM_TIMEOUT_SECONDS", 600.0),
        llm_max_retries=max(1, _env_int("LLM_MAX_RETRIES", 6)),
        llm_retry_min_wait=_env_float("LLM_RETRY_MIN_WAIT", 2.0),
        llm_retry_max_wait=_env_float("LLM_RETRY_MAX_WAIT", 60.0),
        llm_validation_retries=max(0, _env_int("LLM_VALIDATION_RETRIES", 2)),
        llm_max_tokens=max_tokens,
        wait_notice_interval=_env_float("WAIT_NOTICE_INTERVAL", 8.0),
        tavily_api_key=_env("TAVILY_API_KEY"),
        tavily_max_results=_env_int("TAVILY_MAX_RESULTS", 4),
        tavily_search_depth=_env("TAVILY_SEARCH_DEPTH", "basic") or "basic",
        tavily_timeout=_env_float("TAVILY_TIMEOUT", 30.0),
        tavily_retries=max(1, _env_int("TAVILY_RETRIES", 3)),
        max_searches_per_turn=max(0, _env_int("MAX_SEARCHES_PER_TURN", 2)),
        min_rounds=min_rounds,
        max_rounds=max_rounds,
        parallel_openings=_env_bool("PARALLEL_OPENINGS", True),
        parallel_rebuttals=_env_bool("PARALLEL_REBUTTALS", False),
        enable_specialist=_env_bool("ENABLE_SPECIALIST", True),
        initial_score=_env_float("INITIAL_SCORE", 50.0),
        max_question_length=_env_int("MAX_QUESTION_LENGTH", 600),
        slots=slots,
    )

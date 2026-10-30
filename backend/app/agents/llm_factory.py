from langchain_core.language_models.chat_models import BaseChatModel

from app.config import SUPPORTED_PROVIDERS, LLMConfig
from app.errors import ConfigurationError


def build_chat_model(cfg: LLMConfig, timeout: float) -> BaseChatModel:
    provider = cfg.provider
    if provider not in SUPPORTED_PROVIDERS:
        raise ConfigurationError(
            f"Unsupported provider '{provider}' for {cfg.slot}",
            details={"slot": cfg.slot, "supported": sorted(SUPPORTED_PROVIDERS)},
        )
    if not cfg.api_key:
        raise ConfigurationError(f"Missing {cfg.key_variable}", details={"slot": cfg.slot})

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        kwargs = {
            "model_name": cfg.model,
            "api_key": cfg.api_key,
            "max_tokens_to_sample": cfg.max_tokens,
            "timeout": timeout,
            "max_retries": 0,
        }
        if cfg.temperature is not None:
            kwargs["temperature"] = cfg.temperature
        if cfg.base_url:
            kwargs["base_url"] = cfg.base_url
        return ChatAnthropic(**kwargs)

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {
            "model": cfg.model,
            "api_key": cfg.api_key,
            "max_tokens": cfg.max_tokens,
            "timeout": timeout,
            "retries": 0,
        }
        if cfg.temperature is not None:
            kwargs["temperature"] = cfg.temperature
        return ChatGoogleGenerativeAI(**kwargs)

    from langchain_openai import ChatOpenAI

    kwargs = {
        "model": cfg.model,
        "api_key": cfg.api_key,
        "timeout": timeout,
        "max_retries": 0,
    }
    if provider == "openai":
        kwargs["max_completion_tokens"] = cfg.max_tokens
    else:
        kwargs["extra_body"] = {"max_tokens": cfg.max_tokens}
    if cfg.temperature is not None:
        kwargs["temperature"] = cfg.temperature
    if cfg.base_url:
        kwargs["base_url"] = cfg.base_url
    return ChatOpenAI(**kwargs)

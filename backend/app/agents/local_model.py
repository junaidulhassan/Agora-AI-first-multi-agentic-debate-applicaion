import asyncio
import re
import threading
from pathlib import Path
from typing import Any, ClassVar

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import ConfigDict

from app.config import LLMConfig, LocalModelConfig
from app.errors import ConfigurationError
from app.logging_setup import AGENT_LOGGER, get_logger

log = get_logger(AGENT_LOGGER)

GGML_TYPE_Q8_0 = 8
DEFAULT_TEMPERATURE = 0.7
CONTEXT_MARGIN = 32
THINK_BLOCK = re.compile(r"<think>.*?(?:</think>|$)", re.DOTALL)
ROLES = {"system": "system", "human": "user", "ai": "assistant"}


class LocalEngine:
    """One llama.cpp model held in GPU memory and shared by every slot that points at the same file."""

    def __init__(self, path: Path, config: LocalModelConfig) -> None:
        self.path = path
        self.config = config
        self._lock = threading.Lock()
        self._llm: Any = None

    def _load(self) -> Any:
        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise ConfigurationError(
                "llama-cpp-python is not installed; it is required for the 'local' provider",
                details={"hint": "see the Local model section of the README"},
            ) from exc

        kwargs: dict[str, Any] = {
            "model_path": str(self.path),
            "n_ctx": self.config.n_ctx,
            "n_gpu_layers": self.config.gpu_layers,
            "flash_attn": self.config.flash_attention,
            "verbose": False,
        }
        if self.config.threads > 0:
            kwargs["n_threads"] = self.config.threads
        if self.config.quantize_kv_cache and self.config.flash_attention:
            kwargs["type_k"] = GGML_TYPE_Q8_0
            kwargs["type_v"] = GGML_TYPE_Q8_0
        log.info("local_model_loading", path=str(self.path), n_ctx=self.config.n_ctx, gpu_layers=self.config.gpu_layers)
        llm = Llama(**kwargs)
        log.info("local_model_loaded", path=str(self.path))
        return llm

    def complete(
        self, messages: list[dict[str, str]], max_tokens: int, temperature: float, schema: dict | None = None
    ) -> tuple[str, int, int]:
        # llama.cpp contexts are not re-entrant, so concurrent agents take turns on the GPU.
        with self._lock:
            if self._llm is None:
                self._llm = self._load()
            llm = self._llm
            prompt_tokens = len(llm.tokenize("".join(m["content"] for m in messages).encode("utf-8"), add_bos=False))
            room = self.config.n_ctx - prompt_tokens - CONTEXT_MARGIN
            if room < 64:
                raise ValueError(
                    f"prompt is about {prompt_tokens} tokens but the local model context is {self.config.n_ctx}; "
                    "lower AGENT_x_MAX_INPUT_TOKENS or raise LOCAL_MODEL_N_CTX"
                )
            result = llm.create_chat_completion(
                messages=messages,
                max_tokens=min(max_tokens, room),
                temperature=temperature,
                top_p=0.8,
                top_k=20,
                response_format={"type": "json_object", **({"schema": schema} if schema else {})},
            )
        usage = result.get("usage", {})
        text = result["choices"][0]["message"].get("content") or ""
        return text, int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0))


_engines: dict[tuple[str, int, int], LocalEngine] = {}
_engines_lock = threading.Lock()


def _engine(path: Path, config: LocalModelConfig) -> LocalEngine:
    key = (str(path), config.n_ctx, config.gpu_layers)
    with _engines_lock:
        if key not in _engines:
            _engines[key] = LocalEngine(path, config)
        return _engines[key]


def require_all_properties(node: Any) -> Any:
    """Make every declared property mandatory so a small model cannot skip fields the schema merely defaults."""
    if isinstance(node, dict):
        out = {key: require_all_properties(value) for key, value in node.items()}
        if isinstance(out.get("properties"), dict):
            out["required"] = list(out["properties"])
        return out
    if isinstance(node, list):
        return [require_all_properties(item) for item in node]
    return node


class LocalChatModel(BaseChatModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    # The runtime passes the expected JSON Schema as `response_schema` to models that set this.
    constrained_output: ClassVar[bool] = True

    engine: LocalEngine
    max_tokens: int
    temperature: float = DEFAULT_TEMPERATURE

    @property
    def _llm_type(self) -> str:
        return "llama-cpp-local"

    def _to_dicts(self, messages: list[BaseMessage]) -> list[dict[str, str]]:
        converted = [{"role": ROLES.get(m.type, "user"), "content": _text(m)} for m in messages]
        # Qwen3 soft switch: skip the <think> phase, which would burn the token budget on a small GPU.
        if converted and converted[0]["role"] == "system":
            converted[0]["content"] += "\n/no_think"
        else:
            converted.insert(0, {"role": "system", "content": "/no_think"})
        return converted

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        text, prompt_tokens, completion_tokens = self.engine.complete(
            self._to_dicts(messages), self.max_tokens, self.temperature, kwargs.get("response_schema")
        )
        message = AIMessage(
            content=THINK_BLOCK.sub("", text).strip(),
            usage_metadata={
                "input_tokens": prompt_tokens,
                "output_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        )
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return await asyncio.to_thread(self._generate, messages, stop, None, **kwargs)


def _text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    return "".join(
        block if isinstance(block, str) else block.get("text", "")
        for block in content
        if isinstance(block, str) or (isinstance(block, dict) and block.get("type") == "text")
    )


def grammar_schema(schema: dict) -> dict:
    return require_all_properties(schema)


def resolve_model_path(model: str, config: LocalModelConfig) -> Path:
    path = Path(model).expanduser()
    if not path.is_absolute():
        path = config.model_dir / path
    if not path.is_file():
        raise ConfigurationError(f"Local model file not found: {path}", details={"model": model})
    return path


def build_local_chat_model(cfg: LLMConfig, config: LocalModelConfig) -> LocalChatModel:
    path = resolve_model_path(cfg.model, config)
    return LocalChatModel(
        engine=_engine(path, config),
        max_tokens=cfg.max_tokens,
        temperature=cfg.temperature if cfg.temperature is not None else DEFAULT_TEMPERATURE,
    )

import logging
import sys
from logging.handlers import RotatingFileHandler

import structlog

from app.config import LOG_PREFIX, Settings

APP_LOGGER = "agora.app"
AGENT_LOGGER = "agora.agents"
SEARCH_LOGGER = "agora.search"
ERROR_LOGGER = "agora.errors"

_configured = False


def _file_handler(settings: Settings, name: str, formatter: logging.Formatter, level: int) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        settings.log_dir / f"{LOG_PREFIX}-{name}.log",
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
        encoding="utf-8",
    )
    handler.setFormatter(formatter)
    handler.setLevel(level)
    return handler


def configure_logging(settings: Settings) -> None:
    global _configured
    if _configured:
        return
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=[*shared_processors, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    json_formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    console_formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty()),
        ],
    )

    level = getattr(logging, settings.log_level, logging.INFO)

    console = logging.StreamHandler(sys.stderr)
    console.setFormatter(console_formatter)
    console.setLevel(level)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(console)
    root.addHandler(_file_handler(settings, "app", json_formatter, level))
    root.addHandler(_file_handler(settings, "errors", json_formatter, logging.ERROR))

    logging.getLogger(AGENT_LOGGER).addHandler(_file_handler(settings, "agents", json_formatter, level))
    logging.getLogger(SEARCH_LOGGER).addHandler(_file_handler(settings, "search", json_formatter, level))

    for noisy in ("httpx", "httpcore", "websockets", "anthropic", "openai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _configured = True


def get_logger(name: str = APP_LOGGER) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)

import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

from tavily import AsyncTavilyClient
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.config import Settings
from app.logging_setup import SEARCH_LOGGER, get_logger

log = get_logger(SEARCH_LOGGER)


@dataclass
class SearchResult:
    title: str
    url: str
    domain: str
    snippet: str
    score: float | None


@dataclass
class SearchOutcome:
    query: str
    results: list[SearchResult] = field(default_factory=list)
    verified: bool = True
    error: str | None = None


def _retryable(exc: BaseException) -> bool:
    name = type(exc).__name__.lower()
    if "invalidapikey" in name or "badrequest" in name or "forbidden" in name:
        return False
    return True


class SearchService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = AsyncTavilyClient(api_key=settings.tavily_api_key) if settings.tavily_api_key else None

    @property
    def available(self) -> bool:
        return self._client is not None

    async def search(self, query: str, *, agent_id: str, debate_id: str) -> SearchOutcome:
        if self._client is None:
            log.warning("search_unavailable", debate_id=debate_id, agent_id=agent_id, query=query)
            return SearchOutcome(query=query, verified=False, error="TAVILY_API_KEY is not configured")

        started = time.monotonic()
        attempts = 0
        try:
            response = None
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self.settings.tavily_retries),
                wait=wait_exponential_jitter(initial=1, max=10),
                retry=retry_if_exception(_retryable),
                reraise=True,
            ):
                with attempt:
                    attempts = attempt.retry_state.attempt_number
                    response = await self._client.search(
                        query=query,
                        search_depth=self.settings.tavily_search_depth,
                        max_results=self.settings.tavily_max_results,
                        include_answer=False,
                        timeout=self.settings.tavily_timeout,
                    )
            results = [
                SearchResult(
                    title=(item.get("title") or item.get("url") or "Untitled").strip(),
                    url=item["url"],
                    domain=urlparse(item["url"]).netloc.removeprefix("www."),
                    snippet=(item.get("content") or "").strip(),
                    score=item.get("score"),
                )
                for item in (response or {}).get("results", [])
                if item.get("url")
            ]
            log.info(
                "search_completed",
                debate_id=debate_id,
                agent_id=agent_id,
                query=query,
                results=len(results),
                attempts=attempts,
                latency_ms=round((time.monotonic() - started) * 1000),
            )
            return SearchOutcome(query=query, results=results, verified=bool(results))
        except Exception as exc:
            log.error(
                "search_failed",
                debate_id=debate_id,
                agent_id=agent_id,
                query=query,
                attempts=attempts,
                latency_ms=round((time.monotonic() - started) * 1000),
                error=type(exc).__name__,
                detail=str(exc)[:300],
            )
            return SearchOutcome(query=query, verified=False, error=f"{type(exc).__name__}: {str(exc)[:200]}")

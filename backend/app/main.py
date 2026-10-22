import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.api.routes import router
from app.config import APP_NAME, APP_TAGLINE, get_settings
from app.errors import AgoraError
from app.ids import new_id
from app.logging_setup import ERROR_LOGGER, configure_logging, get_logger
from app.services.manager import SessionManager

settings = get_settings()
configure_logging(settings)
log = get_logger()
error_log = get_logger(ERROR_LOGGER)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.manager = SessionManager(settings)
    readiness = app.state.manager.readiness()
    log.info("agora_started", ready=readiness["ready"], missing_keys=readiness["missing_keys"], web_search=readiness["web_search"])
    try:
        yield
    finally:
        await app.state.manager.shutdown()
        log.info("agora_stopped")


app = FastAPI(
    title=f"{APP_NAME} API",
    description=f"{APP_NAME}: {APP_TAGLINE}. Multi-agent debate orchestration with live streaming.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or new_id("req")
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    started = time.monotonic()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    log.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        latency_ms=round((time.monotonic() - started) * 1000),
    )
    return response


def _error_body(request: Request, code: str, message: str, details: dict | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": structlog.contextvars.get_contextvars().get("request_id"),
        }
    }


@app.exception_handler(AgoraError)
async def agora_error_handler(request: Request, exc: AgoraError) -> JSONResponse:
    error_log.error("agora_error", code=exc.code, message=exc.message, details=exc.details)
    return JSONResponse(status_code=exc.status_code, content=_error_body(request, exc.code, exc.message, exc.details))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [{"field": ".".join(str(p) for p in err["loc"][1:]), "message": err["msg"]} for err in exc.errors()]
    return JSONResponse(
        status_code=422,
        content=_error_body(request, "validation_error", "The request was invalid", {"fields": fields}),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_body(request, "http_error", str(exc.detail)))


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error_log.exception("unhandled_exception", path=request.url.path)
    return JSONResponse(status_code=500, content=_error_body(request, "internal_error", "An unexpected error occurred"))


app.include_router(router)

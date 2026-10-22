import uvicorn

from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, log_config=None, ws_ping_interval=20, ws_ping_timeout=60)

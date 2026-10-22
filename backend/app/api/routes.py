import asyncio

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, status

from app.config import APP_NAME, APP_TAGLINE
from app.schemas.api import CreateDebateRequest
from app.services.manager import SessionManager
from app.services.session import TERMINAL_EVENTS, DebateSession

router = APIRouter()
HEARTBEAT_SECONDS = 20


def manager_of(request: Request | WebSocket) -> SessionManager:
    return request.app.state.manager


@router.get("/api/health", tags=["system"])
async def health(request: Request) -> dict:
    return {"status": "ok", "app": APP_NAME, **manager_of(request).readiness()}


@router.get("/api/config", tags=["system"])
async def config(request: Request) -> dict:
    manager = manager_of(request)
    return {
        "app": APP_NAME,
        "tagline": APP_TAGLINE,
        "agents": manager.panel(),
        **manager.readiness(),
    }


@router.post("/api/debates", status_code=status.HTTP_201_CREATED, tags=["debates"])
async def create_debate(body: CreateDebateRequest, request: Request) -> dict:
    session = await manager_of(request).create(body.question, body.topic)
    return {"debate": session.meta.model_dump(mode="json")}


@router.get("/api/debates", tags=["debates"])
async def list_debates(request: Request) -> dict:
    return {"debates": manager_of(request).list()}


@router.get("/api/debates/{debate_id}", tags=["debates"])
async def get_debate(debate_id: str, request: Request) -> dict:
    session = manager_of(request).get(debate_id)
    return {"debate": session.meta.model_dump(mode="json"), "events": session.events}


@router.post("/api/debates/{debate_id}/cancel", tags=["debates"])
async def cancel_debate(debate_id: str, request: Request) -> dict:
    session = await manager_of(request).cancel(debate_id)
    return {"debate": session.meta.model_dump(mode="json")}


@router.delete("/api/debates/{debate_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["debates"])
async def delete_debate(debate_id: str, request: Request) -> None:
    await manager_of(request).delete(debate_id)


async def _pump(websocket: WebSocket, session: DebateSession, queue: asyncio.Queue, last_seq: int) -> None:
    while True:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
        except asyncio.TimeoutError:
            await websocket.send_json({"type": "heartbeat", "seq": 0, "debate_id": session.id, "payload": {}})
            continue
        if 0 < event["seq"] <= last_seq:
            continue
        await websocket.send_json(event)
        if event["seq"]:
            last_seq = event["seq"]
        if event["type"] in TERMINAL_EVENTS:
            return


async def _listen(websocket: WebSocket, manager: SessionManager, debate_id: str) -> None:
    while True:
        message = await websocket.receive_json()
        kind = message.get("type")
        if kind == "cancel":
            await manager.cancel(debate_id)
        elif kind == "ping":
            await websocket.send_json({"type": "pong", "seq": 0, "debate_id": debate_id, "payload": {}})


@router.websocket("/ws/debates/{debate_id}")
async def stream_debate(websocket: WebSocket, debate_id: str, after: int = 0) -> None:
    manager = manager_of(websocket)
    session = manager.find(debate_id)
    await websocket.accept()
    if session is None:
        await websocket.close(code=4404, reason="Debate not found")
        return

    queue = session.subscribe()
    pump: asyncio.Task | None = None
    listener: asyncio.Task | None = None
    try:
        last_seq = after
        terminal_replayed = False
        for event in session.events_after(after):
            await websocket.send_json(event)
            last_seq = event["seq"]
            terminal_replayed = event["type"] in TERMINAL_EVENTS
        if terminal_replayed or (session.finished and queue.empty()):
            await websocket.send_json({"type": "stream_closed", "seq": 0, "debate_id": debate_id, "payload": {}})
            await websocket.close()
            return

        pump = asyncio.create_task(_pump(websocket, session, queue, last_seq))
        listener = asyncio.create_task(_listen(websocket, manager, debate_id))
        done, _ = await asyncio.wait({pump, listener}, return_when=asyncio.FIRST_COMPLETED)
        if pump in done and pump.exception() is None:
            await websocket.send_json({"type": "stream_closed", "seq": 0, "debate_id": debate_id, "payload": {}})
            await websocket.close()
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass
    finally:
        for task in (pump, listener):
            if task and not task.done():
                task.cancel()
        await asyncio.gather(*(t for t in (pump, listener) if t), return_exceptions=True)
        session.unsubscribe(queue)

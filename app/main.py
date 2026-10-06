import json
import secrets
from functools import lru_cache

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.extension import _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from app.config import Settings, get_settings
from app.graph import build_graph
from app.models import ChatRequest, ChatResponse

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Website Assistant API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-API-Key"],
)


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Enable APP_API_KEY in production; comparison avoids timing leaks."""
    if settings.app_api_key and not (
        x_api_key and secrets.compare_digest(x_api_key, settings.app_api_key)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key"
        )


@lru_cache
def get_graph():
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return build_graph(settings)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": settings.model_name}


@app.get("/")
def root() -> dict[str, str]:
    """A browser-friendly entry point; the assistant endpoint remains POST-only."""
    return {
        "status": "Website Assistant API is running",
        "docs": "/docs",
        "health": "/health",
        "chat_endpoint": "POST /api/v1/chat",
    }


@app.post(
    "/api/v1/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)]
)
@limiter.limit(
    f"{settings.rate_limit_requests}/{settings.rate_limit_window_seconds}seconds"
)
def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    try:
        result = get_graph().invoke(
            {
                "question": payload.message[: settings.max_message_length],
                "history": payload.history,
                "page_url": payload.page_url,
                "answer": "",
            }
        )
        return ChatResponse(answer=result["answer"], model=settings.model_name)
    except RuntimeError as exc:
        # Configuration error is useful to the deployment owner, without exposing secrets.
        raise HTTPException(
            status_code=503, detail="Assistant is not configured. Set GEMINI_API_KEY."
        ) from exc
    except Exception as exc:
        # Do not return provider internals or prompts to website visitors.
        raise HTTPException(
            status_code=502,
            detail="Assistant is temporarily unavailable. Please try again.",
        ) from exc


@app.post("/api/v1/chat/stream", dependencies=[Depends(verify_api_key)])
@limiter.limit(
    f"{settings.rate_limit_requests}/{settings.rate_limit_window_seconds}seconds"
)
def chat_stream(request: Request, payload: ChatRequest) -> StreamingResponse:
    def stream_events():
        try:
            state = {
                "question": payload.message[: settings.max_message_length],
                "history": payload.history,
                "page_url": payload.page_url,
                "answer": "",
            }
            for chunk, metadata in get_graph().stream(state, stream_mode="messages"):
                if metadata.get("langgraph_node") != "answer_website_question":
                    continue

                content = chunk.content
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    text = "".join(
                        block["text"]
                        for block in content
                        if isinstance(block, dict)
                        and block.get("type") == "text"
                        and isinstance(block.get("text"), str)
                    )
                else:
                    text = ""

                if text:
                    event = json.dumps(
                        {"type": "token", "text": text}, ensure_ascii=False
                    )
                    yield f"data: {event}\n\n"

            yield 'data: {"type":"done"}\n\n'
        except RuntimeError:
            yield 'data: {"type":"error","message":"Assistant is not configured."}\n\n'
        except Exception:
            yield 'data: {"type":"error","message":"Assistant is temporarily unavailable."}\n\n'

    return StreamingResponse(
        stream_events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

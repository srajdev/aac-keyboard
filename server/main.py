import os
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from .claude_service import generate_predictions as generate_predictions_claude
from .gemini_service import generate_predictions_gemini
from .gpt_service import generate_predictions_gpt
from .performance_tracker import get_tracker

app = FastAPI(title="Viraj Keyboard API")


@app.on_event("startup")
async def startup_event():
    """Initialize performance tracking on startup."""
    tracker = get_tracker()
    print("[Performance] Tracker initialized - stats will be logged every 60 seconds")
    print("[Performance] View stats at: logs/performance_stats.jsonl")
    print("[Performance] API endpoint: GET /api/performance-stats")


@app.on_event("shutdown")
async def shutdown_event():
    """Log final stats on shutdown."""
    tracker = get_tracker()
    tracker.log_aggregate_stats()
    tracker.print_current_stats()


# Middleware to disable caching for static files during development
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static") or request.url.path == "/":
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


app.add_middleware(NoCacheMiddleware)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    partialInput: str = ""
    conversationContext: str = ""
    model: str = "claude"  # Options: "claude", "gemini", "gpt" (GPT-5 Mini)


class PredictionResponse(BaseModel):
    phrases: list[str]
    words: list[str]


@app.post("/api/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    """Generate predictions based on partial input and conversation context (SYNC)."""
    try:
        # Route to appropriate model service
        start_time = time.time()

        if request.model == "gemini":
            predictions = generate_predictions_gemini(
                request.partialInput, request.conversationContext
            )
        elif request.model == "gpt" or request.model == "gpt-5-mini":
            predictions = generate_predictions_gpt(
                request.partialInput, request.conversationContext
            )
        elif request.model == "claude":
            predictions = generate_predictions_claude(
                request.partialInput, request.conversationContext
            )
        else:
            # Default to Claude if unknown model
            print(f"Unknown model '{request.model}', defaulting to Claude")
            predictions = generate_predictions_claude(
                request.partialInput, request.conversationContext
            )

        duration_ms = (time.time() - start_time) * 1000
        print(f"[Backend] Prediction generation ({request.model}): {duration_ms:.0f}ms")

        return PredictionResponse(
            phrases=predictions.get("phrases", []),
            words=predictions.get("words", []),
        )
    except Exception as e:
        print(f"Prediction error ({request.model}): {e}")
        # Fallback to Claude if Gemini fails
        if request.model == "gemini":
            print("Falling back to Claude due to Gemini error")
            try:
                start_time = time.time()
                predictions = generate_predictions_claude(
                    request.partialInput, request.conversationContext
                )
                duration_ms = (time.time() - start_time) * 1000
                print(f"[Backend] Prediction generation (claude-fallback): {duration_ms:.0f}ms")

                return PredictionResponse(
                    phrases=predictions.get("phrases", []),
                    words=predictions.get("words", []),
                )
            except Exception as fallback_error:
                print(f"Claude fallback also failed: {fallback_error}")
        raise HTTPException(status_code=500, detail=str(e))


# Serve static files from client directory
client_path = Path(__file__).parent.parent / "client"
app.mount("/static", StaticFiles(directory=client_path), name="static")


@app.get("/")
async def root():
    """Serve the main HTML file."""
    return FileResponse(client_path / "index.html")


@app.get("/api/performance-stats")
async def get_performance_stats():
    """Get current performance statistics."""
    tracker = get_tracker()
    return tracker.get_all_stats()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3000)

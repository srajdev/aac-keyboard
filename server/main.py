import os
import time
import asyncio
import logging
import json
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from .claude_service import (
    generate_predictions as generate_predictions_claude,
    generate_phrase_predictions,
    generate_word_predictions,
    generate_word_predictions_stream,
    generate_phrase_predictions_stream,
)
from .feature_request_service import (
    load_session,
    save_session,
    clear_session,
    start_session,
    continue_session,
    detect_branch_from_output,
    merge_branch,
    discard_branch,
)
from .gemini_service import generate_predictions_gemini
from .gpt_service import generate_predictions_gpt
from .performance_tracker import get_tracker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
PREDICTIONS_LOG_FILE = LOG_DIR / "predictions.jsonl"

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
    userProfile: dict = {}  # User profile (name, age, interests, topics)


class PredictionResponse(BaseModel):
    phrases: list[str]
    words: list[str]


class PhrasePredictionResponse(BaseModel):
    phrases: list[str]


class WordPredictionResponse(BaseModel):
    words: list[str]


@app.post("/api/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    """Generate predictions based on partial input and conversation context (SYNC)."""
    try:
        # Route to appropriate model service
        start_time = time.time()

        if request.model == "gemini":
            predictions = generate_predictions_gemini(
                request.partialInput, request.conversationContext, request.userProfile
            )
        elif request.model == "gpt" or request.model == "gpt-5-mini":
            predictions = generate_predictions_gpt(
                request.partialInput, request.conversationContext, request.userProfile
            )
        elif request.model == "claude":
            predictions = generate_predictions_claude(
                request.partialInput, request.conversationContext, request.userProfile
            )
        else:
            # Default to Claude if unknown model
            print(f"Unknown model '{request.model}', defaulting to Claude")
            predictions = generate_predictions_claude(
                request.partialInput, request.conversationContext, request.userProfile
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
                    request.partialInput, request.conversationContext, request.userProfile
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


@app.post("/api/predict/phrases", response_model=PhrasePredictionResponse)
def predict_phrases(request: PredictionRequest):
    """Generate phrase predictions only (optimized for complete sentences)."""
    try:
        start_time = time.time()

        # Only Claude supports split predictions currently
        phrases = generate_phrase_predictions(
            request.partialInput, request.conversationContext, request.userProfile
        )

        duration_ms = (time.time() - start_time) * 1000
        print(f"[Backend] Phrase prediction: {duration_ms:.0f}ms")

        return PhrasePredictionResponse(phrases=phrases)
    except Exception as e:
        print(f"Phrase prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict/words", response_model=WordPredictionResponse)
def predict_words(request: PredictionRequest):
    """Generate word predictions only (optimized for next-word completion)."""
    try:
        start_time = time.time()

        # Only Claude supports split predictions currently
        words = generate_word_predictions(
            request.partialInput, request.conversationContext, request.userProfile
        )

        duration_ms = (time.time() - start_time) * 1000
        print(f"[Backend] Word prediction: {duration_ms:.0f}ms")

        return WordPredictionResponse(words=words)
    except Exception as e:
        print(f"Word prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def async_generator_from_sync(sync_gen):
    """Convert a sync generator to async by running each iteration in a thread."""
    loop = asyncio.get_event_loop()
    while True:
        try:
            # Get next value from sync generator in thread pool
            value = await loop.run_in_executor(None, next, sync_gen, StopIteration)
            if value is StopIteration:
                break
            yield value
        except StopIteration:
            break


async def handle_prediction_request(websocket: WebSocket, message: dict, active_tasks: dict):
    """Handle a single prediction request over WebSocket with streaming support."""
    request_id = message["requestId"]
    request_type = message["type"]

    try:
        # Extract request data
        partial_input = message.get("partialInput", "")
        conversation_context = message.get("conversationContext", "")
        model = message.get("model", "claude")
        user_profile = message.get("userProfile", {})

        start_time = time.time()
        predictions = []

        # Route to appropriate streaming service based on type
        if request_type == "words":
            stream_fn = generate_word_predictions_stream
        elif request_type == "phrases":
            stream_fn = generate_phrase_predictions_stream
        else:
            raise ValueError(f"Unknown request type: {request_type}")

        # Create sync generator and convert to async
        sync_gen = stream_fn(partial_input, conversation_context, user_profile)

        # Stream predictions as they arrive
        async for chunk in async_generator_from_sync(sync_gen):
            predictions.append(chunk)

            # Send chunk update
            await websocket.send_json({
                "type": "stream_chunk",
                "requestId": request_id,
                "predictionType": request_type,
                "predictions": predictions.copy(),
                "timestamp": int(time.time() * 1000)
            })

        duration_ms = (time.time() - start_time) * 1000
        logger.info(f"[WebSocket] {request_type} streaming completed: {duration_ms:.0f}ms ({len(predictions)} predictions)")

        # Fallback to defaults if no predictions received
        if not predictions:
            logger.warning(f"[WebSocket] No predictions received for {request_type}, using fallbacks")
            if request_type == "words":
                predictions = ["yes", "no", "please", "thanks", "help", "okay"]
            elif request_type == "phrases":
                predictions = [
                    "I would like some help please",
                    "Can you please wait a moment",
                    "Thanks for your patience"
                ]

        # Log the streaming prediction to predictions.jsonl
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "model": f"{model}-haiku-4-5",
                "type": f"{request_type}-streaming",
                "input": partial_input,
                "context": conversation_context,
                "response": predictions,
                "timings": {
                    "total_ms": round(duration_ms),
                    "streaming": True,
                },
                "predictions_count": len(predictions),
            }
            with open(PREDICTIONS_LOG_FILE, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as log_error:
            logger.error(f"Failed to log prediction: {log_error}")

        # Send completion message
        await websocket.send_json({
            "type": "stream_complete",
            "requestId": request_id,
            "predictionType": request_type,
            "predictions": predictions,
            "timestamp": int(time.time() * 1000)
        })

    except asyncio.CancelledError:
        logger.info(f"Request {request_id} cancelled")
        # Don't send response for cancelled requests

    except Exception as e:
        logger.error(f"Error processing {request_type} request: {e}")
        # Send error response with partial results
        try:
            await websocket.send_json({
                "type": "stream_error",
                "requestId": request_id,
                "predictionType": request_type,
                "error": str(type(e).__name__),
                "message": str(e),
                "predictions": predictions if 'predictions' in locals() else [],
                "timestamp": int(time.time() * 1000)
            })
        except Exception as send_error:
            logger.error(f"Failed to send error response: {send_error}")

    finally:
        # Clean up from active tasks
        if request_id in active_tasks:
            del active_tasks[request_id]


@app.websocket("/ws/predictions")
async def websocket_predictions(websocket: WebSocket):
    """WebSocket endpoint for real-time prediction requests."""
    await websocket.accept()
    logger.info("WebSocket connection established")
    active_tasks = {}  # requestId -> Task mapping

    try:
        while True:
            message = await websocket.receive_json()

            if message["type"] == "cancel":
                # Cancel tasks by requestId
                request_ids = message.get("requestIds", [])
                logger.info(f"Cancelling {len(request_ids)} requests")
                for req_id in request_ids:
                    if req_id in active_tasks:
                        active_tasks[req_id].cancel()
                        del active_tasks[req_id]

            elif message["type"] in ["words", "phrases"]:
                # Create async task for prediction
                request_id = message["requestId"]
                task = asyncio.create_task(
                    handle_prediction_request(websocket, message, active_tasks)
                )
                active_tasks[request_id] = task

            elif message["type"] == "ping":
                # Respond to heartbeat
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": int(time.time() * 1000)
                })

            else:
                logger.warning(f"Unknown message type: {message.get('type')}")

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Clean up active tasks
        for task in active_tasks.values():
            task.cancel()
        logger.info("WebSocket connection closed, cleaned up active tasks")


@app.websocket("/ws/feature-request")
async def websocket_feature_request(websocket: WebSocket):
    """WebSocket endpoint for the in-app feature request chat."""
    await websocket.accept()
    logger.info("[FeatureRequest] WebSocket connection established")

    async def send(data: dict):
        try:
            await websocket.send_json(data)
        except Exception:
            pass

    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type == "message":
                text = message.get("text", "").strip()
                if not text:
                    continue

                await send({"type": "thinking"})

                try:
                    session = load_session()

                    if not session.claude_session_id:
                        # Start a new session
                        session, response = await start_session(text)
                    else:
                        # Continue existing session
                        session, response = await continue_session(session, text)

                    # Detect branch in response (marks transition to review)
                    branch = detect_branch_from_output(response)
                    if branch and session.phase == "review":
                        await send({
                            "type": "phase_change",
                            "phase": "review",
                            "branch": branch,
                        })
                        await send({
                            "type": "reload_required",
                            "message": "Changes deployed. Refresh the page to see them.",
                        })

                    await send({
                        "type": "response",
                        "text": response,
                        "phase": session.phase,
                    })

                except Exception as e:
                    logger.error(f"[FeatureRequest] Error: {e}")
                    await send({"type": "error", "message": str(e)})

            elif msg_type == "approve":
                await send({"type": "thinking"})
                try:
                    session = load_session()
                    await merge_branch(session)
                    clear_session()
                    await send({"type": "merged"})
                except Exception as e:
                    logger.error(f"[FeatureRequest] Merge error: {e}")
                    await send({"type": "error", "message": f"Merge failed: {e}"})

            elif msg_type == "reject":
                await send({"type": "thinking"})
                try:
                    session = load_session()
                    await discard_branch(session)
                    clear_session()
                    await send({"type": "reverted"})
                except Exception as e:
                    logger.error(f"[FeatureRequest] Revert error: {e}")
                    await send({"type": "error", "message": f"Revert failed: {e}"})

            elif msg_type == "get_session":
                # Client reconnected — send current session state
                session = load_session()
                await send({
                    "type": "session_state",
                    "phase": session.phase,
                    "branch": session.branch_name,
                    "has_session": session.claude_session_id is not None,
                })

            elif msg_type == "reset":
                clear_session()
                await send({"type": "session_state", "phase": "gather", "branch": None, "has_session": False})

    except WebSocketDisconnect:
        logger.info("[FeatureRequest] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[FeatureRequest] WebSocket error: {e}")


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

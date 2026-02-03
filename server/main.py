import os
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

app = FastAPI(title="Viraj Keyboard API")


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
    model: str = "claude"  # Default to claude


class PredictionResponse(BaseModel):
    phrases: list[str]
    words: list[str]
    letters: list[str]


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Generate predictions based on partial input and conversation context."""
    try:
        # Route to appropriate model service
        if request.model == "gemini":
            predictions = await generate_predictions_gemini(
                request.partialInput, request.conversationContext
            )
        elif request.model == "claude":
            predictions = await generate_predictions_claude(
                request.partialInput, request.conversationContext
            )
        else:
            # Default to Claude if unknown model
            print(f"Unknown model '{request.model}', defaulting to Claude")
            predictions = await generate_predictions_claude(
                request.partialInput, request.conversationContext
            )

        return PredictionResponse(
            phrases=predictions.get("phrases", []),
            words=predictions.get("words", []),
            letters=predictions.get("letters", []),
        )
    except Exception as e:
        print(f"Prediction error ({request.model}): {e}")
        # Fallback to Claude if Gemini fails
        if request.model == "gemini":
            print("Falling back to Claude due to Gemini error")
            try:
                predictions = await generate_predictions_claude(
                    request.partialInput, request.conversationContext
                )
                return PredictionResponse(
                    phrases=predictions.get("phrases", []),
                    words=predictions.get("words", []),
                    letters=predictions.get("letters", []),
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3000)

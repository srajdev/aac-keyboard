import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from .claude_service import generate_predictions

app = FastAPI(title="Viraj Keyboard API")

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


class PredictionResponse(BaseModel):
    phrases: list[str]
    words: list[str]
    letters: list[str]


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Generate predictions based on partial input and conversation context."""
    try:
        predictions = await generate_predictions(
            request.partialInput, request.conversationContext
        )
        return PredictionResponse(
            phrases=predictions.get("phrases", []),
            words=predictions.get("words", []),
            letters=predictions.get("letters", []),
        )
    except Exception as e:
        print(f"Prediction error: {e}")
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

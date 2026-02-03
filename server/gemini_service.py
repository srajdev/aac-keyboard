import json
import time
from datetime import datetime
from pathlib import Path
import google.generativeai as genai
from .prompts import SYSTEM_PROMPT_WITH_RULES, build_prediction_prompt
from .performance_tracker import get_tracker


# Configure Gemini
import os
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "predictions.jsonl"

# Get performance tracker
perf_tracker = get_tracker(LOG_DIR)


async def generate_predictions_gemini(partial_input: str, conversation_context: str) -> dict:
    """Generate predictions using Gemini Flash 2.0."""
    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)

    # Combine system and user prompts for Gemini
    full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()

    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')

        response = await model.generate_content_async(
            full_prompt,
            generation_config={
                'temperature': 0.7,
                'max_output_tokens': 300,
                'response_mime_type': 'application/json',
            }
        )

        api_call_ms = (time.time() - api_call_start) * 1000

        # Timing: parse
        parse_start = time.time()
        result = json.loads(response.text)
        parse_ms = (time.time() - parse_start) * 1000

        # Log with detailed timing breakdown
        print(f"[Predictions] Gemini API: {api_call_ms:.0f}ms (prompt: {prompt_build_ms:.1f}ms) | "
              f"Input: '{partial_input[:30]}...'")

        # Log the prediction with detailed timing
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "model": "gemini-2.0-flash",
            "input": partial_input,
            "context": conversation_context,
            "response": result,
            "timings": {
                "prompt_build_ms": round(prompt_build_ms, 2),
                "api_call_ms": round(api_call_ms),
                "parse_ms": round(parse_ms, 2),
                "total_ms": round(prompt_build_ms + api_call_ms + parse_ms),
            },
        }
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        # Record performance metrics (no cache tracking for Gemini yet)
        perf_tracker.record_request(
            model="gemini-2.0-flash",
            latency_ms=api_call_ms,
            cache_hit=False,
        )

        return result

    except Exception as e:
        print(f"Gemini API error: {e}")
        # Return fallback predictions
        return {
            "phrases": [
                "I would like some help please",
                "Can you please wait a moment",
                "I want to say something",
            ],
            "words": ["yes", "no", "please", "thanks", "help"],
            "letters": ["i", "y", "n", "t", "w"],
        }

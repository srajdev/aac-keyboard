import json
import re
import time
from datetime import datetime
from pathlib import Path
from openai import AsyncOpenAI
from .prompts import SYSTEM_PROMPT_WITH_RULES, build_prediction_prompt
from .performance_tracker import get_tracker


# Initialize OpenAI client with lazy initialization
import os
_gpt_client = None

def _get_gpt_client():
    """Lazy initialization of OpenAI client."""
    global _gpt_client
    if _gpt_client is None:
        _gpt_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _gpt_client

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "predictions.jsonl"

# Get performance tracker
perf_tracker = get_tracker(LOG_DIR)


async def generate_predictions_gpt(partial_input: str, conversation_context: str) -> dict:
    """Generate predictions using GPT-5 Mini API (no caching initially)."""
    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()

    try:
        client = _get_gpt_client()

        # Call OpenAI API with GPT-5 Mini
        response = await client.chat.completions.create(
            model="gpt-5-mini",
            max_completion_tokens=1000,  # GPT-5 Mini uses max_completion_tokens instead of max_tokens
            temperature=0.7,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_WITH_RULES},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}  # Force JSON output
        )

        api_call_ms = (time.time() - api_call_start) * 1000

        # Timing: parse
        parse_start = time.time()
        response_text = response.choices[0].message.content

        # Log with detailed timing breakdown
        print(f"[Predictions] GPT API: {api_call_ms:.0f}ms (prompt: {prompt_build_ms:.1f}ms) | "
              f"Input: '{partial_input[:30]}...' | "
              f"Tokens: {response.usage.prompt_tokens}in/{response.usage.completion_tokens}out")

        # Parse the JSON response
        try:
            # Try to extract JSON from the response
            json_match = re.search(r"\{[\s\S]*\}", response_text)
            if json_match:
                result = json.loads(json_match.group())
                parse_ms = (time.time() - parse_start) * 1000

                # Log the prediction with detailed timing
                log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "model": "gpt-5-mini",
                    "input": partial_input,
                    "context": conversation_context,
                    "response": result,
                    "timings": {
                        "prompt_build_ms": round(prompt_build_ms, 2),
                        "api_call_ms": round(api_call_ms),
                        "parse_ms": round(parse_ms, 2),
                        "total_ms": round(prompt_build_ms + api_call_ms + parse_ms),
                    },
                    "tokens": {
                        "input": response.usage.prompt_tokens,
                        "output": response.usage.completion_tokens,
                    },
                }
                with open(LOG_FILE, "a") as f:
                    f.write(json.dumps(log_entry) + "\n")

                # Record performance metrics (no caching for GPT initially)
                perf_tracker.record_request(
                    model="gpt-5-mini",
                    latency_ms=api_call_ms,
                    cache_hit=False,
                )

                return result
            raise ValueError("No JSON found in response")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse GPT response: {response_text}")
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

    except Exception as e:
        print(f"GPT API error: {e}")
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

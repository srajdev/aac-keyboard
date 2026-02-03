import json
import time
from datetime import datetime
from pathlib import Path
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
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
    """Generate predictions using Gemini 2.5 Flash."""
    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)

    # Combine system and user prompts for Gemini
    full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()

    try:
        model = genai.GenerativeModel(
            'models/gemini-2.5-flash',
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )

        response = await model.generate_content_async(
            full_prompt,
            generation_config={
                'temperature': 0.7,
                'max_output_tokens': 1500,
            }
        )

        api_call_ms = (time.time() - api_call_start) * 1000

        # Check if response was blocked or truncated
        if not response.candidates or not response.candidates[0].content.parts:
            finish_reason = response.candidates[0].finish_reason if response.candidates else 'UNKNOWN'
            print(f"Gemini response blocked. Finish reason: {finish_reason}")
            raise ValueError(f"Response blocked: {finish_reason}")

        # Check if hit token limit (finish_reason 2 = MAX_TOKENS)
        finish_reason = response.candidates[0].finish_reason
        if finish_reason == 2:  # MAX_TOKENS
            print(f"Gemini hit token limit. Consider increasing max_output_tokens.")
            # Continue anyway - might have partial valid JSON

        # Timing: parse
        parse_start = time.time()
        response_text = response.text.strip()

        # Remove markdown code blocks if present
        import re
        response_text = re.sub(r'^```json\s*', '', response_text)
        response_text = re.sub(r'\s*```$', '', response_text)
        response_text = response_text.strip()

        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            json_str = json_match.group()
            try:
                result = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Attempted to parse: {json_str[:500]}")
                raise ValueError(f"Invalid JSON: {e}")
        else:
            print(f"No JSON found in Gemini response: {response_text[:500]}")
            raise ValueError("No JSON found in response")

        parse_ms = (time.time() - parse_start) * 1000

        # Log with detailed timing breakdown
        print(f"[Predictions] Gemini API: {api_call_ms:.0f}ms (prompt: {prompt_build_ms:.1f}ms) | "
              f"Input: '{partial_input[:30]}...'")

        # Log the prediction with detailed timing
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "model": "gemini-2.5-flash",
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
            model="gemini-2.5-flash",
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

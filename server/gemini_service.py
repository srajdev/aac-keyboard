import json
import re
import time
from datetime import datetime
from pathlib import Path
from google import genai
from google.genai import types
from .prompts import SYSTEM_PROMPT_WITH_RULES, build_prediction_prompt
from .performance_tracker import get_tracker


# Initialize Gemini client with new SDK (lazy initialization)
import os
_gemini_client = None
_cached_system_prompt = None

def _get_gemini_client():
    """Lazy initialization of Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _gemini_client

def _get_or_create_cached_system_prompt():
    """Get or create cached system prompt for reuse across requests."""
    global _cached_system_prompt

    if _cached_system_prompt is None:
        client = _get_gemini_client()
        try:
            # Create cached content with system prompt
            # Cache TTL is 1 hour (3600 seconds)
            _cached_system_prompt = client.caches.create(
                model="gemini-2.5-flash",
                config=types.CreateCachedContentConfig(
                    contents=[
                        types.Content(
                            role="user",
                            parts=[types.Part(text=SYSTEM_PROMPT_WITH_RULES)]
                        )
                    ],
                    ttl="3600s",  # Cache for 1 hour
                    display_name="viraj-keyboard-system-prompt"
                )
            )
            print(f"[Cache] Created new cached system prompt: {_cached_system_prompt.name}")
        except Exception as e:
            print(f"[Cache] Failed to create cached content: {e}")
            # Return None if caching fails - will fall back to regular prompt
            return None

    return _cached_system_prompt

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "predictions.jsonl"

# Get performance tracker
perf_tracker = get_tracker(LOG_DIR)


def generate_predictions_gemini(partial_input: str, conversation_context: str) -> dict:
    """Generate predictions using Gemini 2.5 Flash with NEW SDK, thinking_budget=0, and context caching (SYNC)."""
    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Try to get cached system prompt
    cached_content = _get_or_create_cached_system_prompt()
    cache_hit = cached_content is not None

    # Timing: API call
    api_call_start = time.time()

    try:
        # Use new SDK with thinking_budget=0 for optimal speed
        client = _get_gemini_client()

        # Use cached content if available, otherwise fall back to full prompt
        if cached_content:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=user_prompt,  # Only send user prompt, system is cached
                config=types.GenerateContentConfig(
                    cached_content=cached_content.name,  # Reference cached system prompt
                    temperature=0.7,
                    max_output_tokens=1500,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0  # Disables slow reasoning mode - 40-50x speedup!
                    ),
                    safety_settings=[
                        types.SafetySetting(
                            category="HARM_CATEGORY_HARASSMENT",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_HATE_SPEECH",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold="BLOCK_NONE"
                        ),
                    ]
                )
            )
        else:
            # Fallback: no caching available, use full prompt
            full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=1500,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0
                    ),
                    safety_settings=[
                        types.SafetySetting(
                            category="HARM_CATEGORY_HARASSMENT",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_HATE_SPEECH",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold="BLOCK_NONE"
                        ),
                        types.SafetySetting(
                            category="HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold="BLOCK_NONE"
                        ),
                    ]
                )
            )

        api_call_ms = (time.time() - api_call_start) * 1000

        # Timing: parse
        parse_start = time.time()
        response_text = response.text.strip()

        # Remove markdown code blocks if present
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
              f"Cache: {'HIT' if cache_hit else 'MISS'} | "
              f"Input: '{partial_input[:30]}...'")

        # Log the prediction with detailed timing
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "model": "gemini-2.5-flash-new-sdk",
            "input": partial_input,
            "context": conversation_context,
            "response": result,
            "timings": {
                "prompt_build_ms": round(prompt_build_ms, 2),
                "api_call_ms": round(api_call_ms),
                "parse_ms": round(parse_ms, 2),
                "total_ms": round(prompt_build_ms + api_call_ms + parse_ms),
            },
            "cache": {
                "cache_hit": cache_hit,
            },
        }
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        # Record performance metrics
        perf_tracker.record_request(
            model="gemini-2.5-flash-new-sdk",
            latency_ms=api_call_ms,
            cache_hit=cache_hit,
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

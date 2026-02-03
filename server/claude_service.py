import json
import re
import time
from datetime import datetime
from pathlib import Path
import anthropic
from .prompts import SYSTEM_PROMPT_WITH_RULES, build_prediction_prompt


client = anthropic.Anthropic()

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "predictions.jsonl"


async def generate_predictions(partial_input: str, conversation_context: str) -> dict:
    """Generate predictions using Claude API with prompt caching."""
    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT_WITH_RULES,
                "cache_control": {"type": "ephemeral"}
            }
        ],
        messages=[{"role": "user", "content": user_prompt}],
    )
    api_call_ms = (time.time() - api_call_start) * 1000

    # Check for cache hits
    cache_hit = message.usage.cache_read_input_tokens > 0 if hasattr(message.usage, 'cache_read_input_tokens') else False
    cache_read_tokens = message.usage.cache_read_input_tokens if hasattr(message.usage, 'cache_read_input_tokens') else 0

    # Timing: parse
    parse_start = time.time()
    response_text = message.content[0].text

    # Log with detailed timing breakdown
    print(f"[Predictions] API: {api_call_ms:.0f}ms (prompt: {prompt_build_ms:.1f}ms) | "
          f"Cache: {'HIT' if cache_hit else 'MISS'} ({cache_read_tokens} tokens) | "
          f"Input: '{partial_input[:30]}...' | "
          f"Tokens: {message.usage.input_tokens}in/{message.usage.output_tokens}out")

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
                "model": "claude-haiku-4-5",
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
                    "cache_read_tokens": cache_read_tokens,
                },
                "tokens": {
                    "input": message.usage.input_tokens,
                    "output": message.usage.output_tokens,
                },
            }
            with open(LOG_FILE, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
            return result
        raise ValueError("No JSON found in response")
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Failed to parse Claude response: {response_text}")
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

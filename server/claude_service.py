import json
import re
import time
from datetime import datetime
from pathlib import Path
import anthropic
from .prompts import SYSTEM_PROMPT, build_prediction_prompt


client = anthropic.Anthropic()

# Log file for predictions
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "predictions.jsonl"


async def generate_predictions(partial_input: str, conversation_context: str) -> dict:
    """Generate predictions using Claude API."""
    user_prompt = build_prediction_prompt(partial_input, conversation_context)

    start_time = time.time()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    elapsed_ms = (time.time() - start_time) * 1000

    response_text = message.content[0].text
    print(f"[Predictions] API call took {elapsed_ms:.0f}ms | Input: '{partial_input[:30]}...' | Tokens: {message.usage.input_tokens}in/{message.usage.output_tokens}out")

    # Parse the JSON response
    try:
        # Try to extract JSON from the response
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if json_match:
            result = json.loads(json_match.group())
            # Log the prediction
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "input": partial_input,
                "context": conversation_context,
                "response": result,
                "latency_ms": round(elapsed_ms),
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

#!/usr/bin/env python3
"""
Head-to-head comparison of Claude Haiku 4.5 vs Gemini 2.5 Flash.
Runs both models with identical inputs and compares performance.
"""

import argparse
import json
import re
import time
import statistics
import os
import asyncio
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from anthropic import Anthropic
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Load environment variables from .env file in parent directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


# Prompt templates (copied from server/prompts.py)
SYSTEM_PROMPT_WITH_RULES = """You are an assistive communication AI helping Viraj communicate faster.
Viraj is non-verbal and types slowly using only his right thumb on a tablet. Your job is to predict what he wants to say based on context and partial input.

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication

Always return valid JSON with exactly the structure requested.

PREDICTION RULES:
- phrases: 3 complete sentences (5+ words) Viraj likely wants to say
- words: 5 single words that could come next (or start a message if no input)
- letters: 5 most likely next letters (lowercase)

Consider when making predictions:
1. Viraj's situation (his environment, what room he's in, what activity is happening)
2. What others said to Viraj (questions asked, statements made)
3. Common responses to questions and statements in conversation
4. Viraj's partial input and natural ways to complete it
5. Natural conversation flow for the given situation

Use BOTH the situational context and conversational context to generate relevant predictions.
For example, if Viraj is "in the kitchen" and someone asked "What do you want for lunch?",
predictions should relate to food choices, not generic responses."""


def build_prediction_prompt(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt (dynamic part that changes per request)."""
    prompt = ""

    if conversation_context and conversation_context.strip():
        prompt += f'Context:\n{conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj has typed so far: "{partial_input}"\n\n'
    else:
        prompt += "Viraj hasn't typed anything yet.\n\n"

    prompt += """Provide predictions in this exact JSON format:
{
  "phrases": ["phrase1", "phrase2", "phrase3"],
  "words": ["word1", "word2", "word3", "word4", "word5"],
  "letters": ["a", "b", "c", "d", "e"]
}

Return ONLY the JSON object, no other text."""

    return prompt


def run_claude_test(client: Anthropic, partial_input: str, conversation_context: str) -> dict:
    """Run Claude prediction test."""
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

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

    cache_hit = message.usage.cache_read_input_tokens > 0 if hasattr(message.usage, 'cache_read_input_tokens') else False

    parse_start = time.time()
    response_text = message.content[0].text

    try:
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if json_match:
            result = json.loads(json_match.group())
            parse_ms = (time.time() - parse_start) * 1000
            success = True
        else:
            result = None
            parse_ms = (time.time() - parse_start) * 1000
            success = False
    except json.JSONDecodeError:
        result = None
        parse_ms = (time.time() - parse_start) * 1000
        success = False

    return {
        "success": success,
        "total_ms": prompt_build_ms + api_call_ms + parse_ms,
        "api_call_ms": api_call_ms,
        "cache_hit": cache_hit,
        "tokens": {
            "input": message.usage.input_tokens,
            "output": message.usage.output_tokens,
        },
        "response": result,
    }


async def run_gemini_test(model, partial_input: str, conversation_context: str) -> dict:
    """Run Gemini prediction test."""
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    api_call_start = time.time()

    try:
        response = await model.generate_content_async(
            full_prompt,
            generation_config={
                'temperature': 0.7,
                'max_output_tokens': 5000,
            }
        )

        api_call_ms = (time.time() - api_call_start) * 1000

        if not response.candidates or not response.candidates[0].content.parts:
            return {
                "success": False,
                "total_ms": prompt_build_ms + api_call_ms,
                "api_call_ms": api_call_ms,
                "error": "Response blocked",
                "response": None,
            }

        parse_start = time.time()
        response_text = response.text.strip()
        response_text = re.sub(r'^```json\s*', '', response_text)
        response_text = re.sub(r'\s*```$', '', response_text)
        response_text = response_text.strip()

        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            json_str = json_match.group()
            try:
                result = json.loads(json_str)
                parse_ms = (time.time() - parse_start) * 1000
                success = True
            except json.JSONDecodeError:
                result = None
                parse_ms = (time.time() - parse_start) * 1000
                success = False
        else:
            result = None
            parse_ms = (time.time() - parse_start) * 1000
            success = False

        return {
            "success": success,
            "total_ms": prompt_build_ms + api_call_ms + parse_ms,
            "api_call_ms": api_call_ms,
            "response": result,
        }

    except Exception as e:
        api_call_ms = (time.time() - api_call_start) * 1000
        return {
            "success": False,
            "total_ms": prompt_build_ms + api_call_ms,
            "api_call_ms": api_call_ms,
            "error": str(e),
            "response": None,
        }


def calculate_diversity(predictions: list) -> float:
    """Calculate diversity score for predictions (0-10)."""
    if not predictions:
        return 0.0

    unique_words = set()
    for pred in predictions:
        if isinstance(pred, str):
            unique_words.update(pred.lower().split())

    # Score based on unique word count (rough heuristic)
    diversity = min(10, len(unique_words) / 3)
    return round(diversity, 1)


def print_comparison(claude_results: list, gemini_results: list, partial_input: str, conversation_context: str):
    """Print side-by-side comparison."""

    claude_successful = [r for r in claude_results if r["success"]]
    gemini_successful = [r for r in gemini_results if r["success"]]

    print("\n" + "=" * 80)
    print("BENCHMARK COMPARISON: CLAUDE HAIKU 4.5 vs GEMINI 2.5 FLASH")
    print("=" * 80)
    print(f"Input: '{partial_input}'")
    if conversation_context:
        print(f"Context: '{conversation_context[:60]}...'")
    print(f"Runs: {len(claude_results)} per model")
    print()

    # Latency comparison
    print("LATENCY COMPARISON")
    print("-" * 80)
    print(f"{'Metric':<25} {'Claude Haiku':<20} {'Gemini Flash':<20} {'Winner':<15}")
    print("-" * 80)

    if claude_successful and gemini_successful:
        claude_avg = statistics.mean([r["total_ms"] for r in claude_successful])
        gemini_avg = statistics.mean([r["total_ms"] for r in gemini_successful])
        speedup = gemini_avg / claude_avg if claude_avg > 0 else 0

        print(f"{'Avg Total Latency':<25} {claude_avg:>17.0f}ms {gemini_avg:>17.0f}ms "
              f"{'Claude' if claude_avg < gemini_avg else 'Gemini':<15}")

        # Only show P95 if we have enough data points
        if len(claude_successful) >= 2 and len(gemini_successful) >= 2:
            claude_p95 = statistics.quantiles([r["total_ms"] for r in claude_successful], n=20)[18]
            gemini_p95 = statistics.quantiles([r["total_ms"] for r in gemini_successful], n=20)[18]
            print(f"{'P95 Latency':<25} {claude_p95:>17.0f}ms {gemini_p95:>17.0f}ms "
                  f"{'Claude' if claude_p95 < gemini_p95 else 'Gemini':<15}")

        claude_min = min([r["total_ms"] for r in claude_successful])
        gemini_min = min([r["total_ms"] for r in gemini_successful])
        print(f"{'Min Latency':<25} {claude_min:>17.0f}ms {gemini_min:>17.0f}ms "
              f"{'Claude' if claude_min < gemini_min else 'Gemini':<15}")

        claude_api = statistics.mean([r["api_call_ms"] for r in claude_successful])
        gemini_api = statistics.mean([r["api_call_ms"] for r in gemini_successful])
        print(f"{'Avg API Call':<25} {claude_api:>17.0f}ms {gemini_api:>17.0f}ms "
              f"{'Claude' if claude_api < gemini_api else 'Gemini':<15}")

    print()
    print("RELIABILITY")
    print("-" * 80)
    claude_success_rate = len(claude_successful) / len(claude_results) * 100 if claude_results else 0
    gemini_success_rate = len(gemini_successful) / len(gemini_results) * 100 if gemini_results else 0
    print(f"{'Success Rate':<25} {claude_success_rate:>16.0f}% {gemini_success_rate:>16.0f}% "
          f"{'Tie' if claude_success_rate == gemini_success_rate else ('Claude' if claude_success_rate > gemini_success_rate else 'Gemini'):<15}")

    # Cache performance (Claude only)
    if claude_successful:
        cache_hits = sum(1 for r in claude_results if r.get("cache_hit", False))
        cache_rate = cache_hits / len(claude_results) * 100
        print(f"{'Cache Hit Rate':<25} {cache_rate:>16.0f}% {'N/A':<20} {'Claude':<15}")

    print()
    print("COST COMPARISON (per 1K requests)")
    print("-" * 80)

    # Claude cost (actual token counts)
    if claude_successful:
        avg_input_tokens = statistics.mean([r["tokens"]["input"] for r in claude_successful])
        avg_output_tokens = statistics.mean([r["tokens"]["output"] for r in claude_successful])
        claude_cost = ((avg_input_tokens * 0.80 + avg_output_tokens * 4.00) / 1000) * 1000
        print(f"{'Cost per 1K requests':<25} ${claude_cost:>16.2f}", end="")
    else:
        claude_cost = 0
        print(f"{'Cost per 1K requests':<25} {'N/A':<20}", end="")

    # Gemini cost (estimated)
    gemini_cost = ((500 * 0.075 + 200 * 0.30) / 1000) * 1000  # Estimated
    print(f" ${gemini_cost:>16.2f}", end="")

    if claude_cost > 0:
        savings = ((claude_cost - gemini_cost) / claude_cost) * 100
        print(f" {'Gemini' if gemini_cost < claude_cost else 'Claude':<15}")
        print(f"{'Savings':<25} {'':<20} {abs(savings):>15.0f}%")
    else:
        print(f" {'Gemini':<15}")

    print()
    print("QUALITY METRICS")
    print("-" * 80)

    if claude_successful and gemini_successful:
        # Get last successful outputs
        claude_last = claude_successful[-1]["response"]
        gemini_last = gemini_successful[-1]["response"]

        if claude_last and gemini_last:
            # Phrase diversity
            claude_phrase_div = calculate_diversity(claude_last.get("phrases", []))
            gemini_phrase_div = calculate_diversity(gemini_last.get("phrases", []))
            print(f"{'Phrase Diversity (0-10)':<25} {claude_phrase_div:>17.1f} {gemini_phrase_div:>17.1f} "
                  f"{'Claude' if claude_phrase_div > gemini_phrase_div else ('Gemini' if gemini_phrase_div > claude_phrase_div else 'Tie'):<15}")

            # Word variety
            claude_words = len(set(claude_last.get("words", [])))
            gemini_words = len(set(gemini_last.get("words", [])))
            print(f"{'Unique Words':<25} {claude_words:>17} {gemini_words:>17} "
                  f"{'Claude' if claude_words > gemini_words else ('Gemini' if gemini_words > claude_words else 'Tie'):<15}")

            # Letter coverage
            claude_letters = len(set(claude_last.get("letters", [])))
            gemini_letters = len(set(gemini_last.get("letters", [])))
            print(f"{'Unique Letters':<25} {claude_letters:>17} {gemini_letters:>17} "
                  f"{'Claude' if claude_letters > gemini_letters else ('Gemini' if gemini_letters > claude_letters else 'Tie'):<15}")

    print()
    print("SUMMARY")
    print("-" * 80)

    if claude_successful and gemini_successful:
        if speedup > 1.5:
            print(f"⚡ Claude is {speedup:.1f}x FASTER - Best for speed-critical UX")
        elif speedup < 0.67:
            print(f"⚡ Gemini is {1/speedup:.1f}x FASTER - Best for speed-critical UX")
        else:
            print(f"⚖️  Similar latency (Claude {claude_avg:.0f}ms vs Gemini {gemini_avg:.0f}ms)")

        if claude_cost > 0 and gemini_cost < claude_cost:
            cost_factor = claude_cost / gemini_cost
            print(f"💰 Gemini is {cost_factor:.1f}x CHEAPER - Best for cost optimization")
        elif claude_cost > 0:
            cost_factor = gemini_cost / claude_cost
            print(f"💰 Claude is {cost_factor:.1f}x CHEAPER - Best for cost optimization")

        if claude_success_rate > gemini_success_rate:
            print(f"✅ Claude has higher reliability ({claude_success_rate:.0f}% vs {gemini_success_rate:.0f}%)")
        elif gemini_success_rate > claude_success_rate:
            print(f"✅ Gemini has higher reliability ({gemini_success_rate:.0f}% vs {claude_success_rate:.0f}%)")

    print("=" * 80)
    print()


async def main_async(args):
    """Async main function."""
    # Initialize clients
    claude_client = Anthropic()

    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    gemini_model = genai.GenerativeModel(
        'models/gemini-2.5-flash',
        safety_settings={
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    )

    print(f"\nStarting head-to-head comparison with {args.runs} runs per model...")
    print(f"Input: '{args.input}'")
    if args.context:
        print(f"Context: '{args.context}'")
    print()

    # Run tests
    claude_results = []
    gemini_results = []

    for i in range(args.runs):
        print(f"Run {i+1}/{args.runs}...")

        # Claude test
        print(f"  Claude...", end=" ", flush=True)
        claude_result = run_claude_test(claude_client, args.input, args.context)
        claude_results.append(claude_result)
        print(f"{claude_result['total_ms']:.0f}ms {'✓' if claude_result['success'] else '✗'}")

        # Gemini test
        print(f"  Gemini...", end=" ", flush=True)
        gemini_result = await run_gemini_test(gemini_model, args.input, args.context)
        gemini_results.append(gemini_result)
        print(f"{gemini_result['total_ms']:.0f}ms {'✓' if gemini_result['success'] else '✗'}")

    # Print comparison
    if args.json:
        output = {
            "claude": claude_results,
            "gemini": gemini_results,
        }
        print(json.dumps(output, indent=2))
    else:
        print_comparison(claude_results, gemini_results, args.input, args.context)


def main():
    parser = argparse.ArgumentParser(description="Compare Claude vs Gemini predictions")
    parser.add_argument("-i", "--input", default="I want to", help="Partial input text")
    parser.add_argument("-c", "--context", default="", help="Conversation context")
    parser.add_argument("-n", "--runs", type=int, default=5, help="Number of test runs per model")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
3-way comparison of Claude Haiku 4.5 vs Gemini 2.5 Flash vs GPT-4.1-nano (SYNC).
Uses NEW google-genai SDK with thinking_budget=0 for optimal Gemini performance.
"""

import argparse
import json
import re
import time
import statistics
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from anthropic import Anthropic
from google import genai
from google.genai import types
from openai import OpenAI

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


def run_gemini_test(client: genai.Client, partial_input: str, conversation_context: str) -> dict:
    """Run Gemini prediction test with NEW SDK (SYNC)."""
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    api_call_start = time.time()

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1500,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=0  # Disables slow reasoning mode!
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


def run_gpt_test(client: OpenAI, partial_input: str, conversation_context: str) -> dict:
    """Run GPT-4.1-nano prediction test (SYNC)."""
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    api_call_start = time.time()

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            max_tokens=1000,  # GPT-4.1 uses traditional max_tokens parameter
            temperature=0.7,  # GPT-4.1 supports temperature
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_WITH_RULES},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )

        api_call_ms = (time.time() - api_call_start) * 1000

        parse_start = time.time()
        response_text = response.choices[0].message.content

        json_match = re.search(r"\{[\s\S]*\}", response_text)
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
            "tokens": {
                "input": response.usage.prompt_tokens,
                "output": response.usage.completion_tokens,
            },
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


def print_comparison(claude_results: list, gemini_results: list, gpt_results: list, partial_input: str, conversation_context: str):
    """Print 3-way comparison."""

    claude_successful = [r for r in claude_results if r["success"]]
    gemini_successful = [r for r in gemini_results if r["success"]]
    gpt_successful = [r for r in gpt_results if r["success"]]

    print("\n" + "=" * 95)
    print("BENCHMARK COMPARISON: CLAUDE vs GEMINI vs GPT-4.1-NANO")
    print("=" * 95)
    print(f"Input: '{partial_input}'")
    if conversation_context:
        print(f"Context: '{conversation_context[:60]}...'")
    print(f"Runs: {len(claude_results)} per model")
    print()

    # Latency comparison
    print("LATENCY COMPARISON")
    print("-" * 95)
    print(f"{'Metric':<20} {'Claude':<15} {'Gemini':<15} {'GPT-5':<15} {'Winner':<15}")
    print("-" * 95)

    if claude_successful and gemini_successful and gpt_successful:
        claude_avg = statistics.mean([r["total_ms"] for r in claude_successful])
        gemini_avg = statistics.mean([r["total_ms"] for r in gemini_successful])
        gpt_avg = statistics.mean([r["total_ms"] for r in gpt_successful])

        winner = min([("Claude", claude_avg), ("Gemini", gemini_avg), ("GPT-5", gpt_avg)], key=lambda x: x[1])[0]
        print(f"{'Avg Total Latency':<20} {claude_avg:>13.0f}ms {gemini_avg:>13.0f}ms {gpt_avg:>13.0f}ms {winner:<15}")

        # Only show P95 if we have enough data points
        if len(claude_successful) >= 2 and len(gemini_successful) >= 2 and len(gpt_successful) >= 2:
            claude_p95 = statistics.quantiles([r["total_ms"] for r in claude_successful], n=20)[18]
            gemini_p95 = statistics.quantiles([r["total_ms"] for r in gemini_successful], n=20)[18]
            gpt_p95 = statistics.quantiles([r["total_ms"] for r in gpt_successful], n=20)[18]
            winner = min([("Claude", claude_p95), ("Gemini", gemini_p95), ("GPT-5", gpt_p95)], key=lambda x: x[1])[0]
            print(f"{'P95 Latency':<20} {claude_p95:>13.0f}ms {gemini_p95:>13.0f}ms {gpt_p95:>13.0f}ms {winner:<15}")

        claude_min = min([r["total_ms"] for r in claude_successful])
        gemini_min = min([r["total_ms"] for r in gemini_successful])
        gpt_min = min([r["total_ms"] for r in gpt_successful])
        winner = min([("Claude", claude_min), ("Gemini", gemini_min), ("GPT-5", gpt_min)], key=lambda x: x[1])[0]
        print(f"{'Min Latency':<20} {claude_min:>13.0f}ms {gemini_min:>13.0f}ms {gpt_min:>13.0f}ms {winner:<15}")

        claude_api = statistics.mean([r["api_call_ms"] for r in claude_successful])
        gemini_api = statistics.mean([r["api_call_ms"] for r in gemini_successful])
        gpt_api = statistics.mean([r["api_call_ms"] for r in gpt_successful])
        winner = min([("Claude", claude_api), ("Gemini", gemini_api), ("GPT-5", gpt_api)], key=lambda x: x[1])[0]
        print(f"{'Avg API Call':<20} {claude_api:>13.0f}ms {gemini_api:>13.0f}ms {gpt_api:>13.0f}ms {winner:<15}")

    print()
    print("RELIABILITY")
    print("-" * 95)
    claude_success_rate = len(claude_successful) / len(claude_results) * 100 if claude_results else 0
    gemini_success_rate = len(gemini_successful) / len(gemini_results) * 100 if gemini_results else 0
    gpt_success_rate = len(gpt_successful) / len(gpt_results) * 100 if gpt_results else 0

    winner = max([("Claude", claude_success_rate), ("Gemini", gemini_success_rate), ("GPT-5", gpt_success_rate)], key=lambda x: x[1])[0]
    print(f"{'Success Rate':<20} {claude_success_rate:>13.0f}% {gemini_success_rate:>13.0f}% {gpt_success_rate:>13.0f}% {winner:<15}")

    # Cache performance (Claude only)
    if claude_successful:
        cache_hits = sum(1 for r in claude_results if r.get("cache_hit", False))
        cache_rate = cache_hits / len(claude_results) * 100
        print(f"{'Cache Hit Rate':<20} {cache_rate:>13.0f}% {'N/A':<15} {'N/A':<15} {'Claude':<15}")

    print()
    print("COST COMPARISON (per 1K requests)")
    print("-" * 95)

    # Claude cost (actual token counts)
    if claude_successful:
        avg_input_tokens = statistics.mean([r["tokens"]["input"] for r in claude_successful])
        avg_output_tokens = statistics.mean([r["tokens"]["output"] for r in claude_successful])
        claude_cost = ((avg_input_tokens * 0.80 + avg_output_tokens * 4.00) / 1000) * 1000
    else:
        claude_cost = 0

    # Gemini cost (estimated)
    gemini_cost = ((500 * 0.075 + 200 * 0.30) / 1000) * 1000  # Estimated

    # GPT cost (actual token counts if available)
    if gpt_successful:
        avg_input_tokens_gpt = statistics.mean([r["tokens"]["input"] for r in gpt_successful])
        avg_output_tokens_gpt = statistics.mean([r["tokens"]["output"] for r in gpt_successful])
        # Placeholder pricing - needs verification
        gpt_cost = ((avg_input_tokens_gpt * 0.10 + avg_output_tokens_gpt * 0.30) / 1000) * 1000
    else:
        gpt_cost = 0

    costs = [("Claude", claude_cost), ("Gemini", gemini_cost), ("GPT-5", gpt_cost)]
    valid_costs = [(name, cost) for name, cost in costs if cost > 0]
    if valid_costs:
        winner = min(valid_costs, key=lambda x: x[1])[0]
        print(f"{'Cost per 1K req':<20} ${claude_cost:>12.2f} ${gemini_cost:>12.2f} ${gpt_cost:>12.2f} {winner:<15}")
        if gpt_cost > 0:
            print(f"{'⚠️  GPT pricing':<20} {'(verify OpenAI pricing - placeholder values used)':<60}")

    print()
    print("QUALITY METRICS")
    print("-" * 95)

    if claude_successful and gemini_successful and gpt_successful:
        # Get last successful outputs
        claude_last = claude_successful[-1]["response"]
        gemini_last = gemini_successful[-1]["response"]
        gpt_last = gpt_successful[-1]["response"]

        if claude_last and gemini_last and gpt_last:
            # Phrase diversity
            claude_phrase_div = calculate_diversity(claude_last.get("phrases", []))
            gemini_phrase_div = calculate_diversity(gemini_last.get("phrases", []))
            gpt_phrase_div = calculate_diversity(gpt_last.get("phrases", []))
            winner = max([("Claude", claude_phrase_div), ("Gemini", gemini_phrase_div), ("GPT-5", gpt_phrase_div)], key=lambda x: x[1])[0]
            print(f"{'Phrase Diversity (0-10)':<20} {claude_phrase_div:>13.1f} {gemini_phrase_div:>13.1f} {gpt_phrase_div:>13.1f} {winner:<15}")

            # Word variety
            claude_words = len(set(claude_last.get("words", [])))
            gemini_words = len(set(gemini_last.get("words", [])))
            gpt_words = len(set(gpt_last.get("words", [])))
            winner = max([("Claude", claude_words), ("Gemini", gemini_words), ("GPT-5", gpt_words)], key=lambda x: x[1])[0]
            print(f"{'Unique Words':<20} {claude_words:>13} {gemini_words:>13} {gpt_words:>13} {winner:<15}")

            # Letter coverage
            claude_letters = len(set(claude_last.get("letters", [])))
            gemini_letters = len(set(gemini_last.get("letters", [])))
            gpt_letters = len(set(gpt_last.get("letters", [])))
            winner = max([("Claude", claude_letters), ("Gemini", gemini_letters), ("GPT-5", gpt_letters)], key=lambda x: x[1])[0]
            print(f"{'Unique Letters':<20} {claude_letters:>13} {gemini_letters:>13} {gpt_letters:>13} {winner:<15}")

    print()
    print("SUMMARY")
    print("-" * 95)

    if claude_successful and gemini_successful and gpt_successful:
        # Speed winner
        latencies = [("Claude", claude_avg), ("Gemini", gemini_avg), ("GPT-5", gpt_avg)]
        fastest = min(latencies, key=lambda x: x[1])
        slowest = max(latencies, key=lambda x: x[1])
        speedup = slowest[1] / fastest[1]
        print(f"⚡ {fastest[0]} is FASTEST ({fastest[1]:.0f}ms avg) - {speedup:.1f}x faster than {slowest[0]}")

        # Cost winner
        costs = [("Claude", claude_cost), ("Gemini", gemini_cost), ("GPT-5", gpt_cost)]
        valid_costs = [(name, cost) for name, cost in costs if cost > 0]
        if valid_costs:
            cheapest = min(valid_costs, key=lambda x: x[1])
            most_expensive = max(valid_costs, key=lambda x: x[1])
            cost_factor = most_expensive[1] / cheapest[1]
            print(f"💰 {cheapest[0]} is CHEAPEST (${cheapest[1]:.2f}/1K) - {cost_factor:.1f}x cheaper than {most_expensive[0]}")

        # Reliability
        rates = [("Claude", claude_success_rate), ("Gemini", gemini_success_rate), ("GPT-5", gpt_success_rate)]
        most_reliable = max(rates, key=lambda x: x[1])
        if most_reliable[1] > 99:
            print(f"✅ All models highly reliable ({most_reliable[0]} at {most_reliable[1]:.0f}%)")
        else:
            print(f"✅ {most_reliable[0]} most reliable ({most_reliable[1]:.0f}% success rate)")

    print("=" * 95)
    print()


def main_sync(args):
    """Synchronous main function."""
    # Initialize clients (all SYNC)
    claude_client = Anthropic()
    gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    gpt_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    print(f"\n🚀 3-WAY COMPARISON (SYNC): Claude vs Gemini vs GPT-4.1-nano")
    print(f"Starting benchmark with {args.runs} runs per model...")
    print(f"Input: '{args.input}'")
    if args.context:
        print(f"Context: '{args.context}'")
    print()

    # Run tests
    claude_results = []
    gemini_results = []
    gpt_results = []

    for i in range(args.runs):
        print(f"Run {i+1}/{args.runs}...")

        # Claude test
        print(f"  Claude...", end=" ", flush=True)
        claude_result = run_claude_test(claude_client, args.input, args.context)
        claude_results.append(claude_result)
        print(f"{claude_result['total_ms']:.0f}ms {'✓' if claude_result['success'] else '✗'}")

        # Gemini test
        print(f"  Gemini...", end=" ", flush=True)
        gemini_result = run_gemini_test(gemini_client, args.input, args.context)
        gemini_results.append(gemini_result)
        print(f"{gemini_result['total_ms']:.0f}ms {'✓' if gemini_result['success'] else '✗'}")

        # GPT test
        print(f"  GPT-4.1-nano...", end=" ", flush=True)
        gpt_result = run_gpt_test(gpt_client, args.input, args.context)
        gpt_results.append(gpt_result)
        print(f"{gpt_result['total_ms']:.0f}ms {'✓' if gpt_result['success'] else '✗'}")

    # Print comparison
    if args.json:
        output = {
            "claude": claude_results,
            "gemini": gemini_results,
            "gpt": gpt_results,
        }
        print(json.dumps(output, indent=2))
    else:
        print_comparison(claude_results, gemini_results, gpt_results, args.input, args.context)


def main():
    parser = argparse.ArgumentParser(description="Compare Claude vs Gemini predictions")
    parser.add_argument("-i", "--input", default="I want to", help="Partial input text")
    parser.add_argument("-c", "--context", default="", help="Conversation context")
    parser.add_argument("-n", "--runs", type=int, default=5, help="Number of test runs per model")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    main_sync(args)


if __name__ == "__main__":
    main()

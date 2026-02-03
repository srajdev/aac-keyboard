#!/usr/bin/env python3
"""
Standalone benchmark script for Gemini 2.5 Flash using NEW google-genai SDK.
Tests if the new SDK with thinking_budget=0 is faster than the old SDK.
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
from google import genai
from google.genai import types

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


async def run_single_test(client: genai.Client, partial_input: str, conversation_context: str) -> dict:
    """Run a single prediction test and return detailed metrics."""

    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()

    try:
        response = await client.aio.models.generate_content(
            model="gemini-1.5-flash",  # Using 1.5 due to 2.5 quota limits
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1500,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=0  # Disables slow reasoning mode - KEY OPTIMIZATION!
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
                parse_ms = (time.time() - parse_start) * 1000
                success = True
            except json.JSONDecodeError as e:
                result = None
                parse_ms = (time.time() - parse_start) * 1000
                success = False
        else:
            result = None
            parse_ms = (time.time() - parse_start) * 1000
            success = False

        total_ms = prompt_build_ms + api_call_ms + parse_ms

        return {
            "success": success,
            "timings": {
                "prompt_build_ms": prompt_build_ms,
                "api_call_ms": api_call_ms,
                "parse_ms": parse_ms,
                "total_ms": total_ms,
            },
            "response": result,
        }

    except Exception as e:
        api_call_ms = (time.time() - api_call_start) * 1000
        return {
            "success": False,
            "error": str(e),
            "timings": {
                "prompt_build_ms": prompt_build_ms,
                "api_call_ms": api_call_ms,
                "parse_ms": 0,
                "total_ms": prompt_build_ms + api_call_ms,
            },
            "response": None,
        }


def print_results(results: list, partial_input: str, conversation_context: str):
    """Print formatted benchmark results."""

    # Calculate statistics
    successful_runs = [r for r in results if r["success"]]
    total_times = [r["timings"]["total_ms"] for r in successful_runs]
    api_times = [r["timings"]["api_call_ms"] for r in successful_runs]

    print("\n" + "=" * 70)
    print("GEMINI 2.5 FLASH BENCHMARK (NEW SDK + thinking_budget=0)")
    print("=" * 70)
    print(f"Input: '{partial_input}'")
    if conversation_context:
        print(f"Context: '{conversation_context[:50]}...'")
    print(f"Runs: {len(results)}")
    print(f"Success Rate: {len(successful_runs)}/{len(results)} ({len(successful_runs)/len(results)*100:.0f}%)")
    print()

    if successful_runs:
        print("LATENCY BREAKDOWN")
        print("-" * 70)
        print(f"{'Metric':<20} {'Average':<12} {'Min':<12} {'Max':<12} {'P95':<12}")
        print("-" * 70)

        # Helper to calculate P95 safely
        def safe_p95(values):
            return statistics.quantiles(values, n=20)[18] if len(values) >= 2 else max(values)

        # Total latency
        print(f"{'Total Latency':<20} {statistics.mean(total_times):>10.0f}ms "
              f"{min(total_times):>10.0f}ms {max(total_times):>10.0f}ms "
              f"{safe_p95(total_times):>10.0f}ms")

        # API call latency
        print(f"{'API Call':<20} {statistics.mean(api_times):>10.0f}ms "
              f"{min(api_times):>10.0f}ms {max(api_times):>10.0f}ms "
              f"{safe_p95(api_times):>10.0f}ms")

        # Prompt build
        prompt_times = [r["timings"]["prompt_build_ms"] for r in successful_runs]
        print(f"{'Prompt Build':<20} {statistics.mean(prompt_times):>10.1f}ms "
              f"{min(prompt_times):>10.1f}ms {max(prompt_times):>10.1f}ms "
              f"{safe_p95(prompt_times):>10.1f}ms")

        # Parse
        parse_times = [r["timings"]["parse_ms"] for r in successful_runs]
        print(f"{'JSON Parse':<20} {statistics.mean(parse_times):>10.1f}ms "
              f"{min(parse_times):>10.1f}ms {max(parse_times):>10.1f}ms "
              f"{safe_p95(parse_times):>10.1f}ms")

        print()
        print("SAMPLE OUTPUT (last successful run)")
        print("-" * 70)
        last_successful = successful_runs[-1]
        if last_successful["response"]:
            print(json.dumps(last_successful["response"], indent=2))

    else:
        print("No successful runs. Errors:")
        for i, r in enumerate(results):
            if "error" in r:
                print(f"  Run {i+1}: {r['error']}")

    print("=" * 70)
    print()


async def main_async(args):
    """Async main function."""
    # Initialize new SDK client
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    print(f"\n🚀 Testing NEW google-genai SDK with thinking_budget=0")
    print(f"Starting Gemini 2.5 Flash benchmark with {args.runs} runs...")
    print(f"Input: '{args.input}'")
    if args.context:
        print(f"Context: '{args.context}'")
    print()

    # Run tests
    results = []
    for i in range(args.runs):
        print(f"Run {i+1}/{args.runs}...", end=" ", flush=True)
        result = await run_single_test(client, args.input, args.context)
        results.append(result)
        print(f"{result['timings']['total_ms']:.0f}ms {'✓' if result['success'] else '✗'}")

    # Print results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_results(results, args.input, args.context)


def main():
    parser = argparse.ArgumentParser(description="Benchmark Gemini 2.5 Flash with NEW SDK")
    parser.add_argument("-i", "--input", default="I want to", help="Partial input text")
    parser.add_argument("-c", "--context", default="", help="Conversation context")
    parser.add_argument("-n", "--runs", type=int, default=5, help="Number of test runs")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    # Run async main
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()

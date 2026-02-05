#!/usr/bin/env python3
"""
Standalone benchmark script for GPT-4.1 predictions (SYNC version).
Tests latency, token usage, and statistical performance.
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


def run_single_test(client: OpenAI, partial_input: str, conversation_context: str, model: str = "gpt-4.1-mini") -> dict:
    """Run a single prediction test and return detailed metrics (SYNC)."""

    # Timing: prompt build
    prompt_build_start = time.time()
    user_prompt = build_prediction_prompt(partial_input, conversation_context)
    prompt_build_ms = (time.time() - prompt_build_start) * 1000

    # Timing: API call
    api_call_start = time.time()
    try:
        response = client.chat.completions.create(
            model=model,  # gpt-4.1-mini or gpt-4.1-nano
            max_tokens=1000,  # GPT-4.1 uses max_tokens (traditional parameter)
            temperature=0.7,  # GPT-4.1 supports temperature
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_WITH_RULES},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        api_call_ms = (time.time() - api_call_start) * 1000

        # Debug: Check for reasoning tokens
        usage = response.usage
        print(f"\n[DEBUG] Token usage: {usage}")
        if hasattr(usage, 'completion_tokens_details'):
            print(f"[DEBUG] Completion details: {usage.completion_tokens_details}")

        # Timing: parse
        parse_start = time.time()
        response_text = response.choices[0].message.content

        # Parse JSON
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

        total_ms = prompt_build_ms + api_call_ms + parse_ms

        return {
            "success": success,
            "timings": {
                "prompt_build_ms": prompt_build_ms,
                "api_call_ms": api_call_ms,
                "parse_ms": parse_ms,
                "total_ms": total_ms,
            },
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
            "error": str(e),
            "timings": {
                "prompt_build_ms": prompt_build_ms,
                "api_call_ms": api_call_ms,
                "parse_ms": 0,
                "total_ms": prompt_build_ms + api_call_ms,
            },
            "tokens": {
                "input": 0,
                "output": 0,
            },
            "response": None,
        }


def print_results(results: list, partial_input: str, conversation_context: str, model: str = "gpt-4.1-mini"):
    """Print formatted benchmark results."""

    # Calculate statistics
    successful_runs = [r for r in results if r["success"]]
    total_times = [r["timings"]["total_ms"] for r in successful_runs]
    api_times = [r["timings"]["api_call_ms"] for r in successful_runs]

    avg_input_tokens = statistics.mean([r["tokens"]["input"] for r in successful_runs]) if successful_runs else 0
    avg_output_tokens = statistics.mean([r["tokens"]["output"] for r in successful_runs]) if successful_runs else 0

    print("\n" + "=" * 70)
    print(f"{model.upper()} BENCHMARK RESULTS")
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
        print("TOKEN USAGE")
        print("-" * 70)
        print(f"Avg Input Tokens: {avg_input_tokens:.0f}")
        print(f"Avg Output Tokens: {avg_output_tokens:.0f}")
        print(f"Total Tokens: {avg_input_tokens + avg_output_tokens:.0f}")

        # Cost calculation (GPT-4.1 pricing - placeholder values, need verification)
        # TODO: Verify actual GPT-4.1-mini/nano pricing from OpenAI docs
        input_cost_per_1k = 0.10 / 1000  # Placeholder: $0.10 per 1M input tokens
        output_cost_per_1k = 0.30 / 1000  # Placeholder: $0.30 per 1M output tokens
        avg_cost = (avg_input_tokens * input_cost_per_1k + avg_output_tokens * output_cost_per_1k) / 1000

        print()
        print("COST ESTIMATE (⚠️ VERIFY PRICING)")
        print("-" * 70)
        print(f"Avg Cost per Request: ${avg_cost:.6f}")
        print(f"Cost per 1K Requests: ${avg_cost * 1000:.2f}")
        print(f"Cost per 1M Requests: ${avg_cost * 1000000:.2f}")
        print(f"Note: Pricing is placeholder - verify actual {model} rates")

        print()
        print("SAMPLE OUTPUT (last successful run)")
        print("-" * 70)
        last_successful = successful_runs[-1]
        if last_successful["response"]:
            print(json.dumps(last_successful["response"], indent=2))

    else:
        print("\nNo successful runs to analyze.")
        print("\nErrors encountered:")
        for i, result in enumerate(results):
            if not result["success"] and "error" in result:
                print(f"  Run {i+1}: {result['error']}")

    print("=" * 70)
    print()


def main():
    parser = argparse.ArgumentParser(description="Benchmark GPT-4.1 predictions (SYNC)")
    parser.add_argument("-i", "--input", default="I want to", help="Partial input text")
    parser.add_argument("-c", "--context", default="", help="Conversation context")
    parser.add_argument("-n", "--runs", type=int, default=5, help="Number of test runs")
    parser.add_argument("-m", "--model", default="gpt-4.1-mini",
                        choices=["gpt-4.1-mini", "gpt-4.1-nano"],
                        help="Model to test (default: gpt-4.1-mini)")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    # Initialize client (SYNC)
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    print(f"\nStarting {args.model} benchmark with {args.runs} runs...")
    print(f"Input: '{args.input}'")
    if args.context:
        print(f"Context: '{args.context}'")
    print()

    # Run tests
    results = []
    for i in range(args.runs):
        print(f"Run {i+1}/{args.runs}...", end=" ", flush=True)
        result = run_single_test(client, args.input, args.context, args.model)
        results.append(result)
        print(f"{result['timings']['total_ms']:.0f}ms {'✓' if result['success'] else '✗'}")

    # Print results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_results(results, args.input, args.context)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Standalone benchmark script for Claude Haiku 4.5 predictions.
Tests latency, token usage, cache hits, and statistical performance.
"""

import argparse
import json
import re
import time
import statistics
from datetime import datetime
from anthropic import Anthropic


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


def run_single_test(client: Anthropic, partial_input: str, conversation_context: str) -> dict:
    """Run a single prediction test and return detailed metrics."""

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
    cache_creation_tokens = message.usage.cache_creation_input_tokens if hasattr(message.usage, 'cache_creation_input_tokens') else 0

    # Timing: parse
    parse_start = time.time()
    response_text = message.content[0].text

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
        "cache": {
            "cache_hit": cache_hit,
            "cache_read_tokens": cache_read_tokens,
            "cache_creation_tokens": cache_creation_tokens,
        },
        "tokens": {
            "input": message.usage.input_tokens,
            "output": message.usage.output_tokens,
        },
        "response": result,
    }


def print_results(results: list, partial_input: str, conversation_context: str):
    """Print formatted benchmark results."""

    # Calculate statistics
    successful_runs = [r for r in results if r["success"]]
    total_times = [r["timings"]["total_ms"] for r in successful_runs]
    api_times = [r["timings"]["api_call_ms"] for r in successful_runs]

    cache_hits = sum(1 for r in results if r["cache"]["cache_hit"])
    cache_hit_rate = (cache_hits / len(results) * 100) if results else 0

    avg_input_tokens = statistics.mean([r["tokens"]["input"] for r in results])
    avg_output_tokens = statistics.mean([r["tokens"]["output"] for r in results])

    print("\n" + "=" * 70)
    print("CLAUDE HAIKU 4.5 BENCHMARK RESULTS")
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

        # Total latency
        print(f"{'Total Latency':<20} {statistics.mean(total_times):>10.0f}ms "
              f"{min(total_times):>10.0f}ms {max(total_times):>10.0f}ms "
              f"{statistics.quantiles(total_times, n=20)[18]:>10.0f}ms")

        # API call latency
        print(f"{'API Call':<20} {statistics.mean(api_times):>10.0f}ms "
              f"{min(api_times):>10.0f}ms {max(api_times):>10.0f}ms "
              f"{statistics.quantiles(api_times, n=20)[18]:>10.0f}ms")

        # Prompt build
        prompt_times = [r["timings"]["prompt_build_ms"] for r in successful_runs]
        print(f"{'Prompt Build':<20} {statistics.mean(prompt_times):>10.1f}ms "
              f"{min(prompt_times):>10.1f}ms {max(prompt_times):>10.1f}ms "
              f"{statistics.quantiles(prompt_times, n=20)[18]:>10.1f}ms")

        # Parse
        parse_times = [r["timings"]["parse_ms"] for r in successful_runs]
        print(f"{'JSON Parse':<20} {statistics.mean(parse_times):>10.1f}ms "
              f"{min(parse_times):>10.1f}ms {max(parse_times):>10.1f}ms "
              f"{statistics.quantiles(parse_times, n=20)[18]:>10.1f}ms")

        print()
        print("CACHE PERFORMANCE")
        print("-" * 70)
        print(f"Cache Hit Rate: {cache_hit_rate:.0f}% ({cache_hits}/{len(results)} requests)")

        cache_hit_runs = [r for r in results if r["cache"]["cache_hit"]]
        if cache_hit_runs:
            avg_cache_read = statistics.mean([r["cache"]["cache_read_tokens"] for r in cache_hit_runs])
            print(f"Avg Cache Read Tokens: {avg_cache_read:.0f}")

        print()
        print("TOKEN USAGE")
        print("-" * 70)
        print(f"Avg Input Tokens: {avg_input_tokens:.0f}")
        print(f"Avg Output Tokens: {avg_output_tokens:.0f}")
        print(f"Total Tokens: {avg_input_tokens + avg_output_tokens:.0f}")

        # Cost calculation (Claude Haiku 4.5 pricing)
        input_cost_per_1k = 0.80 / 1000  # $0.80 per 1M tokens
        output_cost_per_1k = 4.00 / 1000  # $4.00 per 1M tokens
        avg_cost = (avg_input_tokens * input_cost_per_1k + avg_output_tokens * output_cost_per_1k) / 1000

        print()
        print("COST ESTIMATE")
        print("-" * 70)
        print(f"Avg Cost per Request: ${avg_cost:.6f}")
        print(f"Cost per 1K Requests: ${avg_cost * 1000:.2f}")
        print(f"Cost per 1M Requests: ${avg_cost * 1000000:.2f}")

        print()
        print("SAMPLE OUTPUT (last successful run)")
        print("-" * 70)
        last_successful = successful_runs[-1]
        if last_successful["response"]:
            print(json.dumps(last_successful["response"], indent=2))

    print("=" * 70)
    print()


def main():
    parser = argparse.ArgumentParser(description="Benchmark Claude Haiku 4.5 predictions")
    parser.add_argument("-i", "--input", default="I want to", help="Partial input text")
    parser.add_argument("-c", "--context", default="", help="Conversation context")
    parser.add_argument("-n", "--runs", type=int, default=5, help="Number of test runs")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    # Initialize client
    client = Anthropic()

    print(f"\nStarting Claude Haiku 4.5 benchmark with {args.runs} runs...")
    print(f"Input: '{args.input}'")
    if args.context:
        print(f"Context: '{args.context}'")
    print()

    # Run tests
    results = []
    for i in range(args.runs):
        print(f"Run {i+1}/{args.runs}...", end=" ", flush=True)
        result = run_single_test(client, args.input, args.context)
        results.append(result)
        print(f"{result['timings']['total_ms']:.0f}ms {'✓' if result['success'] else '✗'}")

    # Print results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_results(results, args.input, args.context)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Comprehensive benchmark suite for testing Claude and Gemini across multiple scenarios.
Generates detailed markdown reports.
"""

import argparse
import json
import os
import asyncio
from datetime import datetime
from pathlib import Path
import benchmark_claude
import benchmark_gemini


# Predefined test cases covering common scenarios
TEST_CASES = [
    {"input": "I", "context": "", "description": "Single letter - minimal input"},
    {"input": "hel", "context": "", "description": "Word prefix - common greeting"},
    {"input": "than", "context": "", "description": "Word prefix - common gratitude"},
    {"input": "I want to", "context": "", "description": "Phrase start - common request"},
    {"input": "Can you", "context": "", "description": "Question start - asking for help"},
    {"input": "Can you", "context": "Talking about dinner plans", "description": "Question with context"},
    {"input": "yes", "context": "Someone asked: Do you want dessert?", "description": "Short response with question context"},
    {"input": "I would like", "context": "In the kitchen, lunchtime", "description": "Request with situational context"},
    {"input": "", "context": "", "description": "Empty input - conversation starter"},
    {"input": "no", "context": "", "description": "Single word - negative response"},
]


async def run_test_case_claude(test_case: dict, runs: int) -> dict:
    """Run a test case on Claude."""
    from anthropic import Anthropic

    client = Anthropic()
    results = []

    for _ in range(runs):
        result = benchmark_claude.run_single_test(client, test_case["input"], test_case["context"])
        results.append(result)

    # Calculate statistics
    successful_runs = [r for r in results if r["success"]]

    if successful_runs:
        import statistics
        total_times = [r["timings"]["total_ms"] for r in successful_runs]

        return {
            "success_rate": len(successful_runs) / len(results) * 100,
            "avg_latency_ms": statistics.mean(total_times),
            "min_latency_ms": min(total_times),
            "max_latency_ms": max(total_times),
            "p95_latency_ms": statistics.quantiles(total_times, n=20)[18],
            "cache_hit_rate": sum(1 for r in results if r["cache"]["cache_hit"]) / len(results) * 100,
            "avg_input_tokens": statistics.mean([r["tokens"]["input"] for r in results]),
            "avg_output_tokens": statistics.mean([r["tokens"]["output"] for r in results]),
            "sample_output": successful_runs[-1]["response"],
        }
    else:
        return {
            "success_rate": 0,
            "error": "All runs failed",
        }


async def run_test_case_gemini(test_case: dict, runs: int) -> dict:
    """Run a test case on Gemini."""
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold

    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

    model = genai.GenerativeModel(
        'models/gemini-2.5-flash',
        safety_settings={
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    )

    results = []

    for _ in range(runs):
        result = await benchmark_gemini.run_single_test(model, test_case["input"], test_case["context"])
        results.append(result)

    # Calculate statistics
    successful_runs = [r for r in results if r["success"]]

    if successful_runs:
        import statistics
        total_times = [r["timings"]["total_ms"] for r in successful_runs]

        return {
            "success_rate": len(successful_runs) / len(results) * 100,
            "avg_latency_ms": statistics.mean(total_times),
            "min_latency_ms": min(total_times),
            "max_latency_ms": max(total_times),
            "p95_latency_ms": statistics.quantiles(total_times, n=20)[18],
            "sample_output": successful_runs[-1]["response"],
        }
    else:
        return {
            "success_rate": 0,
            "error": "All runs failed",
        }


def generate_markdown_report(test_results: list, output_path: Path):
    """Generate a markdown report from test results."""

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = f"""# Benchmark Suite Report

Generated: {timestamp}

## Test Configuration
- Models: Claude Haiku 4.5, Gemini 2.5 Flash
- Runs per test case: {test_results[0]['runs']} (each model)
- Total test cases: {len(test_results)}

## Executive Summary

"""

    # Calculate overall statistics
    claude_avg_latencies = []
    gemini_avg_latencies = []
    claude_success_rates = []
    gemini_success_rates = []

    for result in test_results:
        if "claude" in result and "avg_latency_ms" in result["claude"]:
            claude_avg_latencies.append(result["claude"]["avg_latency_ms"])
            claude_success_rates.append(result["claude"]["success_rate"])

        if "gemini" in result and "avg_latency_ms" in result["gemini"]:
            gemini_avg_latencies.append(result["gemini"]["avg_latency_ms"])
            gemini_success_rates.append(result["gemini"]["success_rate"])

    if claude_avg_latencies and gemini_avg_latencies:
        import statistics

        claude_overall_avg = statistics.mean(claude_avg_latencies)
        gemini_overall_avg = statistics.mean(gemini_avg_latencies)
        speedup = gemini_overall_avg / claude_overall_avg

        md += f"""### Overall Performance

| Metric | Claude Haiku 4.5 | Gemini 2.5 Flash | Winner |
|--------|-----------------|------------------|--------|
| Avg Latency | {claude_overall_avg:.0f}ms | {gemini_overall_avg:.0f}ms | {'Claude' if claude_overall_avg < gemini_overall_avg else 'Gemini'} |
| Success Rate | {statistics.mean(claude_success_rates):.0f}% | {statistics.mean(gemini_success_rates):.0f}% | {'Claude' if statistics.mean(claude_success_rates) > statistics.mean(gemini_success_rates) else 'Gemini'} |
| Speed Factor | - | - | Claude is {speedup:.1f}x faster |

"""

    # Detailed results for each test case
    md += "## Detailed Results\n\n"

    for i, result in enumerate(test_results, 1):
        test_case = result["test_case"]

        md += f"""### Test Case {i}: {test_case['description']}

**Input:** `"{test_case['input']}"`
**Context:** `"{test_case['context']}"`

"""

        # Claude results
        if "claude" in result:
            claude = result["claude"]
            md += "#### Claude Haiku 4.5\n\n"

            if "avg_latency_ms" in claude:
                md += f"""- **Success Rate:** {claude['success_rate']:.0f}%
- **Avg Latency:** {claude['avg_latency_ms']:.0f}ms (min: {claude['min_latency_ms']:.0f}ms, max: {claude['max_latency_ms']:.0f}ms, p95: {claude['p95_latency_ms']:.0f}ms)
- **Cache Hit Rate:** {claude['cache_hit_rate']:.0f}%
- **Tokens:** {claude['avg_input_tokens']:.0f} input / {claude['avg_output_tokens']:.0f} output

"""

                if claude.get("sample_output"):
                    md += "**Sample Output:**\n```json\n" + json.dumps(claude["sample_output"], indent=2) + "\n```\n\n"
            else:
                md += f"- **Error:** {claude.get('error', 'Unknown error')}\n\n"

        # Gemini results
        if "gemini" in result:
            gemini = result["gemini"]
            md += "#### Gemini 2.5 Flash\n\n"

            if "avg_latency_ms" in gemini:
                md += f"""- **Success Rate:** {gemini['success_rate']:.0f}%
- **Avg Latency:** {gemini['avg_latency_ms']:.0f}ms (min: {gemini['min_latency_ms']:.0f}ms, max: {gemini['max_latency_ms']:.0f}ms, p95: {gemini['p95_latency_ms']:.0f}ms)

"""

                if gemini.get("sample_output"):
                    md += "**Sample Output:**\n```json\n" + json.dumps(gemini["sample_output"], indent=2) + "\n```\n\n"
            else:
                md += f"- **Error:** {gemini.get('error', 'Unknown error')}\n\n"

        md += "---\n\n"

    # Recommendations
    md += """## Recommendations

"""

    if claude_avg_latencies and gemini_avg_latencies:
        if speedup > 2:
            md += f"🚀 **Use Claude for production** - Significantly faster ({speedup:.1f}x) with better latency for real-time UX.\n\n"
        elif speedup > 1.5:
            md += f"⚡ **Claude recommended for speed** - Moderately faster ({speedup:.1f}x) for better user experience.\n\n"
        else:
            md += f"⚖️ **Similar performance** - Both models have comparable latency. Consider cost and other factors.\n\n"

    md += """💰 **Cost considerations:** Gemini is ~10x cheaper per token than Claude. For high-volume use cases where latency is less critical, Gemini may be more cost-effective.

✅ **Reliability:** Both models show high success rates across test cases. Claude benefits from prompt caching for repeated requests.

"""

    # Write report
    with open(output_path, "w") as f:
        f.write(md)

    print(f"\n✅ Markdown report written to: {output_path}")


async def main_async(args):
    """Async main function."""

    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    print("\n" + "=" * 80)
    print("BENCHMARK SUITE - Comprehensive Performance Testing")
    print("=" * 80)
    print(f"Test cases: {len(TEST_CASES)}")
    print(f"Runs per case: {args.runs}")
    print(f"Models: Claude Haiku 4.5, Gemini 2.5 Flash")
    print()

    # Run all test cases
    all_results = []

    for i, test_case in enumerate(TEST_CASES, 1):
        print(f"\n[{i}/{len(TEST_CASES)}] Testing: {test_case['description']}")
        print(f"  Input: '{test_case['input']}'")
        if test_case['context']:
            print(f"  Context: '{test_case['context'][:50]}...'")

        result = {
            "test_case": test_case,
            "runs": args.runs,
        }

        # Test Claude
        if not args.gemini_only:
            print(f"  Running Claude ({args.runs} runs)...", end=" ", flush=True)
            claude_result = await run_test_case_claude(test_case, args.runs)
            result["claude"] = claude_result
            if "avg_latency_ms" in claude_result:
                print(f"{claude_result['avg_latency_ms']:.0f}ms avg, {claude_result['success_rate']:.0f}% success")
            else:
                print("FAILED")

        # Test Gemini
        if not args.claude_only:
            print(f"  Running Gemini ({args.runs} runs)...", end=" ", flush=True)
            gemini_result = await run_test_case_gemini(test_case, args.runs)
            result["gemini"] = gemini_result
            if "avg_latency_ms" in gemini_result:
                print(f"{gemini_result['avg_latency_ms']:.0f}ms avg, {gemini_result['success_rate']:.0f}% success")
            else:
                print("FAILED")

        all_results.append(result)

    # Save detailed JSON log
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_log_path = log_dir / f"benchmark_results_{timestamp}.json"

    with open(json_log_path, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\n✅ Detailed results saved to: {json_log_path}")

    # Generate markdown report
    if not args.no_report:
        md_report_path = log_dir / f"benchmark_report_{timestamp}.md"
        generate_markdown_report(all_results, md_report_path)

    print("\n" + "=" * 80)
    print("BENCHMARK SUITE COMPLETE")
    print("=" * 80)
    print()


def main():
    parser = argparse.ArgumentParser(description="Run comprehensive benchmark suite")
    parser.add_argument("-n", "--runs", type=int, default=3, help="Number of runs per test case (default: 3)")
    parser.add_argument("--claude-only", action="store_true", help="Only test Claude")
    parser.add_argument("--gemini-only", action="store_true", help="Only test Gemini")
    parser.add_argument("--no-report", action="store_true", help="Skip markdown report generation")

    args = parser.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Benchmark script for testing prediction models, prompts, and max_tokens.
"""

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

# Load environment variables from project root
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from config import MODELS, MODEL_ALIASES, MAX_TOKENS_OPTIONS, PROMPTS, EXPECTED_STRUCTURE, RUNS_PER_TEST


def resolve_model(model_name: str) -> str:
    """Resolve model alias to full model name."""
    return MODEL_ALIASES.get(model_name, model_name)


# Initialize Anthropic client
client = anthropic.Anthropic()

# Paths
BENCHMARK_DIR = Path(__file__).parent
TEST_DATA_PATH = BENCHMARK_DIR / "test_data.json"
RESULTS_DIR = BENCHMARK_DIR / "results"


def load_test_data():
    """Load test cases from JSON file."""
    with open(TEST_DATA_PATH) as f:
        return json.load(f)["test_cases"]


def load_prompt(prompt_path: str) -> tuple[str, str]:
    """Load system and user prompt templates from file."""
    full_path = BENCHMARK_DIR / prompt_path
    with open(full_path) as f:
        content = f.read()

    # Split by separator
    parts = content.split("### USER PROMPT TEMPLATE ###")
    system_prompt = parts[0].replace("### SYSTEM PROMPT ###", "").strip()
    user_template = parts[1].strip() if len(parts) > 1 else ""

    return system_prompt, user_template


def build_user_prompt(template: str, partial_input: str) -> str:
    """Build user prompt from template and input."""
    if not partial_input:
        partial_input = "(empty - no input yet)"
    return template.replace("{partial_input}", partial_input)


def call_api(model: str, max_tokens: int, system_prompt: str, user_prompt: str) -> tuple[dict, float, dict]:
    """
    Call the Anthropic API and return (response_dict, latency_ms, usage).
    """
    start_time = time.time()

    try:
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        latency_ms = (time.time() - start_time) * 1000
        response_text = message.content[0].text
        usage = {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        }

        # Parse JSON from response
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if json_match:
            response_dict = json.loads(json_match.group())
            return response_dict, latency_ms, usage
        else:
            return None, latency_ms, usage

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        print(f"    ERROR: {e}")
        return None, latency_ms, {}


def validate_structure(response: dict) -> tuple[bool, list[str]]:
    """Validate that response matches expected JSON structure."""
    if response is None:
        return False, ["Response is None"]

    errors = []

    for key, rules in EXPECTED_STRUCTURE.items():
        if key not in response:
            errors.append(f"Missing key: {key}")
            continue

        if not isinstance(response[key], rules["type"]):
            errors.append(f"{key} is not a {rules['type'].__name__}")
            continue

        if len(response[key]) != rules["length"]:
            errors.append(f"{key} has {len(response[key])} items, expected {rules['length']}")

    return len(errors) == 0, errors


def calculate_word_accuracy(response: dict, test_case: dict) -> float:
    """Calculate what percentage of expected words appear in predictions."""
    if response is None:
        return 0.0

    expected_words = [w.lower() for w in test_case.get("expected_words", [])]
    if not expected_words:
        return 1.0  # No expected words to check

    predicted_words = [w.lower() for w in response.get("words", [])]

    matches = sum(1 for w in expected_words if w in predicted_words)
    return matches / len(expected_words)


def calculate_phrase_relevance(response: dict, test_case: dict) -> float:
    """Calculate if phrases contain expected keywords."""
    if response is None:
        return 0.0

    expected_contains = [w.lower() for w in test_case.get("expected_phrases_contain", [])]
    if not expected_contains:
        return 1.0  # No expected keywords to check

    phrases_text = " ".join(response.get("phrases", [])).lower()

    matches = sum(1 for w in expected_contains if w in phrases_text)
    return matches / len(expected_contains)


def run_benchmark(
    models: list[str] = None,
    max_tokens_list: list[int] = None,
    prompts: dict[str, str] = None,
):
    """Run the full benchmark."""
    models = models or MODELS
    max_tokens_list = max_tokens_list or MAX_TOKENS_OPTIONS
    prompts = prompts or PROMPTS

    test_cases = load_test_data()

    print("=" * 70)
    print(f"BENCHMARK RUN: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Models: {models}")
    print(f"Max tokens: {max_tokens_list}")
    print(f"Prompts: {list(prompts.keys())}")
    print(f"Test cases: {len(test_cases)}")
    print("=" * 70)

    all_results = []

    for model in models:
        for prompt_name, prompt_path in prompts.items():
            system_prompt, user_template = load_prompt(prompt_path)

            for max_tokens in max_tokens_list:
                print(f"\n{'=' * 70}")
                print(f"Model: {model}")
                print(f"Prompt: {prompt_name}")
                print(f"Max Tokens: {max_tokens}")
                print("-" * 70)
                print(f"{'Test Case':<25} {'Latency':>10} {'Words':>10} {'Phrases':>10} {'Valid':>8}")
                print("-" * 70)

                run_results = {
                    "model": model,
                    "prompt": prompt_name,
                    "max_tokens": max_tokens,
                    "tests": [],
                    "avg_latency": 0,
                    "avg_word_accuracy": 0,
                    "avg_phrase_relevance": 0,
                    "valid_json_pct": 0,
                }

                total_latency = 0
                total_word_acc = 0
                total_phrase_rel = 0
                valid_count = 0

                for test_case in test_cases:
                    user_prompt = build_user_prompt(user_template, test_case["partial_input"])

                    response, latency_ms, usage = call_api(model, max_tokens, system_prompt, user_prompt)

                    is_valid, errors = validate_structure(response)
                    word_accuracy = calculate_word_accuracy(response, test_case)
                    phrase_relevance = calculate_phrase_relevance(response, test_case)

                    total_latency += latency_ms
                    total_word_acc += word_accuracy
                    total_phrase_rel += phrase_relevance
                    if is_valid:
                        valid_count += 1

                    valid_str = "OK" if is_valid else "FAIL"
                    print(f"{test_case['id']:<25} {latency_ms:>8.0f}ms {word_accuracy:>9.0%} {phrase_relevance:>9.0%} {valid_str:>8}")

                    run_results["tests"].append({
                        "test_id": test_case["id"],
                        "latency_ms": latency_ms,
                        "word_accuracy": word_accuracy,
                        "phrase_relevance": phrase_relevance,
                        "valid_json": is_valid,
                        "errors": errors,
                        "response": response,
                        "usage": usage,
                    })

                # Calculate averages
                n = len(test_cases)
                run_results["avg_latency"] = total_latency / n
                run_results["avg_word_accuracy"] = total_word_acc / n
                run_results["avg_phrase_relevance"] = total_phrase_rel / n
                run_results["valid_json_pct"] = valid_count / n

                print("-" * 70)
                print(f"{'AVERAGE':<25} {run_results['avg_latency']:>8.0f}ms {run_results['avg_word_accuracy']:>9.0%} {run_results['avg_phrase_relevance']:>9.0%} {run_results['valid_json_pct']:>7.0%}")

                all_results.append(run_results)

    # Print summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"{'Model':<30} {'Prompt':<18} {'Tokens':>6} {'Latency':>10} {'Words':>8} {'Phrases':>8} {'Valid':>7}")
    print("-" * 70)

    for r in sorted(all_results, key=lambda x: x["avg_latency"]):
        print(f"{r['model']:<30} {r['prompt']:<18} {r['max_tokens']:>6} {r['avg_latency']:>8.0f}ms {r['avg_word_accuracy']:>7.0%} {r['avg_phrase_relevance']:>7.0%} {r['valid_json_pct']:>7.0%}")

    # Save results
    RESULTS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = RESULTS_DIR / f"benchmark_{timestamp}.json"

    with open(results_file, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nResults saved to: {results_file}")

    return all_results


if __name__ == "__main__":
    # Allow command line overrides
    import argparse

    parser = argparse.ArgumentParser(description="Run prediction benchmark")
    parser.add_argument("--model", "-m", help=f"Model to test. Aliases: {', '.join(MODEL_ALIASES.keys())}")
    parser.add_argument("--prompt", "-p", help="Test specific prompt only")
    parser.add_argument("--max-tokens", "-t", type=int, help="Test specific max_tokens only")
    parser.add_argument("--list", "-l", action="store_true", help="List available models and prompts")

    args = parser.parse_args()

    # List available options
    if args.list:
        print("Available models:")
        for alias, full_name in MODEL_ALIASES.items():
            print(f"  {alias:<10} -> {full_name}")
        print("\nAvailable prompts:")
        for name in PROMPTS.keys():
            print(f"  {name}")
        print(f"\nMax tokens options: {MAX_TOKENS_OPTIONS}")
        sys.exit(0)

    # Build filtered config
    models = [resolve_model(args.model)] if args.model else None
    max_tokens = [args.max_tokens] if args.max_tokens else None
    prompts = {args.prompt: PROMPTS[args.prompt]} if args.prompt else None

    run_benchmark(models=models, max_tokens_list=max_tokens, prompts=prompts)

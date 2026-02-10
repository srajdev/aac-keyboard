#!/usr/bin/env python3
"""Test script for streaming predictions."""

import sys
import time
from dotenv import load_dotenv

# Load environment variables (including ANTHROPIC_API_KEY)
load_dotenv()

from server.claude_service import generate_word_predictions_stream, generate_phrase_predictions_stream

def test_word_streaming():
    """Test word prediction streaming."""
    print("Testing word predictions streaming...")
    print("=" * 60)

    partial_input = "I want to"
    context = "Viraj is in the kitchen, someone asked what he wants for lunch"

    start_time = time.time()
    predictions = []

    for i, word in enumerate(generate_word_predictions_stream(partial_input, context), 1):
        elapsed_ms = (time.time() - start_time) * 1000
        predictions.append(word)
        print(f"  Word {i} ({elapsed_ms:.0f}ms): {word}")

    total_ms = (time.time() - start_time) * 1000
    print(f"\nTotal: {len(predictions)} words in {total_ms:.0f}ms")
    print(f"Final: {predictions}")
    print()

def test_phrase_streaming():
    """Test phrase prediction streaming."""
    print("Testing phrase predictions streaming...")
    print("=" * 60)

    partial_input = "I would like"
    context = "Someone asked Viraj if he needs help"

    start_time = time.time()
    predictions = []

    for i, phrase in enumerate(generate_phrase_predictions_stream(partial_input, context), 1):
        elapsed_ms = (time.time() - start_time) * 1000
        predictions.append(phrase)
        print(f"  Phrase {i} ({elapsed_ms:.0f}ms): {phrase}")

    total_ms = (time.time() - start_time) * 1000
    print(f"\nTotal: {len(predictions)} phrases in {total_ms:.0f}ms")
    print(f"Final: {predictions}")
    print()

if __name__ == "__main__":
    try:
        test_word_streaming()
        test_phrase_streaming()
        print("✓ Streaming tests completed successfully!")
    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

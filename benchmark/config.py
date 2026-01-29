# Benchmark Configuration

# Model aliases for easier command line usage
MODEL_ALIASES = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-20250514",
}

MODELS = list(MODEL_ALIASES.values())

MAX_TOKENS_OPTIONS = [150, 300, 500]

PROMPTS = {
    "default": "prompts/default.txt",
    "priority_urgent": "prompts/priority_urgent.txt",
    "style_direct": "prompts/style_direct.txt",
}

# Number of times to run each test for consistency
RUNS_PER_TEST = 1

# Expected JSON structure
EXPECTED_STRUCTURE = {
    "phrases": {"type": list, "length": 3},
    "words": {"type": list, "length": 5},
    "letters": {"type": list, "length": 5},
}

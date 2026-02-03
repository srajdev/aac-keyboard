# Benchmark Scripts - Claude vs Gemini Performance Testing

This directory contains standalone benchmark scripts for comparing Claude Haiku 4.5 and Gemini 2.5 Flash prediction performance.

## Overview

Four benchmark scripts are provided:

1. **`benchmark_claude.py`** - Standalone Claude Haiku 4.5 benchmark
2. **`benchmark_gemini.py`** - Standalone Gemini 2.5 Flash benchmark
3. **`benchmark_compare.py`** - Head-to-head comparison
4. **`benchmark_suite.py`** - Comprehensive test suite with multiple scenarios

## Prerequisites

1. **Virtual environment activated:**
   ```bash
   # From project root
   source venv/bin/activate
   ```

2. **Environment variables set:**
   ```bash
   export ANTHROPIC_API_KEY="your-claude-api-key"
   export GOOGLE_API_KEY="your-gemini-api-key"
   ```

## Quick Start

All commands should be run from the `benchmark/` directory:

```bash
cd benchmark
```

### Test Claude alone
```bash
python3 benchmark_claude.py --input "I want to" --runs 5
```

### Test Gemini alone
```bash
python3 benchmark_gemini.py --input "I want to" --runs 5
```

### Compare both models head-to-head
```bash
python3 benchmark_compare.py --input "I want to" --runs 5
```

### Run comprehensive test suite
```bash
python3 benchmark_suite.py --runs 3
```

## Script Details

### 1. `benchmark_claude.py` - Claude Benchmark

**Purpose:** Test Claude Haiku 4.5 performance with detailed metrics.

**Features:**
- Latency breakdown (prompt build, API call, JSON parse)
- Token usage tracking (input/output/cached)
- Cache hit detection and rates
- Statistical analysis (avg, min, max, P95)
- Cost estimates per request/1K/1M requests

**Usage:**
```bash
python3 benchmark_claude.py [options]

Options:
  -i, --input TEXT      Partial input text (default: "I want to")
  -c, --context TEXT    Conversation context (default: "")
  -n, --runs N          Number of test runs (default: 5)
  --json                Output raw JSON results
```

**Example output:**
```
======================================================================
CLAUDE HAIKU 4.5 BENCHMARK RESULTS
======================================================================
Input: 'I want to'
Runs: 5
Success Rate: 5/5 (100%)

LATENCY BREAKDOWN
----------------------------------------------------------------------
Metric               Average      Min          Max          P95
----------------------------------------------------------------------
Total Latency           1234ms      1123ms      1456ms      1434ms
API Call                1200ms      1100ms      1400ms      1380ms
Prompt Build             1.2ms       1.0ms       1.5ms       1.4ms
JSON Parse               0.8ms       0.7ms       1.0ms       0.9ms

CACHE PERFORMANCE
----------------------------------------------------------------------
Cache Hit Rate: 80% (4/5 requests)
Avg Cache Read Tokens: 450

TOKEN USAGE
----------------------------------------------------------------------
Avg Input Tokens: 523
Avg Output Tokens: 145
Total Tokens: 668

COST ESTIMATE
----------------------------------------------------------------------
Avg Cost per Request: $0.001000
Cost per 1K Requests: $1.00
Cost per 1M Requests: $1000.00
```

### 2. `benchmark_gemini.py` - Gemini Benchmark

**Purpose:** Test Gemini 2.5 Flash performance with similar metrics.

**Features:**
- Latency breakdown
- Finish reason tracking (complete, max_tokens, safety blocks)
- Success/failure rate
- Statistical analysis
- Cost estimates (based on typical token counts)

**Usage:**
```bash
python3 benchmark_gemini.py [options]

Options:
  -i, --input TEXT      Partial input text (default: "I want to")
  -c, --context TEXT    Conversation context (default: "")
  -n, --runs N          Number of test runs (default: 5)
  --json                Output raw JSON results
```

### 3. `benchmark_compare.py` - Head-to-Head Comparison

**Purpose:** Run both models with identical inputs and compare side-by-side.

**Features:**
- Latency comparison (avg, P95, min, API call)
- Success rate comparison
- Cache performance (Claude only)
- Cost comparison per 1K requests
- Quality metrics (phrase diversity, word variety)
- Winner determination
- Actionable recommendations

**Usage:**
```bash
python3 benchmark_compare.py [options]

Options:
  -i, --input TEXT      Partial input text (default: "I want to")
  -c, --context TEXT    Conversation context (default: "")
  -n, --runs N          Number of test runs per model (default: 5)
  --json                Output raw JSON results
```

**Example output:**
```
================================================================================
BENCHMARK COMPARISON: CLAUDE HAIKU 4.5 vs GEMINI 2.5 FLASH
================================================================================
Input: 'I want to'
Runs: 5 per model

LATENCY COMPARISON
--------------------------------------------------------------------------------
Metric                    Claude Haiku         Gemini Flash         Winner
--------------------------------------------------------------------------------
Avg Total Latency             1234ms              4567ms           Claude
P95 Latency                   1456ms              5890ms           Claude
Min Latency                   1123ms              3456ms           Claude
Avg API Call                  1200ms              4500ms           Claude

RELIABILITY
--------------------------------------------------------------------------------
Success Rate                    100%                100%            Tie
Cache Hit Rate                   80%                N/A             Claude

COST COMPARISON (per 1K requests)
--------------------------------------------------------------------------------
Cost per 1K requests          $1.00               $0.10            Gemini
Savings                                             90%

SUMMARY
--------------------------------------------------------------------------------
⚡ Claude is 3.7x FASTER - Best for speed-critical UX
💰 Gemini is 10.0x CHEAPER - Best for cost optimization
```

### 4. `benchmark_suite.py` - Comprehensive Test Suite

**Purpose:** Run predefined test cases covering common scenarios.

**Features:**
- 10 predefined test cases:
  - Single letter ("I")
  - Word prefixes ("hel", "than")
  - Phrase starts ("I want to", "Can you")
  - With/without context
  - Empty input edge case
- Tests both Claude and Gemini
- Generates markdown report with all results
- Saves detailed JSON logs
- Statistical analysis across all test cases
- Overall performance summary

**Usage:**
```bash
python3 benchmark_suite.py [options]

Options:
  -n, --runs N          Number of runs per test case (default: 3)
  --claude-only         Only test Claude
  --gemini-only         Only test Gemini
  --no-report           Skip markdown report generation
```

**Test cases included:**
1. Single letter - minimal input
2. Word prefix - common greeting ("hel")
3. Word prefix - common gratitude ("than")
4. Phrase start - common request ("I want to")
5. Question start - asking for help ("Can you")
6. Question with context
7. Short response with question context
8. Request with situational context
9. Empty input - conversation starter
10. Single word - negative response ("no")

**Output files:**
- `../logs/benchmark_results_YYYYMMDD_HHMMSS.json` - Detailed JSON data
- `../logs/benchmark_report_YYYYMMDD_HHMMSS.md` - Formatted markdown report

## Example Workflows

All examples assume you're in the `benchmark/` directory:

```bash
cd benchmark
```

### 1. Quick performance check
```bash
# Test with default input ("I want to")
python3 benchmark_compare.py --runs 5
```

### 2. Test specific user scenario
```bash
# Test with custom input and context
python3 benchmark_compare.py \
  --input "Can you help me with" \
  --context "In the kitchen, making lunch" \
  --runs 10
```

### 3. Comprehensive evaluation
```bash
# Run full test suite with 5 runs per case
python3 benchmark_suite.py --runs 5
```

### 4. Cost-focused testing (Gemini only)
```bash
# Test only Gemini to evaluate cost savings
python3 benchmark_suite.py --gemini-only --runs 3
```

### 5. Get raw JSON data for analysis
```bash
# Export Claude results as JSON
python3 benchmark_claude.py --input "thank you for" --runs 10 --json > claude_results.json

# Export comparison as JSON
python3 benchmark_compare.py --input "thank you for" --runs 10 --json > comparison.json
```

## Understanding the Metrics

### Latency Metrics
- **Total Latency**: End-to-end time from input to parsed prediction
- **API Call**: Time spent waiting for API response (network + model inference)
- **Prompt Build**: Time to construct prompts (negligible, ~1ms)
- **JSON Parse**: Time to extract and parse JSON from response (~1ms)
- **P95**: 95th percentile - 95% of requests are faster than this

### Cache Metrics (Claude only)
- **Cache Hit Rate**: Percentage of requests that reused cached system prompt
- **Cache Read Tokens**: Tokens loaded from cache (saves cost and latency)
- **First request**: Usually cache MISS (creates cache)
- **Subsequent requests**: Usually cache HIT (reuses cache for 5 minutes)

### Cost Metrics
- **Claude Haiku 4.5**: $0.80/1M input tokens, $4.00/1M output tokens
- **Gemini 2.5 Flash**: $0.075/1M input tokens, $0.30/1M output tokens
- Gemini is ~10x cheaper per token
- Claude's prompt caching reduces costs for repeated requests

### Quality Metrics
- **Phrase Diversity**: Unique word variety in phrase predictions (0-10 scale)
- **Unique Words**: Number of distinct words in word predictions
- **Unique Letters**: Number of distinct letters in letter predictions

## Interpreting Results

### When to choose Claude:
- Speed is critical (real-time UX, fast typing)
- User experience depends on low latency
- Repeated requests (benefits from caching)
- Budget allows for premium performance

### When to choose Gemini:
- Cost optimization is priority
- Batch/background processing
- 10x lower costs justify slower responses
- Acceptable latency for use case

## Troubleshooting

### API Key Errors
```bash
# Ensure environment variables are set
echo $ANTHROPIC_API_KEY
echo $GOOGLE_API_KEY

# If empty, set them:
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

### Module Not Found
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Verify packages installed
pip list | grep anthropic
pip list | grep google
```

### Low Success Rates
- Check API quota/rate limits
- Verify API keys are valid
- Check network connectivity
- Review error messages with `--json` flag

### Unexpected Latency
- Network conditions affect results
- Run multiple iterations (`--runs 10+`)
- Use P95 instead of max for realistic expectations
- First request may be slower (cold start, cache miss)

## Advanced Usage

### Exporting for Analysis
```bash
# Save results to file for later analysis
python3 benchmark_compare.py --runs 20 --json | jq > results.json

# Extract just latency data
python3 benchmark_claude.py --runs 50 --json | \
  jq '[.[] | {total_ms: .timings.total_ms, api_ms: .timings.api_call_ms}]'
```

### Batch Testing Multiple Inputs
```bash
# Create a simple loop for multiple inputs
for input in "I" "hel" "thank" "Can you"; do
  echo "Testing: $input"
  python3 benchmark_compare.py --input "$input" --runs 5
done
```

### Continuous Monitoring
```bash
# Run benchmarks periodically and save to timestamped files
while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  python3 benchmark_compare.py --runs 10 --json > "logs/monitoring_${timestamp}.json"
  sleep 3600  # Run every hour
done
```

## Files Generated

### Project Directory Structure
```
viraj-keyboard/
├── benchmark/                                # Benchmark scripts (this directory)
│   ├── benchmark_claude.py
│   ├── benchmark_gemini.py
│   ├── benchmark_compare.py
│   ├── benchmark_suite.py
│   └── README.md
└── logs/                                     # Output logs (in project root)
    ├── benchmark_results_20260203_141530.json    # Suite detailed JSON
    ├── benchmark_report_20260203_141530.md       # Suite markdown report
    └── predictions.jsonl                         # Production app logs
```

### JSON Log Format
```json
{
  "test_case": {
    "input": "I want to",
    "context": "",
    "description": "Phrase start"
  },
  "runs": 5,
  "claude": {
    "success_rate": 100,
    "avg_latency_ms": 1234,
    "min_latency_ms": 1123,
    "max_latency_ms": 1456,
    "p95_latency_ms": 1434,
    "cache_hit_rate": 80,
    "sample_output": { ... }
  },
  "gemini": { ... }
}
```

## Performance Expectations

Based on production data and benchmarks:

| Metric | Claude Haiku 4.5 | Gemini 2.5 Flash |
|--------|-----------------|------------------|
| Typical Latency | 1200-1500ms | 4000-6000ms |
| Best Case | 1000ms | 3000ms |
| P95 | 1600ms | 7000ms |
| Success Rate | 98-100% | 95-100% |
| Cost (per 1K) | $1.00 | $0.10 |
| Speed Factor | 1x (baseline) | 3-4x slower |

**Recommendation:** Claude for production UX, Gemini for cost-sensitive use cases.

## Support

For issues or questions:
1. Check the main project README: `/CLAUDE.md`
2. Review server implementations:
   - `server/claude_service.py`
   - `server/gemini_service.py`
   - `server/prompts.py`
3. Check production logs: `logs/predictions.jsonl`

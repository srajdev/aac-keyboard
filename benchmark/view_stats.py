#!/usr/bin/env python3
"""View performance statistics from the command line."""
import json
import sys
from pathlib import Path


def print_stats(stats_file: Path):
    """Print the latest performance stats from the log file."""
    if not stats_file.exists():
        print("No stats file found yet. Stats will be created after server runs for 60 seconds.")
        return

    # Read all entries and get the most recent
    entries = []
    with open(stats_file, "r") as f:
        for line in f:
            if line.strip():
                entries.append(json.loads(line))

    if not entries:
        print("No stats entries found yet.")
        return

    # Get latest entry
    latest = entries[-1]
    stats = latest.get("stats", {})

    print("\n" + "=" * 60)
    print(f"PERFORMANCE STATISTICS (as of {latest['timestamp']})")
    print("=" * 60)

    for model, model_stats in stats.items():
        if model == "overall":
            continue

        print(f"\n{model.upper()}:")
        print(f"  Requests: {model_stats['count']}")
        print(f"  Avg: {model_stats['avg_ms']}ms")
        print(f"  P50: {model_stats['p50_ms']}ms")
        print(f"  P95: {model_stats['p95_ms']}ms")
        print(f"  P99: {model_stats['p99_ms']}ms")
        print(f"  Min: {model_stats['min_ms']}ms")
        print(f"  Max: {model_stats['max_ms']}ms")
        print(
            f"  Cache hits: {model_stats['cache_hits']} ({model_stats['cache_hit_rate']}%)"
        )

    if "overall" in stats:
        overall = stats["overall"]
        print(f"\nOVERALL:")
        print(f"  Total requests: {overall['total_requests']}")
        print(f"  Cache hit rate: {overall['overall_cache_hit_rate']}%")

    print("=" * 60)

    # Show trend if multiple entries
    if len(entries) > 1:
        print(f"\nTotal log entries: {len(entries)}")
        print("Use 'tail -f logs/performance_stats.jsonl' to watch in real-time")

    print()


def main():
    stats_file = Path(__file__).parent / "logs" / "performance_stats.jsonl"

    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        print("Watching stats file... (Ctrl+C to exit)")
        try:
            import time

            last_size = 0
            while True:
                if stats_file.exists():
                    current_size = stats_file.stat().st_size
                    if current_size != last_size:
                        print("\033[2J\033[H")  # Clear screen
                        print_stats(stats_file)
                        last_size = current_size
                time.sleep(5)
        except KeyboardInterrupt:
            print("\nStopped watching.")
    else:
        print_stats(stats_file)


if __name__ == "__main__":
    main()

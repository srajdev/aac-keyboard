"""Backend performance tracking and statistics."""
import json
import time
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from typing import Dict, List


class PerformanceTracker:
    """Track prediction performance metrics on the backend."""

    def __init__(self, log_dir: Path):
        self.log_dir = log_dir
        self.log_dir.mkdir(exist_ok=True)
        self.stats_file = self.log_dir / "performance_stats.jsonl"

        # In-memory metrics
        self.metrics: Dict[str, List[float]] = defaultdict(list)
        self.cache_hits: Dict[str, int] = defaultdict(int)
        self.cache_misses: Dict[str, int] = defaultdict(int)
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.last_log_time = time.time()
        self.log_interval = 60  # Log aggregate stats every 60 seconds

    def record_request(
        self,
        model: str,
        latency_ms: float,
        cache_hit: bool = False,
    ):
        """Record a single prediction request."""
        self.metrics[model].append(latency_ms)
        self.request_counts[model] += 1

        if cache_hit:
            self.cache_hits[model] += 1
        else:
            self.cache_misses[model] += 1

        # Log aggregate stats periodically
        if time.time() - self.last_log_time >= self.log_interval:
            self.log_aggregate_stats()
            self.last_log_time = time.time()

    def get_stats(self, model: str) -> dict:
        """Get current statistics for a model."""
        if model not in self.metrics or not self.metrics[model]:
            return None

        latencies = sorted(self.metrics[model])
        count = len(latencies)

        if count == 0:
            return None

        return {
            "model": model,
            "count": count,
            "avg_ms": round(sum(latencies) / count, 1),
            "p50_ms": round(latencies[int(count * 0.5)], 1) if count > 0 else 0,
            "p95_ms": round(latencies[int(count * 0.95)], 1) if count > 1 else 0,
            "p99_ms": round(latencies[int(count * 0.99)], 1) if count > 2 else 0,
            "min_ms": round(min(latencies), 1),
            "max_ms": round(max(latencies), 1),
            "cache_hits": self.cache_hits[model],
            "cache_misses": self.cache_misses[model],
            "cache_hit_rate": round(
                self.cache_hits[model] / self.request_counts[model] * 100, 1
            )
            if self.request_counts[model] > 0
            else 0,
        }

    def get_all_stats(self) -> dict:
        """Get statistics for all models."""
        stats = {}
        for model in self.metrics.keys():
            model_stats = self.get_stats(model)
            if model_stats:
                stats[model] = model_stats

        # Overall stats
        total_requests = sum(self.request_counts.values())
        total_cache_hits = sum(self.cache_hits.values())

        if total_requests > 0:
            stats["overall"] = {
                "total_requests": total_requests,
                "total_cache_hits": total_cache_hits,
                "overall_cache_hit_rate": round(
                    total_cache_hits / total_requests * 100, 1
                ),
            }

        return stats

    def log_aggregate_stats(self):
        """Log aggregate statistics to file."""
        stats = self.get_all_stats()

        if not stats or (len(stats) == 1 and "overall" in stats):
            return  # No data to log yet

        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "aggregate_stats",
            "stats": stats,
        }

        with open(self.stats_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        print(f"[Performance] Logged aggregate stats: {stats.get('overall', {})}")

    def reset_stats(self):
        """Reset all statistics."""
        self.metrics.clear()
        self.cache_hits.clear()
        self.cache_misses.clear()
        self.request_counts.clear()
        print("[Performance] Stats reset")

    def print_current_stats(self):
        """Print current statistics to console."""
        stats = self.get_all_stats()

        if not stats:
            print("[Performance] No stats available yet")
            return

        print("\n" + "=" * 60)
        print("PERFORMANCE STATISTICS")
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

        print("=" * 60 + "\n")


# Global instance
_tracker = None


def get_tracker(log_dir: Path = None) -> PerformanceTracker:
    """Get the global performance tracker instance."""
    global _tracker
    if _tracker is None:
        if log_dir is None:
            from pathlib import Path

            log_dir = Path(__file__).parent.parent / "logs"
        _tracker = PerformanceTracker(log_dir)
    return _tracker

"""
duplicate_detector.py
----------------------
Implements duplicate record detection two ways so the web app can
demonstrate *why* hashing is used:

  1. hash_based_detect()  -> O(n) average, uses HashTable
  2. naive_detect()       -> O(n^2), linear scan against everything seen

Both operate on a list of records (dicts). A record is "duplicate"
if the normalized values of the chosen key fields match a record
seen earlier in the list.
"""

import time
from typing import Any, Dict, List

from hashtable import HashTable


def normalize_value(v: Any) -> str:
    return str(v).strip().lower()


def make_key(record: Dict[str, Any], fields: List[str]) -> str:
    """Build the string key that gets hashed, from the chosen fields."""
    return "|".join(normalize_value(record.get(f, "")) for f in fields)


def hash_based_detect(records: List[Dict[str, Any]], fields: List[str]):
    """O(n) average-case duplicate detection using our HashTable."""
    table = HashTable(initial_size=max(101, len(records) // 2 or 1))
    unique_records = []
    duplicate_records = []

    for idx, record in enumerate(records):
        key = make_key(record, fields)
        is_new = table.insert(key, idx)
        if is_new:
            unique_records.append({"index": idx, "record": record})
        else:
            original_index = table.search(key)
            duplicate_records.append({
                "index": idx,
                "record": record,
                "duplicate_of_index": original_index,
            })

    return {
        "unique_records": unique_records,
        "duplicate_records": duplicate_records,
        "hash_stats": table.get_stats(),
    }


def naive_detect(records: List[Dict[str, Any]], fields: List[str]):
    """O(n^2) duplicate detection: compare every record against every
    previously-seen record with a linear scan (no hashing).
    """
    seen_keys: List[str] = []
    duplicate_indices = []

    for i, record in enumerate(records):
        key_i = make_key(record, fields)
        found = False
        for prev_key in seen_keys:          # <-- the O(n) inner scan
            if prev_key == key_i:
                found = True
                break
        if found:
            duplicate_indices.append(i)
        else:
            seen_keys.append(key_i)

    return duplicate_indices


def time_algorithm(func, *args) -> float:
    """Return elapsed wall-clock time in milliseconds."""
    start = time.perf_counter()
    func(*args)
    end = time.perf_counter()
    return (end - start) * 1000.0


def performance_comparison(records: List[Dict[str, Any]], fields: List[str],
                            num_points: int = 8) -> Dict[str, list]:
    """Run both algorithms on growing prefixes of `records` and time each,
    so the frontend can plot O(n) vs O(n^2) growth curves.
    """
    n = len(records)
    if n == 0:
        return {"sizes": [], "naive_ms": [], "hash_ms": []}

    step = max(1, n // num_points)
    sizes = list(range(step, n + 1, step))
    if sizes[-1] != n:
        sizes.append(n)

    naive_times, hash_times = [], []
    for size in sizes:
        subset = records[:size]
        naive_times.append(round(time_algorithm(naive_detect, subset, fields), 4))
        hash_times.append(round(time_algorithm(hash_based_detect, subset, fields), 4))

    return {"sizes": sizes, "naive_ms": naive_times, "hash_ms": hash_times}

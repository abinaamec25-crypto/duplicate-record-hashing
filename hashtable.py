"""
hashtable.py
------------
A from-scratch Hash Table implementation built for the
"Duplicate Record Detection using Hashing Technique" DS project.

Design choices (worth explaining in your viva/report):

1. Collision handling: SEPARATE CHAINING
   Each bucket is a Python list. When two different keys hash to the
   same index, they are simply appended to that bucket's list. This
   is easy to reason about and lets us count collisions explicitly.

2. Hash function: POLYNOMIAL ROLLING HASH (djb2-style)
   h = 5381
   for each character c in the key:
       h = (h * 33 + ord(c)) mod table_size
   This spreads string keys fairly uniformly across buckets and is
   the same family of hash function used internally by many real
   hash table / string hashing implementations.

3. Dynamic resizing (rehashing)
   When the load factor (entries / table_size) exceeds 0.7, the table
   size is roughly doubled (rounded up to the next prime) and every
   existing entry is re-inserted. This keeps average lookup/insert
   close to O(1) even as more records are added.

Average-case complexity:
   insert / search  -> O(1) amortized
   detecting duplicates across n records -> O(n) total

Worst-case complexity (all keys collide into one bucket):
   insert / search -> O(n)
"""

from typing import Any, List, Optional, Tuple


def _is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    i = 3
    while i * i <= n:
        if n % i == 0:
            return False
        i += 2
    return True


def _next_prime(n: int) -> int:
    candidate = max(n, 2)
    while not _is_prime(candidate):
        candidate += 1
    return candidate


class HashTable:
    """A hash table with separate chaining, built to make every
    internal event (hash computed, collision hit, bucket probed,
    resize triggered) inspectable so the web app can visualize it.
    """

    def __init__(self, initial_size: int = 101, load_factor_limit: float = 0.7):
        self.table_size: int = _next_prime(initial_size)
        self.buckets: List[List[Tuple[str, Any]]] = [[] for _ in range(self.table_size)]
        self.num_entries: int = 0
        self.load_factor_limit: float = load_factor_limit

        # Metrics for visualization / report
        self.total_collisions: int = 0
        self.total_comparisons: int = 0   # key-equality checks performed
        self.resize_count: int = 0

    # ---------- core hashing ----------

    def _hash(self, key: str) -> int:
        """djb2-style polynomial rolling hash, mod table_size."""
        h = 5381
        for ch in key:
            h = (h * 33 + ord(ch)) % self.table_size
        return h

    def load_factor(self) -> float:
        return self.num_entries / self.table_size

    # ---------- public API ----------

    def search(self, key: str) -> Optional[Any]:
        """Return the stored value for `key`, or None if absent.
        O(1) average, O(chain length) worst case within a bucket.
        """
        index = self._hash(key)
        bucket = self.buckets[index]
        for stored_key, value in bucket:
            self.total_comparisons += 1
            if stored_key == key:
                return value
        return None

    def insert(self, key: str, value: Any) -> bool:
        """Insert key -> value. Returns True if this was a NEW key
        (i.e. no duplicate existed), False if the key already existed
        (a duplicate record was detected and NOT overwritten).
        """
        index = self._hash(key)
        bucket = self.buckets[index]

        if len(bucket) > 0:
            # Something already lives at this index -> at least a
            # hash collision. Check if it's a *true* duplicate key.
            self.total_collisions += 1

        for stored_key, _ in bucket:
            self.total_comparisons += 1
            if stored_key == key:
                return False  # true duplicate, not inserted

        bucket.append((key, value))
        self.num_entries += 1

        if self.load_factor() > self.load_factor_limit:
            self._resize()

        return True

    def _resize(self) -> None:
        old_buckets = self.buckets
        new_size = _next_prime(self.table_size * 2)
        self.table_size = new_size
        self.buckets = [[] for _ in range(new_size)]
        self.num_entries = 0
        self.resize_count += 1

        for bucket in old_buckets:
            for key, value in bucket:
                self.insert(key, value)

    # ---------- visualization helpers ----------

    def bucket_sizes(self) -> List[int]:
        return [len(b) for b in self.buckets]

    def get_stats(self) -> dict:
        sizes = self.bucket_sizes()
        occupied = [s for s in sizes if s > 0]
        return {
            "table_size": self.table_size,
            "num_entries": self.num_entries,
            "load_factor": round(self.load_factor(), 4),
            "total_collisions": self.total_collisions,
            "total_comparisons": self.total_comparisons,
            "resize_count": self.resize_count,
            "max_chain_length": max(sizes) if sizes else 0,
            "occupied_buckets": len(occupied),
            "empty_buckets": self.table_size - len(occupied),
            "bucket_sizes": sizes,
        }

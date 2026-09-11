# Duplicate Record Detection using Hashing Technique

A DS course project (AU25 Regular) built as a full Flask web app. The
UI lets you load a dataset, run duplicate detection through a
from-scratch hash table, watch the buckets fill up, and compare timing
against a naive O(n²) approach.

## What's actually "the data structure" here

- **`hashtable.py`** — a hash table implemented from scratch:
  - separate chaining for collision resolution (each bucket is a list)
  - a djb2-style polynomial rolling hash function
  - dynamic resizing (rehashing) once load factor passes `0.7`
  - tracks collisions, comparisons, and bucket occupancy for the UI
- **`duplicate_detector.py`** — uses that hash table to detect
  duplicate records in **O(n) average case**, and also implements a
  **naive O(n²)** linear-scan version so the two can be timed
  side by side.
- **`sample_generator.py`** — generates a synthetic employee dataset
  with exact duplicates and case/whitespace-variant duplicates mixed in.
- **`parser.py`** — parses CSV, TSV, JSON, JSON Lines, Excel, PDF,
  DOCX, and plain text into a consistent record format, even when
  individual rows do not share the same fields.
- **`app.py`** — Flask routes that expose the above as a JSON API.
- **`templates/` + `static/`** — the web UI (HTML/CSS/JS) that
  visualizes the bucket grid, the record table, and a performance chart.
  This is the *presentation layer*; none of the hashing logic lives here.

## Project structure

```
dup-record-hashing/
├── app.py                     # Flask app / API routes
├── hashtable.py                # HashTable data structure (the DS core)
├── duplicate_detector.py       # hash-based + naive detection, timing
├── sample_generator.py         # synthetic dataset generator
├── requirements.txt
├── sample_data/
│   └── sample_records.csv      # ready-made CSV you can upload
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/script.js
```

## Running it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in a browser.

## Using the app

1. **Load data** — click "Generate sample data" (adjust how many
   unique records and what fraction should be duplicates), or upload
   `sample_data/sample_records.csv` / your own CSV, TSV, JSON,
   JSON Lines, Excel, PDF, DOCX, or plain text file.
2. **Pick fields** — choose which columns define whether two records
   count as "the same" (e.g. `Name` + `Email`). If your uploaded
   records do not share a common schema, the app now merges all
   available keys into the field list and lets you select the ones
   that should be compared.
3. **Detect duplicates** — runs the hash-based detector and shows:
   - total / unique / duplicate counts
   - hash table stats: table size, load factor, collisions, longest
     chain, how many times it resized
   - a literal bucket grid (one cell per bucket, colored by how many
     records landed in it)
   - the full record table with duplicates highlighted and linked to
     the original row they duplicate
4. **Run performance comparison** — times the naive O(n²) scan and
   the hash-based O(n) approach on growing subsets of your data and
   plots both. At small n the naive approach can look competitive
   (constant-factor overhead of hashing dominates); the O(n) vs O(n²)
   gap becomes obvious as n grows into the thousands — try generating
   a few thousand records to see the curves diverge.

## Notes for the report / viva

- **Why hashing helps:** without it, checking "have I seen this
  record before?" means comparing against every previously seen
  record — O(n) per record, O(n²) overall. A hash table turns that
  check into an O(1) average-case bucket lookup, so the whole pass
  becomes O(n).
- **Collision handling:** this project uses *separate chaining*
  (each bucket holds a list) rather than open addressing, because it
  makes the "how many records collided into this bucket" visualization
  straightforward and keeps deletion (not needed here, but common in
  DS courses) simple.
- **Why keys are normalized:** duplicate detection uses `strip()` +
  `lower()` on the chosen fields before hashing, so `"John Doe"` and
  `"  JOHN DOE  "` hash to the same key and are correctly flagged as
  duplicates, not just byte-for-byte identical rows.
- **Limitation to mention if asked:** this detects *exact* duplicates
  (after normalization), not fuzzy/near-duplicates with typos — that
  would need a different technique (e.g. edit-distance or n-gram
  similarity), which is a natural "future work" extension to mention.

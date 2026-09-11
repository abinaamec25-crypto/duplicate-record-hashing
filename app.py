"""
app.py
------
Flask backend for the "Duplicate Record Detection using Hashing
Technique" DS project.

Routes:
  GET  /                        -> serves the web UI
  POST /api/sample              -> generate a synthetic dataset
  POST /api/upload              -> upload a CSV of records
  POST /api/detect              -> run hashing-based duplicate detection
  POST /api/compare             -> naive O(n^2) vs hashing O(n) timing
  GET  /api/fields              -> field names of the currently loaded dataset

The heavy lifting (HashTable, detection algorithms) lives in
hashtable.py and duplicate_detector.py -- this file is just the web
layer around that data structure.
"""

from flask import Flask, jsonify, render_template, request

from duplicate_detector import hash_based_detect, performance_comparison
from parser import parse_uploaded_records
from sample_generator import generate_dataset

app = Flask(__name__)

# Simple in-memory dataset store (fine for a single-user DS demo/project).
STATE = {
    "records": [],
    "fields": [],
}


def infer_fields(records):
    fields = []
    seen = set()
    for record in records:
        if not isinstance(record, dict):
            continue
        for key in record.keys():
            if key not in seen:
                seen.add(key)
                fields.append(key)
    return fields


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/sample", methods=["POST"])
def api_sample():
    body = request.get_json(silent=True) or {}
    num_unique = int(body.get("num_unique", 60))
    duplicate_ratio = float(body.get("duplicate_ratio", 0.35))
    num_unique = max(5, min(num_unique, 2000))
    duplicate_ratio = max(0.0, min(duplicate_ratio, 0.9))

    records = generate_dataset(num_unique=num_unique, duplicate_ratio=duplicate_ratio)
    STATE["records"] = records
    STATE["fields"] = list(records[0].keys()) if records else []

    return jsonify({
        "records": records,
        "fields": STATE["fields"],
        "count": len(records),
    })


@app.route("/api/upload", methods=["POST"])
def api_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Use form field name 'file'."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    try:
        records = parse_uploaded_records(file.read(), file.filename)
    except Exception as exc:
        return jsonify({"error": f"Could not parse file '{file.filename}': {exc}"}), 400

    if not records:
        return jsonify({"error": "Uploaded file appears to be empty or unsupported."}), 400

    STATE["records"] = records
    STATE["fields"] = infer_fields(records)

    return jsonify({
        "records": records,
        "fields": STATE["fields"],
        "count": len(records),
    })


@app.route("/api/fields", methods=["GET"])
def api_fields():
    return jsonify({"fields": STATE["fields"], "count": len(STATE["records"])})


@app.route("/api/detect", methods=["POST"])
def api_detect():
    body = request.get_json(silent=True) or {}
    fields = body.get("fields") or STATE["fields"]

    if not STATE["records"]:
        return jsonify({"error": "No dataset loaded. Generate a sample or upload a CSV first."}), 400
    if not fields:
        return jsonify({"error": "No fields selected for comparison."}), 400

    result = hash_based_detect(STATE["records"], fields)
    return jsonify({
        "total_records": len(STATE["records"]),
        "unique_count": len(result["unique_records"]),
        "duplicate_count": len(result["duplicate_records"]),
        "duplicates": result["duplicate_records"],
        "hash_stats": result["hash_stats"],
        "fields_used": fields,
    })


@app.route("/api/compare", methods=["POST"])
def api_compare():
    body = request.get_json(silent=True) or {}
    fields = body.get("fields") or STATE["fields"]

    if not STATE["records"]:
        return jsonify({"error": "No dataset loaded. Generate a sample or upload a CSV first."}), 400
    if not fields:
        return jsonify({"error": "No fields selected for comparison."}), 400

    comparison = performance_comparison(STATE["records"], fields)
    return jsonify(comparison)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

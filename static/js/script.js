// script.js — thin client for the duplicate-detection API.
// All the actual hashing / detection logic lives server-side in
// hashtable.py and duplicate_detector.py; this file only renders it.

let currentFields = [];
let currentRecords = [];
let lastDetectResult = null;
let perfChart = null;

const el = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const line = el("datasetStatus");
  line.textContent = text;
  line.className = "status-line" + (kind ? " " + kind : "");
}

function renderFieldChoices(fields) {
  const container = el("fieldList");
  container.innerHTML = "";
  fields.forEach((f, i) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = f;
    cb.checked = true; // default: compare on all fields
    label.appendChild(cb);
    label.appendChild(document.createTextNode(f));
    container.appendChild(label);
  });
}

function getSelectedFields() {
  return Array.from(document.querySelectorAll("#fieldList input[type=checkbox]:checked"))
    .map((cb) => cb.value);
}

function onDatasetLoaded(data) {
  currentFields = data.fields;
  currentRecords = data.records;
  renderFieldChoices(currentFields);
  setStatus(`${data.count} records loaded.`, "ok");
  el("btnDetect").disabled = false;
  el("btnCompare").disabled = false;
  el("placeholderSection").style.display = "none";
  renderRawTable(currentRecords, currentFields, null);
  el("tableSection").style.display = "block";
}

async function generateSample() {
  const num_unique = parseInt(el("numUnique").value, 10) || 60;
  const duplicate_ratio = parseFloat(el("dupRatio").value) || 0.35;
  setStatus("Generating sample dataset…");
  try {
    const res = await fetch("/api/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num_unique, duplicate_ratio }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate sample");
    onDatasetLoaded(data);
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function uploadCsv() {
  const input = el("fileInput");
  if (!input.files.length) {
    setStatus("Choose a CSV file first.", "error");
    return;
  }
  const form = new FormData();
  form.append("file", input.files[0]);
  setStatus("Uploading…");
  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    onDatasetLoaded(data);
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function renderRawTable(records, fields, duplicateIndexSet) {
  const head = el("tableHead");
  const body = el("tableBody");
  head.innerHTML = "";
  body.innerHTML = "";

  const th0 = document.createElement("th");
  th0.textContent = "#";
  head.appendChild(th0);
  fields.forEach((f) => {
    const th = document.createElement("th");
    th.textContent = f;
    head.appendChild(th);
  });
  const thStatus = document.createElement("th");
  thStatus.textContent = "Status";
  head.appendChild(thStatus);

  records.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    const isDup = duplicateIndexSet && duplicateIndexSet.has(idx);
    if (isDup) tr.classList.add("duplicate");

    const tdIdx = document.createElement("td");
    tdIdx.textContent = idx;
    tr.appendChild(tdIdx);

    fields.forEach((f) => {
      const td = document.createElement("td");
      td.textContent = rec[f] !== undefined ? rec[f] : "";
      tr.appendChild(td);
    });

    const tdStatus = document.createElement("td");
    if (duplicateIndexSet) {
      const tag = document.createElement("span");
      tag.className = "tag " + (isDup ? "dup" : "uniq");
      tag.textContent = isDup ? "duplicate" : "unique";
      tdStatus.appendChild(tag);
    } else {
      tdStatus.textContent = "–";
    }
    tr.appendChild(tdStatus);

    body.appendChild(tr);
  });
}

function renderBucketGrid(bucketSizes) {
  const grid = el("bucketGrid");
  grid.innerHTML = "";
  bucketSizes.forEach((size) => {
    const cell = document.createElement("div");
    cell.className = "k-cell";
    if (size === 1) cell.setAttribute("data-depth", "1");
    else if (size === 2) cell.setAttribute("data-depth", "2");
    else if (size >= 3) cell.setAttribute("data-depth", "collide");
    cell.textContent = size > 0 ? size : "";
    cell.title = `bucket, ${size} record(s)`;
    grid.appendChild(cell);
  });
  el("bucketSection").style.display = "block";
}

async function detectDuplicates() {
  const fields = getSelectedFields();
  if (!fields.length) {
    setStatus("Select at least one field.", "error");
    return;
  }
  setStatus("Running hash-based detection…");
  try {
    const res = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Detection failed");

    lastDetectResult = data;
    setStatus(`Detection complete on ${data.total_records} records.`, "ok");

    el("statTotal").textContent = data.total_records;
    el("statUnique").textContent = data.unique_count;
    el("statDup").textContent = data.duplicate_count;
    el("statTableSize").textContent = data.hash_stats.table_size;
    el("statLoadFactor").textContent = data.hash_stats.load_factor;
    el("statCollisions").textContent = data.hash_stats.total_collisions;
    el("statMaxChain").textContent = data.hash_stats.max_chain_length;
    el("statResizes").textContent = data.hash_stats.resize_count;
    el("statsSection").style.display = "block";

    renderBucketGrid(data.hash_stats.bucket_sizes);

    const dupSet = new Set(data.duplicates.map((d) => d.index));
    renderRawTable(currentRecords, currentFields, dupSet);
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function runComparison() {
  const fields = getSelectedFields();
  if (!fields.length) {
    setStatus("Select at least one field.", "error");
    return;
  }
  setStatus("Timing naive vs. hash-based detection…");
  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Comparison failed");

    setStatus("Comparison complete.", "ok");
    el("chartSection").style.display = "block";
    drawChart(data);
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function drawChart(data) {
  const ctx = el("perfChart").getContext("2d");
  if (perfChart) perfChart.destroy();

  perfChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.sizes,
      datasets: [
        {
          label: "Naive O(n²)",
          data: data.naive_ms,
          borderColor: "#e2725b",
          backgroundColor: "rgba(226,114,91,0.12)",
          tension: 0.25,
          fill: true,
        },
        {
          label: "Hash table O(n)",
          data: data.hash_ms,
          borderColor: "#e0a745",
          backgroundColor: "rgba(224,167,69,0.12)",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Number of records", color: "#93a1b0" }, ticks: { color: "#93a1b0" }, grid: { color: "#34404d" } },
        y: { title: { display: true, text: "Time (ms)", color: "#93a1b0" }, ticks: { color: "#93a1b0" }, grid: { color: "#34404d" } },
      },
    },
  });
}

el("btnSample").addEventListener("click", generateSample);
el("btnUpload").addEventListener("click", uploadCsv);
el("btnDetect").addEventListener("click", detectDuplicates);
el("btnCompare").addEventListener("click", runComparison);

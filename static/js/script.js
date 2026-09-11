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
  const canvas = el("perfChart");
  const ctx = canvas.getContext("2d");

  const sizes = Array.isArray(data.sizes) ? data.sizes : [];
  const naive = Array.isArray(data.naive_ms) ? data.naive_ms : [];
  const hash = Array.isArray(data.hash_ms) ? data.hash_ms : [];

  if (!sizes.length || !naive.length || !hash.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, rect.width || 640);
  const height = 260;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = [...naive, ...hash];
  const maxValue = Math.max(1, ...allValues);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f1720";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#34404d";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#93a1b0";
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  function drawLine(points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function mapPoint(index, value) {
    return {
      x: padding.left + (index / Math.max(1, sizes.length - 1)) * chartWidth,
      y: height - padding.bottom - (value / maxValue) * chartHeight,
    };
  }

  const naivePoints = naive.map((value, index) => mapPoint(index, value));
  const hashPoints = hash.map((value, index) => mapPoint(index, value));

  drawLine(naivePoints, "#e2725b");
  drawLine(hashPoints, "#e0a745");

  ctx.fillStyle = "#93a1b0";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Number of records", width / 2, height - 8);

  ctx.save();
  ctx.translate(14, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Time (ms)", 0, 0);
  ctx.restore();

  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxValue / 4) * (4 - i);
    const y = padding.top + (chartHeight / 4) * i;
    ctx.fillText(value.toFixed(1), padding.left - 8, y + 4);
  }

  ctx.textAlign = "center";
  sizes.forEach((size, index) => {
    const x = padding.left + (index / Math.max(1, sizes.length - 1)) * chartWidth;
    ctx.fillText(String(size), x, height - padding.bottom + 18);
  });
}

el("btnSample").addEventListener("click", generateSample);
el("btnUpload").addEventListener("click", uploadCsv);
el("btnDetect").addEventListener("click", detectDuplicates);
el("btnCompare").addEventListener("click", runComparison);

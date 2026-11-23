const DEFAULT_ACTIVITIES = [
  { name: "Ambil material", resourceType: "human", resourceName: "Manusia 1", start: 0, duration: 8 },
  { name: "Loading Mesin 1", resourceType: "human", resourceName: "Manusia 1", start: 8, duration: 10 },
  { name: "Siapkan fixture", resourceType: "human", resourceName: "Manusia 2", start: 12, duration: 14 },
  { name: "Proses otomatis 1", resourceType: "machine", resourceName: "Mesin 1", start: 18, duration: 32 },
  { name: "Proses otomatis 2", resourceType: "machine", resourceName: "Mesin 2", start: 26, duration: 24 },
  { name: "Inspeksi visual", resourceType: "human", resourceName: "Manusia 2", start: 42, duration: 8 },
  { name: "Unloading Mesin 1", resourceType: "human", resourceName: "Manusia 1", start: 50, duration: 10 }
];

const SESSION_STORAGE_KEY = "mmChartSessionSimulationV2";
const LEGACY_SESSION_STORAGE_KEY = "mmChartSessionSimulation";
const LEGACY_STORAGE_KEY = "mmChartSimulation";
const RELOAD_MARK_KEY = "mmChartReloadAt";
const RELOAD_RESTORE_WINDOW_MS = 5000;
const BASE_PX_PER_SECOND = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const RESOURCE_LABEL_WIDTH = 118;

const state = {
  activeCycleIndex: 0,
  zoom: 1,
  lastCycleTime: null,
  cycles: [
    { start: 0, activities: [] }
  ]
};

const form = document.querySelector("#chartForm");
const rowsEl = document.querySelector("#activityRows");
const activeCycleSelect = document.querySelector("#activeCycleSelect");
const activeCycleStartInput = document.querySelector("#activeCycleStart");
const chartEl = document.querySelector("#chart");
const chartHeaderEl = document.querySelector("#chartHeader");
const summaryCardsEl = document.querySelector("#summaryCards");
const chartFormatSelect = document.querySelector("#chartFormat");
const processChartEl = document.querySelector("#processChart");
const totalTimeLabelEl = document.querySelector("#totalTimeLabel");
const chartTitleEl = document.querySelector("#chartTitle");
const chartSubtitleEl = document.querySelector("#chartSubtitle");
const chartShellEl = document.querySelector(".chart-shell");
const simulationFileInput = document.querySelector("#simulationFileInput");

document.querySelector("#addActivityBtn").addEventListener("click", () => {
  readRows();
  getActiveCycle().activities.push({
    name: "Aktivitas baru",
    resourceType: "human",
    resourceName: "Manusia 1",
    start: getNextStartFromActivities(),
    duration: 0
  });
  renderRows();
  generateChart();
});

document.querySelector("#newCalculationBtn").addEventListener("click", startNewCalculation);

document.querySelector("#loadExampleBtn").addEventListener("click", () => {
  document.querySelector("#processName").value = "Loading - Machining - Unloading";
  document.querySelector("#timeUnit").value = "detik";
  document.querySelector("#cycleTime").value = 60;
  document.querySelector("#cycleCount").value = 3;
  document.querySelector("#humanCount").value = 2;
  document.querySelector("#machineCount").value = 2;
  state.activeCycleIndex = 0;
  state.cycles = createCycles(3, 60, cloneActivities(DEFAULT_ACTIVITIES));
  renderCycleEditor();
  renderRows();
  generateChart();
});

document.querySelector("#printBtn").addEventListener("click", () => window.print());
document.querySelector("#generateChartBtn").addEventListener("click", updateChartFromForm);
document.querySelector("#saveSimulationBtn").addEventListener("click", saveSimulation);
document.querySelector("#loadSimulationBtn").addEventListener("click", () => simulationFileInput.click());
document.querySelector("#exportPdfBtn").addEventListener("click", exportPdf);
document.querySelector("#exportExcelBtn").addEventListener("click", exportExcel);
document.querySelector("#zoomInBtn").addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
document.querySelector("#zoomOutBtn").addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
document.querySelector("#zoomResetBtn").addEventListener("click", () => setZoom(1));
chartFormatSelect.addEventListener("change", generateChart);
simulationFileInput.addEventListener("change", loadSimulationFromFile);
setupDragScroll(chartShellEl);
setupDragScroll(processChartEl);
setupChartWheelZoom();
setupProcessChartSuggestion();
activeCycleSelect.addEventListener("change", () => {
  readRows();
  state.activeCycleIndex = Number(activeCycleSelect.value) || 0;
  renderCycleEditor();
  renderRows();
  generateChart();
});
activeCycleStartInput.addEventListener("input", () => {
  shiftActiveCycleStart(Math.max(0, Number(activeCycleStartInput.value) || 0));
  generateChart();
});
document.querySelector("#copyPreviousCycleBtn").addEventListener("click", copyPreviousCycle);

document.querySelectorAll("#processName, #timeUnit, #cycleTime, #cycleCount, #humanCount, #machineCount").forEach((input) => {
  input.addEventListener("input", (event) => {
    readRows();

    if (event.target.id === "humanCount" || event.target.id === "machineCount") {
      syncResourceNamesWithCounts();
      renderRows();
    }

    if (event.target.id === "cycleCount" || event.target.id === "cycleTime") {
      syncCyclesWithInputs();
      syncResourceNamesWithCounts();
      renderCycleEditor();
      renderRows();
    }

    generateChart();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateChartFromForm();
});

function updateChartFromForm() {
  readRows();
  generateChart();
}

function startNewCalculation() {
  readRows();

  if (hasCurrentCalculationData() && !confirm("Mulai perhitungan baru? Data yang belum disimpan akan dihapus.")) {
    return;
  }

  form.reset();
  document.querySelector("#timeUnit").value = "detik";
  simulationFileInput.value = "";
  state.activeCycleIndex = 0;
  state.zoom = 1;
  state.lastCycleTime = null;
  state.cycles = [
    { start: 0, activities: [] }
  ];
  chartFormatSelect.value = "timeline";
  document.querySelector("#zoomResetBtn").textContent = "100%";
  clearSessionAutosave();
  clearReloadMarker();
  renderCycleEditor();
  renderRows();
  generateChart();
  document.querySelector("#processName").focus();
}

function hasCurrentCalculationData() {
  const hasFormData = ["#processName", "#cycleTime", "#cycleCount", "#humanCount", "#machineCount"]
    .some((selector) => document.querySelector(selector).value.trim() !== "");
  const hasCycleData = state.cycles.some((cycle) => (
    (Number(cycle.start) || 0) > 0 ||
    (Array.isArray(cycle.activities) && cycle.activities.length > 0)
  ));

  return hasFormData || hasCycleData;
}

function saveAutosave() {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(getSimulationData()));
  } catch (error) {
    // Browser storage can be disabled; the app should still keep running.
  }
}

function loadAutosave() {
  try {
    const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!savedData) return false;

    applySimulationData(JSON.parse(savedData));
    return true;
  } catch (error) {
    return false;
  }
}

function shouldRestoreAutosave() {
  try {
    const navigation = performance.getEntriesByType("navigation")[0];
    const reloadAt = Number(localStorage.getItem(RELOAD_MARK_KEY)) || 0;
    const isRecentReload = Date.now() - reloadAt <= RELOAD_RESTORE_WINDOW_MS;

    return navigation?.type === "reload" && isRecentReload;
  } catch (error) {
    return false;
  }
}

function clearSessionAutosave() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access errors; a clean start can still render normally.
  }
}

function clearLegacyAutosave() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access errors; a fresh session can still start normally.
  }
}

function clearReloadMarker() {
  try {
    localStorage.removeItem(RELOAD_MARK_KEY);
  } catch (error) {
    // Ignore storage access errors; the marker is only a refresh hint.
  }
}

window.addEventListener("beforeunload", () => {
  try {
    localStorage.setItem(RELOAD_MARK_KEY, String(Date.now()));
  } catch (error) {
    // If the marker cannot be stored, the next open will start clean.
  }
});

function setZoom(nextZoom, anchorRatio = 0.5) {
  const activeScrollEl = chartFormatSelect.value === "vertical" ? processChartEl : chartShellEl;
  const previousScrollWidth = activeScrollEl.scrollWidth || 1;
  const previousViewport = activeScrollEl.clientWidth || 1;
  const anchorX = activeScrollEl.scrollLeft + previousViewport * anchorRatio;
  const scrollRatio = anchorX / previousScrollWidth;

  state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  document.querySelector("#zoomResetBtn").textContent = `${Math.round(state.zoom * 100)}%`;
  generateChart();

  const nextAnchorX = activeScrollEl.scrollWidth * scrollRatio;
  activeScrollEl.scrollLeft = Math.max(0, nextAnchorX - activeScrollEl.clientWidth * anchorRatio);
}

function setupDragScroll(scrollEl) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  scrollEl.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;

    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = scrollEl.scrollLeft;
    startScrollTop = scrollEl.scrollTop;
    scrollEl.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    event.preventDefault();
    scrollEl.scrollLeft = startScrollLeft - (event.clientX - startX);
    scrollEl.scrollTop = startScrollTop - (event.clientY - startY);
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    scrollEl.classList.remove("is-dragging");
  });
}

function setupChartWheelZoom() {
  setupWheelZoom(chartShellEl);
  setupWheelZoom(processChartEl);
}

function setupWheelZoom(scrollEl) {
  scrollEl.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    const rect = scrollEl.getBoundingClientRect();
    const anchorRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setZoom(state.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), anchorRatio);
  }, { passive: false });
}

function saveSimulation() {
  readRows();
  const data = getSimulationData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const fileName = `${slugify(data.processName || "mm-chart")}-${new Date().toISOString().slice(0, 10)}.json`;

  saveAutosave();
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadSimulationFromFile(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      applySimulationData(JSON.parse(reader.result));
      alert("File simulasi MM Chart berhasil dimuat.");
    } catch (error) {
      alert("File simulasi tidak bisa dibaca. Pastikan file berformat JSON dari aplikasi MM Chart.");
    } finally {
      simulationFileInput.value = "";
    }
  });
  reader.readAsText(file);
}

function getSimulationData() {
  return {
    processName: document.querySelector("#processName").value,
    timeUnit: document.querySelector("#timeUnit").value,
    cycleTime: document.querySelector("#cycleTime").value,
    cycleCount: document.querySelector("#cycleCount").value,
    humanCount: document.querySelector("#humanCount").value,
    machineCount: document.querySelector("#machineCount").value,
    chartFormat: chartFormatSelect.value,
    activeCycleIndex: state.activeCycleIndex,
    zoom: state.zoom,
    cycles: state.cycles
  };
}

function applySimulationData(data) {
  document.querySelector("#processName").value = data.processName || "";
  document.querySelector("#timeUnit").value = data.timeUnit || "detik";
  document.querySelector("#cycleTime").value = data.cycleTime || "";
  document.querySelector("#cycleCount").value = data.cycleCount || "";
  document.querySelector("#humanCount").value = data.humanCount || "";
  document.querySelector("#machineCount").value = data.machineCount || "";
  chartFormatSelect.value = data.chartFormat === "vertical" ? "vertical" : "timeline";
  state.activeCycleIndex = Math.max(0, Number(data.activeCycleIndex) || 0);
  state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(data.zoom) || 1));
  document.querySelector("#zoomResetBtn").textContent = `${Math.round(state.zoom * 100)}%`;
  state.cycles = normalizeLoadedCycles(data);
  syncCyclesWithInputs();
  syncResourceNamesWithCounts();
  renderCycleEditor();
  renderRows();
  generateChart();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mm-chart";
}

function cloneActivities(activities) {
  return activities.map((activity) => ({ ...activity }));
}

function createCycles(count, cycleTime, baseActivities = []) {
  return Array.from({ length: count }, (_, index) => ({
    start: index * cycleTime,
    activities: cloneActivities(baseActivities)
  }));
}

function normalizeLoadedCycles(data) {
  if (Array.isArray(data.cycles)) {
    return data.cycles.map((cycle, index) => ({
      start: Math.max(0, Number(cycle.start) || index * Number(data.cycleTime || 1)),
      activities: Array.isArray(cycle.activities) ? cloneActivities(cycle.activities) : []
    }));
  }

  const activities = Array.isArray(data.activities) ? data.activities : [];
  const starts = Array.isArray(data.cycleStarts) ? data.cycleStarts : [];
  const cycleTime = Math.max(1, Number(data.cycleTime) || 1);
  const count = Math.max(1, Number(data.cycleCount) || 1);

  return Array.from({ length: count }, (_, index) => ({
    start: index === 0 ? 0 : Math.max(0, Number(starts[index]) || index * cycleTime),
    activities: cloneActivities(activities)
  }));
}

function getActiveCycle() {
  syncCyclesWithInputs();
  return state.cycles[state.activeCycleIndex] || state.cycles[0];
}

function copyPreviousCycle() {
  readRows();

  if (state.activeCycleIndex <= 0) {
    alert("Cycle 1 tidak memiliki cycle sebelumnya.");
    return;
  }

  const previousCycle = state.cycles[state.activeCycleIndex - 1];
  const activeCycle = getActiveCycle();
  const cycleTime = Math.max(1, Number(document.querySelector("#cycleTime").value) || 1);
  activeCycle.start = getSequentialCycleStart(state.activeCycleIndex, cycleTime);
  activeCycle.activities = cloneActivities(previousCycle.activities);
  renderCycleEditor();
  renderRows();
  generateChart();
}

function shiftActiveCycleStart(newStart) {
  const activeCycle = getActiveCycle();
  const oldStart = Math.max(0, Number(activeCycle.start) || 0);
  const delta = newStart - oldStart;

  rowsEl.querySelectorAll('[data-field="start"]').forEach((input) => {
    const currentValue = Math.max(0, Number(input.value) || 0);
    input.value = formatNumber(Math.max(0, currentValue + delta));
  });

  const firstStartInput = rowsEl.querySelector('tr [data-field="start"]');
  if (firstStartInput) {
    firstStartInput.value = formatNumber(newStart);
    fillFollowingStartsFromRow(firstStartInput);
  }

  activeCycle.start = newStart;
  readRows();
}

function exportPdf() {
  updateChartFromForm();
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    alert("Popup diblokir browser. Izinkan popup untuk export PDF.");
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(buildPdfReportHtml());
  reportWindow.document.close();
  reportWindow.addEventListener("load", () => {
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 300);
  });
}

function buildPdfReportHtml() {
  const processName = document.querySelector("#processName").value.trim() || "Man Machine Chart";
  const unit = document.querySelector("#timeUnit").value;
  const cycleTime = Math.max(1, Number(document.querySelector("#cycleTime").value) || 1);
  const cycleCount = Math.max(1, Number(document.querySelector("#cycleCount").value) || 1);
  const totalTime = getTotalTimeline(cycleTime, getCycleStarts(cycleTime, cycleCount));
  const isVerticalFormat = chartFormatSelect.value === "vertical";
  const chartWidth = isVerticalFormat
    ? Math.max(processChartEl.scrollWidth, processChartEl.offsetWidth)
    : Math.max(chartHeaderEl.scrollWidth + 118, chartEl.scrollWidth);
  const contentWidth = Math.max(980, chartWidth);
  const pageWidthMm = Math.ceil((contentWidth * 25.4 / 96) + 16);
  const reportChartHtml = isVerticalFormat
    ? processChartEl.outerHTML
    : `
      <section class="chart-shell">
        <div class="pdf-chart-scale">
          ${chartHeaderEl.outerHTML}
          ${chartEl.outerHTML}
        </div>
      </section>
    `;

  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(processName)} - PDF</title>
        <base href="${document.baseURI}">
        <link rel="stylesheet" href="styles.css?v=excel-calculation-1">
        <style>
          @page {
            size: ${pageWidthMm}mm 297mm;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body {
            margin: 0;
            background: #ffffff;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
          }

          .pdf-page {
            padding: 16px;
          }

          .pdf-fit-page {
            width: ${contentWidth}px;
            height: auto;
            overflow: visible;
          }

          .pdf-fit-content {
            width: ${contentWidth}px;
          }

          .pdf-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            padding: 10px 12px;
            border: 1px solid #bfdbfe;
            border-radius: 10px;
            background: #eff6ff;
            color: #1e3a8a;
            font-size: 12px;
            font-weight: 700;
          }

          .pdf-toolbar button {
            border: 0;
            border-radius: 8px;
            padding: 8px 12px;
            background: #2563eb;
            color: #ffffff;
            cursor: pointer;
            font-weight: 700;
          }

          .pdf-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 14px;
            border-bottom: 2px solid #dbeafe;
            padding-bottom: 12px;
          }

          .pdf-header h1 {
            margin: 0 0 6px;
            font-size: 24px;
          }

          .pdf-header p {
            margin: 0;
            color: #475569;
            font-size: 12px;
          }

          .pdf-meta {
            min-width: 210px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px;
            background: #f8fafc;
            font-size: 12px;
          }

          .summary {
            margin-bottom: 12px;
          }

          .chart-shell {
            max-height: none;
            height: auto;
            overflow: visible;
            width: ${chartWidth}px;
            box-shadow: none;
          }

          .pdf-chart-scale {
            width: ${chartWidth}px;
          }

          .chart-header,
          .timeline {
            min-width: 0;
          }

          .cycle-title {
            min-height: 38px;
            padding: 8px 16px;
            font-size: 13px;
          }

          .lane {
            min-height: 58px;
          }

          .lane-label {
            padding: 8px;
            font-size: 13px;
          }

          .idle-fill {
            top: 10px;
            bottom: 10px;
          }

          .bar {
            top: 10px;
            height: 36px;
            border-radius: 8px;
          }

          .bar-content {
            padding: 6px 10px;
          }

          .bar strong {
            font-size: 12px;
          }

          .bar span {
            font-size: 11px;
          }

          .legend {
            margin-top: 12px;
          }

          .process-chart {
            max-height: none;
            overflow: visible;
            cursor: default;
          }

          @media print {
            .pdf-toolbar {
              display: none;
            }

            .pdf-page {
              padding: 0;
            }

            .pdf-fit-page {
              break-inside: auto;
            }

            .pdf-fit-content,
            .chart-shell,
            .chart,
            .chart-header,
            .cycle-group,
            .lane,
            .timeline {
              break-inside: auto;
              page-break-inside: auto;
            }
          }
        </style>
      </head>
      <body>
        <main class="pdf-page">
          <section class="pdf-toolbar">
            <span>Untuk menyimpan file, pilih printer "Save as PDF" atau "Microsoft Print to PDF", lalu klik Save.</span>
            <button type="button" onclick="window.print()">Print / Save PDF</button>
          </section>
          <div class="pdf-fit-page">
            <div class="pdf-fit-content">
              <section class="pdf-header">
                <div>
                  <h1>${escapeHtml(processName)}</h1>
                  <p>Man Machine Chart berwarna</p>
                </div>
                <div class="pdf-meta">
                  <div>Timeline: <strong>${formatNumber(cycleTime)} ${unit}</strong></div>
                  <div>Jumlah cycle: <strong>${cycleCount}</strong></div>
                  <div>Total waktu: <strong>${formatNumber(totalTime)} ${unit}</strong></div>
                </div>
              </section>
              ${summaryCardsEl.outerHTML}
              ${reportChartHtml}
              ${document.querySelector(".legend").outerHTML}
            </div>
          </div>
        </main>
      </body>
    </html>
  `;
}

function exportExcel() {
  readRows();

  const processName = document.querySelector("#processName").value.trim() || "Man Machine Chart";
  const unit = document.querySelector("#timeUnit").value;
  const cycleTime = Math.max(1, Number(document.querySelector("#cycleTime").value) || 1);
  const cycleCount = Math.max(1, Number(document.querySelector("#cycleCount").value) || 1);
  const cycleStarts = getCycleStarts(cycleTime, cycleCount);
  const totalTime = getTotalTimeline(cycleTime, cycleStarts);
  const resources = getResources();
  const intervals = buildTimeIntervals(totalTime, 1);
  const fileName = `${slugify(processName)}-chart.xls`;
  const html = chartFormatSelect.value === "vertical"
    ? buildVerticalExcelHtml(processName, unit, cycleTime, cycleCount, resources, cycleStarts)
    : buildExcelHtml(processName, unit, cycleTime, cycleCount, totalTime, intervals, resources, cycleStarts);

  downloadFile(html, fileName, "application/vnd.ms-excel");
}

function buildVerticalExcelHtml(processName, unit, cycleTime, cycleCount, resources, cycleStarts) {
  const timeScale = getVerticalTimeScale(cycleTime, cycleCount, resources);
  const calculationTable = buildExcelCalculationTable(resources, cycleTime, cycleCount, unit);
  const columns = [];

  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    resources.forEach((resource) => {
      columns.push({ cycle, resource });
    });
  }

  const cycleHeaderCells = Array.from({ length: cycleCount }, (_, index) => (
    `<th colspan="${resources.length}" style="background:#eef6ff;color:#1e3a8a;border:1px solid #bfdbfe;text-align:center;font-weight:bold;height:28px;">Cycle ${index + 1}</th>`
  )).join("");
  const resourceHeaderCells = columns.map(({ resource }) => (
    `<th style="width:190px;background:#f8fafc;color:#172033;border:1px solid #cbd5e1;text-align:center;font-weight:bold;height:34px;">${escapeHtml(resource.name)}</th>`
  )).join("");
  const rows = [];

  for (let time = timeScale - 1; time >= 0; time -= 1) {
    const nextTime = time + 1;
    const cells = columns.map(({ cycle, resource }) => {
      const cycleStart = cycleStarts[cycle - 1] || 0;
      const bars = buildBars(resource, cycleTime, state.cycles[cycle - 1]?.activities || []);
      const activeBar = bars.find((bar) => rangesOverlap(time, nextTime, bar.start, bar.end));

      if (!activeBar) {
        return '<td style="height:26px;background:#ffffff;border:1px solid #e2e8f0;"></td>';
      }

      const activeTop = Math.ceil(activeBar.end) - 1;

      if (time !== activeTop) {
        return "";
      }

      const color = activeBar.isWaiting
        ? "#dc2626"
        : resource.type === "human" ? "#22c55e" : "#f97316";
      const rowSpan = Math.max(1, Math.ceil(activeBar.end) - Math.floor(activeBar.start));
      const label = `${escapeHtml(activeBar.name)}<br>${formatNumber(activeBar.duration)} ${escapeHtml(unit)}<br>${formatNumber(cycleStart + activeBar.start)}-${formatNumber(cycleStart + activeBar.end)} ${escapeHtml(unit)}`;

      return `<td rowspan="${rowSpan}" style="height:${rowSpan * 26}px;background:${color};color:#ffffff;border:2px solid #ffffff;font-weight:bold;text-align:center;vertical-align:middle;">${label}</td>`;
    }).join("");

    rows.push(`
      <tr>
        <th style="width:90px;background:#ffffff;color:#64748b;border:1px solid #cbd5e1;text-align:right;padding-right:8px;height:26px;">${formatNumber(time)}-${formatNumber(nextTime)} ${unit}</th>
        ${cells}
      </tr>
    `);
  }

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #172033; }
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; table-layout: fixed; }
          th, td { mso-number-format:"\\@"; vertical-align: middle; }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(processName)}</h2>
        <p>Grafik Batang Vertikal | Timeline: ${formatNumber(cycleTime)} ${unit} | Jumlah cycle: ${cycleCount}</p>
        ${calculationTable}
        <table>
          <tr>
            <th rowspan="2" style="width:90px;background:#0f172a;color:#ffffff;border:1px solid #0f172a;text-align:center;">Waktu</th>
            ${cycleHeaderCells}
          </tr>
          <tr>
            ${resourceHeaderCells}
          </tr>
          ${rows.join("")}
        </table>
      </body>
    </html>
  `;
}

function buildExcelCalculationTable(resources, cycleTime, cycleCount, unit) {
  const rows = resources.map((resource) => {
    const typeLabel = resource.type === "human" ? "Manusia" : "Mesin";
    const stats = getResourceTimeStats(resource, cycleTime, cycleCount);

    return `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;font-weight:bold;">${escapeHtml(resource.name)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;">${typeLabel}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.process)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.waiting)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.total)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.average)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.min)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;text-align:right;">${formatNumber(stats.max)} ${unit}</td>
      </tr>
    `;
  }).join("");

  return `
    <h3>Perhitungan Waktu</h3>
    <table style="margin-bottom:18px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">
      <tr>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Resource</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Jenis</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Proses</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Menunggu</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Total</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Rata-rata</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Minimal</th>
        <th style="border:1px solid #0f172a;padding:6px;background:#0f172a;color:#ffffff;">Maksimal</th>
      </tr>
      ${rows}
    </table>
  `;
}

function buildExcelHtml(processName, unit, cycleTime, cycleCount, totalTime, intervals, resources, cycleStarts) {
  const calculationTable = buildExcelCalculationTable(resources, cycleTime, cycleCount, unit);
  const timeColumns = intervals.map((interval) => (
    `<col style="width:${interval.width}px;">`
  )).join("");
  const headerCells = intervals.map((interval) => (
    `<th style="width:${interval.width}px;background:#ffffff;color:#64748b;border:1px solid #cbd5e1;text-align:center;font-size:9px;">${isWholeNumber(interval.start) ? formatNumber(interval.start) : ""}</th>`
  )).join("");

  const rows = [];

  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    const cycleStart = cycleStarts[cycle - 1] || 0;

    rows.push(`
      <tr>
        <td colspan="${intervals.length + 1}" style="height:26px;background:#eef6ff;color:#1e3a8a;font-weight:bold;border:1px solid #bfdbfe;">
          Cycle ${cycle}
        </td>
      </tr>
    `);

    resources.forEach((resource) => {
      const cycleActivities = state.cycles[cycle - 1]?.activities || [];
      const cells = renderExcelCells(resource, cycleStart, cycleTime, cycleActivities, intervals, unit);
      const labelColor = resource.type === "human" ? "#166534" : "#9a3412";

      rows.push(`
        <tr style="height:34px;">
          <td style="width:120px;background:#f8fafc;border:1px solid #cbd5e1;font-weight:bold;text-align:center;color:${labelColor};">${escapeHtml(resource.name)}</td>
          ${cells}
        </tr>
      `);
    });
  }

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #172033;
          }

          h2 {
            margin-bottom: 4px;
          }

          p {
            margin-top: 0;
            color: #475569;
          }

          table {
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            font-size: 11px;
            table-layout: fixed;
          }

          th,
          td {
            mso-number-format:"\\@";
            vertical-align: middle;
            border: 1px solid #e2e8f0;
          }

          .header-cell {
            background: #0f172a;
            color: #ffffff;
            font-weight: bold;
            text-align: center;
          }

          .time-cell {
            width: 24px;
            min-width: 24px;
            background: #ffffff;
            color: #64748b;
            border-left: 1px solid #cbd5e1;
            border-right: 1px solid #cbd5e1;
            text-align: center;
            font-size: 9px;
          }

          .cycle-row {
            height: 26px;
            background: #eef6ff;
            color: #1e3a8a;
            font-weight: bold;
            border: 1px solid #bfdbfe;
          }

          .lane-row {
            height: 34px;
          }

          .cycle-label,
          .resource-label {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            font-weight: bold;
            text-align: center;
          }

          .cycle-label {
            width: 90px;
            color: #334155;
          }

          .resource-label {
            width: 120px;
          }

          .empty-cell {
            width: 24px;
            background: #ffffff;
            border: 1px solid #f1f5f9;
          }

          .idle-cell {
            width: 24px;
            background: #eef2f7;
            border: 1px solid #dbe3ee;
          }

          .work-cell {
            width: 24px;
            color: #ffffff;
            font-weight: bold;
            border-left: 1px solid rgba(255,255,255,0.55);
            border-right: 1px solid rgba(255,255,255,0.55);
          }

          .human-cell {
            background: #22c55e;
          }

          .machine-cell {
            background: #f97316;
          }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(processName)}</h2>
        <p>Timeline: ${formatNumber(cycleTime)} ${unit} | Jumlah cycle: ${cycleCount} | Total waktu: ${formatNumber(totalTime)} ${unit}</p>
        ${calculationTable}
        <table>
          <colgroup>
            <col style="width:120px;">
            ${timeColumns}
          </colgroup>
          <tr>
            <th style="width:120px;background:#0f172a;color:#ffffff;border:1px solid #0f172a;font-weight:bold;text-align:center;">Resource</th>
            ${headerCells}
          </tr>
          ${rows.join("")}
        </table>
      </body>
    </html>
  `;
}

function renderExcelCells(resource, cycleStart, cycleTime, cycleActivities, intervals, unit) {
  const cycleEnd = cycleStart + cycleTime;
  const bars = buildBars(resource, cycleTime, cycleActivities).map((bar) => {
    const absoluteStart = cycleStart + bar.start;
    const absoluteEnd = cycleStart + bar.end;
    const roundedStart = Math.max(0, Math.round(absoluteStart));
    const roundedEnd = Math.max(roundedStart + 1, Math.round(absoluteEnd));

    return {
      ...bar,
      absoluteStart: roundedStart,
      absoluteEnd: roundedEnd
    };
  });
  const segments = intervals.map((interval) => {
    const activeBar = bars.find((bar) => (
      rangesOverlap(interval.start, interval.end, bar.absoluteStart, bar.absoluteEnd)
    ));

    if (activeBar) {
      const color = activeBar.isWaiting
        ? "#dc2626"
        : resource.type === "human" ? "#22c55e" : "#f97316";

      return {
        key: `work:${activeBar.name}:${activeBar.absoluteStart}:${activeBar.absoluteEnd}`,
        type: "work",
        color,
        text: `${activeBar.name} (${formatNumber(activeBar.duration)} ${unit})`
      };
    }

    if (rangesOverlap(interval.start, interval.end, cycleStart, cycleEnd)) {
      return {
        key: "idle",
        type: "idle",
        color: "#eef2f7",
        text: ""
      };
    }

    return {
      key: "empty",
      type: "empty",
      color: "#ffffff",
      text: ""
    };
  });

  return mergeExcelSegments(segments).map((segment) => {
    const border = segment.type === "work" ? "#ffffff" : segment.type === "idle" ? "#dbe3ee" : "#f1f5f9";
    const textStyle = segment.type === "work"
      ? "color:#ffffff;font-weight:bold;text-align:left;padding-left:6px;overflow:hidden;white-space:nowrap;"
      : "";

    return `<td colspan="${segment.span}" style="background:${segment.color};border:1px solid ${border};${textStyle}">${escapeHtml(segment.text)}</td>`;
  }).join("");
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function mergeExcelSegments(segments) {
  return segments.reduce((merged, segment) => {
    const previous = merged[merged.length - 1];

    if (previous && previous.key === segment.key) {
      previous.span += 1;
      return merged;
    }

    merged.push({ ...segment, span: 1 });
    return merged;
  }, []);
}

function buildTimeIntervals(totalTime, step) {
  const intervals = [];

  for (let time = 0; time < totalTime; time += step) {
    const start = roundToStep(time);
    const end = Math.min(totalTime, roundToStep(time + step));
    intervals.push({ start, end, width: (end - start) * 24 });
  }

  return intervals;
}

function isWholeNumber(value) {
  return Math.abs(value - Math.round(value)) < 0.0001;
}

function roundToStep(value) {
  return Math.round(value * 10) / 10;
}

function getExcelStep(totalTime) {
  if (totalTime <= 120) return 5;
  if (totalTime <= 300) return 10;
  if (totalTime <= 900) return 30;
  return 60;
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderRows() {
  rowsEl.innerHTML = "";
  const activeCycle = getActiveCycle();

  activeCycle.activities.forEach((activity, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="row-actions">
          <button type="button" class="move-btn" data-direction="up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="move-btn" data-direction="down" data-index="${index}" ${index === activeCycle.activities.length - 1 ? "disabled" : ""}>↓</button>
        </div>
      </td>
      <td><input type="text" data-field="name" value="${escapeAttribute(activity.name)}"></td>
      <td>
        <select data-field="resourceType">
          <option value="human" ${activity.resourceType === "human" ? "selected" : ""}>Manusia</option>
          <option value="machine" ${activity.resourceType === "machine" ? "selected" : ""}>Mesin</option>
        </select>
      </td>
      <td>
        <select data-field="resourceName">
          ${renderResourceNameOptions(activity.resourceType, activity.resourceName)}
        </select>
      </td>
      <td><input type="number" min="0" step="0.1" data-field="start" value="${formatNumber((Number(activeCycle.start) || 0) + (Number(activity.start) || 0))}"></td>
      <td><input type="number" min="0" step="0.1" data-field="duration" value="${activity.duration}"></td>
      <td><button type="button" class="remove-btn" data-index="${index}">Hapus</button></td>
    `;
    rowsEl.appendChild(row);
  });

  rowsEl.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => {
      readRows();
      generateChart();
    });
  });

  rowsEl.querySelectorAll('[data-field="start"], [data-field="duration"]').forEach((input) => {
    input.addEventListener("input", () => {
      fillFollowingStartsFromRow(input);
      readRows();
      generateChart();
    });
  });

  rowsEl.querySelectorAll('[data-field="resourceType"]').forEach((select) => {
    select.addEventListener("change", () => {
      const row = select.closest("tr");
      const resourceNameSelect = row.querySelector('[data-field="resourceName"]');
      resourceNameSelect.innerHTML = renderResourceNameOptions(select.value);
      readRows();
      generateChart();
    });
  });

  rowsEl.querySelectorAll(".remove-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      getActiveCycle().activities.splice(index, 1);
      renderRows();
      generateChart();
    });
  });

  rowsEl.querySelectorAll(".move-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const direction = button.dataset.direction;
      moveActivity(index, direction);
    });
  });
}

function renderCycleEditor() {
  syncCyclesWithInputs();
  activeCycleSelect.innerHTML = state.cycles.map((cycle, index) => (
    `<option value="${index}" ${index === state.activeCycleIndex ? "selected" : ""}>Cycle ${index + 1}</option>`
  )).join("");
  activeCycleStartInput.value = formatNumber(getActiveCycle().start);
}

function moveActivity(index, direction) {
  readRows();

  const activities = getActiveCycle().activities;
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= activities.length) return;

  [activities[index], activities[targetIndex]] = [activities[targetIndex], activities[index]];
  recalculateActivityStarts(activities);
  renderRows();
  generateChart();
}

function recalculateActivityStarts(activities) {
  let nextStart = 0;

  activities.forEach((activity) => {
    activity.start = nextStart;
    nextStart += Number(activity.duration) || 0;
  });
}

function syncCyclesWithInputs() {
  const cycleTime = Math.max(1, Number(document.querySelector("#cycleTime").value) || 1);
  const cycleCount = Math.max(1, Number(document.querySelector("#cycleCount").value) || 1);
  const currentCycles = Array.isArray(state.cycles) ? state.cycles : [];
  const sourceActivities = currentCycles[state.activeCycleIndex]?.activities || [];
  const previousCycleTime = state.lastCycleTime;
  const syncedCycles = [];

  for (let index = 0; index < cycleCount; index += 1) {
    const existing = currentCycles[index];
    const existingStart = Math.max(0, Number(existing?.start) || 0);
    const wasAutoStart = index === 0 || (
      previousCycleTime &&
      existing &&
      existingStart === index * previousCycleTime
    );
    const sequentialStart = index === 0
      ? 0
      : (Math.max(0, Number(syncedCycles[index - 1]?.start) || 0) + cycleTime);

    syncedCycles.push({
      start: index === 0 ? 0 : existing && !wasAutoStart ? existingStart : sequentialStart,
      activities: existing && Array.isArray(existing.activities)
        ? existing.activities
        : cloneActivities(sourceActivities)
    });
  }

  state.cycles = syncedCycles;

  state.activeCycleIndex = Math.min(state.activeCycleIndex, state.cycles.length - 1);
  state.lastCycleTime = cycleTime;
}

function getSequentialCycleStart(index, cycleTime) {
  if (index <= 0) return 0;

  const previousCycle = state.cycles[index - 1];
  const previousStart = Math.max(0, Number(previousCycle?.start) || 0);
  return previousStart + cycleTime;
}

function getCycleStarts(cycleTime, cycleCount) {
  syncCyclesWithInputs();
  return state.cycles.slice(0, cycleCount).map((cycle, index) => (
    index === 0 ? 0 : Math.max(0, Number(cycle.start) || 0)
  ));
}

function getTotalTimeline(cycleTime, cycleStarts) {
  return cycleTime;
}

function fillFollowingStartsFromRow(input) {
  const rows = [...rowsEl.querySelectorAll("tr")];
  const currentRow = input.closest("tr");
  const startIndex = rows.indexOf(currentRow);

  if (startIndex < 0) return;

  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const previousStartInput = rows[index - 1].querySelector('[data-field="start"]');
    const previousDurationInput = rows[index - 1].querySelector('[data-field="duration"]');
    const currentStartInput = rows[index].querySelector('[data-field="start"]');

    if (!previousStartInput || !previousDurationInput || !currentStartInput) continue;

    const previousStart = Math.max(0, Number(previousStartInput.value) || 0);
    const previousDuration = Math.max(0, Number(previousDurationInput.value) || 0);
    currentStartInput.value = formatNumber(previousStart + previousDuration);
  }
}

function getNextStartFromActivities() {
  const activities = getActiveCycle().activities;
  const lastActivity = activities[activities.length - 1];

  if (!lastActivity) return 0;

  return formatNumber((Number(lastActivity.start) || 0) + (Number(lastActivity.duration) || 0));
}

function renderResourceNameOptions(type, selectedName = "") {
  const options = getResourceOptions(type);
  const fallbackName = type === "human" ? "Manusia 1" : "Mesin 1";

  if (!options.length) {
    return `<option value="${fallbackName}" selected>${fallbackName}</option>`;
  }

  const selectedValue = options.includes(selectedName) ? selectedName : options[0];

  return options.map((name) => (
    `<option value="${escapeAttribute(name)}" ${name === selectedValue ? "selected" : ""}>${escapeHtml(name)}</option>`
  )).join("");
}

function getResourceOptions(type) {
  const countInput = type === "human" ? "#humanCount" : "#machineCount";
  const prefix = type === "human" ? "Manusia" : "Mesin";
  const count = Math.max(0, Number(document.querySelector(countInput).value) || 0);

  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
}

function syncResourceNamesWithCounts() {
  state.cycles.forEach((cycle) => {
    cycle.activities = cycle.activities.map((activity) => {
      const options = getResourceOptions(activity.resourceType);

      return {
        ...activity,
        resourceName: options.includes(activity.resourceName) ? activity.resourceName : options[0]
      };
    });
  });
}

function readRows() {
  const activeCycle = getActiveCycle();
  const cycleStart = Math.max(0, Number(activeCycle.start) || 0);

  getActiveCycle().activities = [...rowsEl.querySelectorAll("tr")].map((row) => {
    const get = (field) => row.querySelector(`[data-field="${field}"]`)?.value ?? "";
    return {
      name: get("name").trim() || "Tanpa nama",
      resourceType: get("resourceType"),
      resourceName: get("resourceName").trim() || (get("resourceType") === "human" ? "Manusia 1" : "Mesin 1"),
      start: Math.max(0, (Number(get("start")) || 0) - cycleStart),
      duration: Math.max(0, Number(get("duration")) || 0)
    };
  });
}

function generateChart() {
  const processName = document.querySelector("#processName").value.trim() || "Man Machine Chart";
  const unit = document.querySelector("#timeUnit").value;
  const cycleTime = Math.max(1, Number(document.querySelector("#cycleTime").value) || 1);
  const cycleCount = Math.max(1, Number(document.querySelector("#cycleCount").value) || 1);
  const cycleStarts = getCycleStarts(cycleTime, cycleCount);
  const totalTime = getTotalTimeline(cycleTime, cycleStarts);
  const pxPerUnit = BASE_PX_PER_SECOND * state.zoom;
  const timelineWidth = totalTime * pxPerUnit;
  const tickStep = 1;

  document.documentElement.style.setProperty("--tick-width", `${tickStep * pxPerUnit}px`);
  document.documentElement.style.setProperty("--grid-width", `${pxPerUnit}px`);
  chartEl.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
  chartEl.style.minWidth = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
  chartTitleEl.textContent = processName;
  chartSubtitleEl.textContent = chartFormatSelect.value === "vertical"
    ? `Grafik batang vertikal per proses, timeline ${formatNumber(cycleTime)} ${unit}.`
    : `Timeline ${formatNumber(cycleTime)} ${unit}, start tiap cycle bisa diatur manual.`;
  totalTimeLabelEl.textContent = `${formatNumber(totalTime)} ${unit}`;
  chartHeaderEl.style.display = "block";

  renderHeader(totalTime, tickStep, pxPerUnit, unit, timelineWidth);
  renderCycles(cycleTime, cycleCount, cycleStarts, pxPerUnit, timelineWidth, unit);
  renderSummary(totalTime, cycleCount, unit);
  renderProcessChart(cycleTime, cycleCount, cycleStarts, unit);
  updateChartFormatVisibility();
  saveAutosave();
}

function renderHeader(totalTime, tickStep, pxPerUnit, unit, timelineWidth) {
  chartHeaderEl.innerHTML = "";
  chartHeaderEl.style.width = `${timelineWidth}px`;
  chartHeaderEl.style.minWidth = `${timelineWidth}px`;

  for (let time = 0; time <= totalTime; time += tickStep) {
    const tick = document.createElement("span");
    tick.className = "tick";
    tick.style.left = `${time * pxPerUnit}px`;
    tick.style.transform = time === 0
      ? "translateX(0)"
      : time >= totalTime
        ? "translateX(-100%)"
        : "translateX(-50%)";
    tick.textContent = formatNumber(time);
    chartHeaderEl.appendChild(tick);
  }
}

function renderCycles(cycleTime, cycleCount, cycleStarts, pxPerUnit, timelineWidth, unit) {
  chartEl.innerHTML = "";
  const resources = getResources();

  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    const cycleStart = cycleStarts[cycle - 1] || 0;
    const cycleActivities = state.cycles[cycle - 1]?.activities || [];
    const group = document.createElement("section");
    group.className = "cycle-group";
    group.innerHTML = `<div class="cycle-title">Cycle ${cycle}</div>`;
    group.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
    group.style.minWidth = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
    chartEl.appendChild(group);

    resources.forEach((resource) => {
      renderLane(group, resource, cycleStart, cycleTime, cycleActivities, pxPerUnit, timelineWidth, unit);
    });
  }
}

function renderLane(parent, resource, cycleStart, cycleTime, cycleActivities, pxPerUnit, timelineWidth, unit) {
  const lane = document.createElement("div");
  lane.className = "lane";
  lane.innerHTML = `<div class="lane-label ${resource.type}">${escapeHtml(resource.name)}</div><div class="timeline"><div class="idle-fill"></div></div>`;
  lane.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
  lane.style.minWidth = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
  parent.appendChild(lane);

  const timeline = lane.querySelector(".timeline");
  timeline.style.width = `${timelineWidth}px`;
  timeline.style.minWidth = `${timelineWidth}px`;
  const visibleEndTime = timelineWidth / pxPerUnit;
  const idleStart = Math.max(0, cycleStart);
  const idleEnd = Math.min(visibleEndTime, cycleStart + cycleTime);
  const idleFill = timeline.querySelector(".idle-fill");
  idleFill.style.left = `${idleStart * pxPerUnit}px`;
  idleFill.style.width = `${Math.max(0, idleEnd - idleStart) * pxPerUnit}px`;
  attachHoverCoordinate(timeline, pxPerUnit, unit);

  buildBars(resource, cycleTime, cycleActivities).forEach((bar) => {
    const absoluteStart = cycleStart + bar.start;
    const absoluteEnd = cycleStart + bar.end;
    const visibleStart = Math.max(0, absoluteStart);
    const visibleEnd = Math.min(visibleEndTime, absoluteEnd);

    if (visibleEnd <= visibleStart) {
      return;
    }

    const el = document.createElement("div");
    const durationLabel = `${formatNumber(bar.duration)} ${unit}`;
    el.className = `bar ${resource.type}${bar.isWaiting ? " waiting" : ""}`;
    el.style.left = `${visibleStart * pxPerUnit}px`;
    el.style.width = `${(visibleEnd - visibleStart) * pxPerUnit}px`;
    el.dataset.name = bar.name;
    el.dataset.durationLabel = durationLabel;
    el.innerHTML = `
      <div class="bar-content">
        <strong>${escapeHtml(bar.name)}</strong>
        <span>${durationLabel}</span>
      </div>
    `;
    timeline.appendChild(el);
  });
}

function attachHoverCoordinate(timeline, pxPerUnit, unit) {
  const tooltip = document.createElement("span");
  const guideLine = getChartHoverGuideLine();

  tooltip.className = "hover-tooltip";
  timeline.append(tooltip);

  timeline.addEventListener("mousemove", (event) => {
    const rect = timeline.getBoundingClientRect();
    const shellRect = chartShellEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const guideX = rect.left - shellRect.left + x;
    const coordinateLabel = `${formatNumber(x / pxPerUnit)} ${unit}`;
    const target = event.target instanceof Element ? event.target : null;
    const activeBar = target?.closest(".bar");

    guideLine.style.left = `${chartShellEl.scrollLeft + guideX}px`;
    guideLine.style.top = `${chartShellEl.scrollTop}px`;
    guideLine.style.height = `${chartShellEl.clientHeight}px`;
    tooltip.style.left = `${x}px`;
    tooltip.textContent = coordinateLabel;
    chartShellEl.classList.add("show-chart-hover-guide");
    timeline.classList.add("show-hover-guide");

    if (activeBar && timeline.contains(activeBar)) {
      tooltip.textContent = `${coordinateLabel} | ${activeBar.dataset.name || "Tanpa nama"} | Durasi ${activeBar.dataset.durationLabel || "-"}`;
    }
  });

  timeline.addEventListener("mouseleave", () => {
    chartShellEl.classList.remove("show-chart-hover-guide");
    timeline.classList.remove("show-hover-guide");
  });
}

function getChartHoverGuideLine() {
  let guideLine = chartShellEl.querySelector(".hover-guide-line");

  if (!guideLine) {
    guideLine = document.createElement("span");
    guideLine.className = "hover-guide-line";
    chartShellEl.appendChild(guideLine);
  }

  return guideLine;
}

function buildBars(resource, cycleTime, activities) {
  const source = activities.filter((activity) => (
    activity.resourceType === resource.type &&
    activity.resourceName === resource.name &&
    activity.duration > 0
  ));
  return source.map((activity) => {
    const start = activity.start;
    const end = Math.min(start + activity.duration, cycleTime);

    return {
      name: activity.name,
      start,
      end,
      duration: Math.max(0, end - start),
      isWaiting: isWaitingActivity(activity.name)
    };
  }).filter((bar) => bar.duration > 0);
}

function isWaitingActivity(name) {
  return /\b(?:tunggu|menunggu)\b/i.test(String(name));
}

function renderSummary(totalTime, cycleCount, unit) {
  const metrics = getResources().map((resource) => {
    const stats = getResourceTimeStats(resource, cycleTimeFromSummary(totalTime), cycleCount);
    const typeLabel = resource.type === "human" ? "Manusia" : "Mesin";

    return {
      label: `${resource.name} (${typeLabel})`,
      stats
    };
  });

  summaryCardsEl.innerHTML = metrics.map(({ label, stats }) => `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>Total ${formatNumber(stats.total)} ${unit}</strong>
      <div class="metric-details">
        <div><small>Proses</small><b>${formatNumber(stats.process)} ${unit}</b></div>
        <div><small>Menunggu</small><b>${formatNumber(stats.waiting)} ${unit}</b></div>
        <div><small>Total</small><b>${formatNumber(stats.total)} ${unit}</b></div>
        <div><small>Rata-rata</small><b>${formatNumber(stats.average)} ${unit}</b></div>
        <div><small>Minimal</small><b>${formatNumber(stats.min)} ${unit}</b></div>
        <div><small>Maksimal</small><b>${formatNumber(stats.max)} ${unit}</b></div>
      </div>
    </article>
  `).join("");
}

function getResourceTimeStats(resource, cycleTime, cycleCount) {
  const durations = [];
  let process = 0;
  let waiting = 0;

  state.cycles.slice(0, cycleCount).forEach((cycle) => {
    buildBars(resource, cycleTime, cycle.activities).forEach((bar) => {
      durations.push(bar.duration);

      if (bar.isWaiting) {
        waiting += bar.duration;
      } else {
        process += bar.duration;
      }
    });
  });

  const total = process + waiting;

  return {
    process,
    waiting,
    total,
    average: durations.length ? total / durations.length : 0,
    min: durations.length ? Math.min(...durations) : 0,
    max: durations.length ? Math.max(...durations) : 0
  };
}

function cycleTimeFromSummary(totalTime) {
  return Math.max(1, Number(totalTime) || Number(document.querySelector("#cycleTime").value) || 1);
}

function updateChartFormatVisibility() {
  const isVerticalFormat = chartFormatSelect.value === "vertical";

  processChartEl.classList.toggle("is-hidden", !isVerticalFormat);
  chartShellEl.classList.toggle("is-hidden", isVerticalFormat);
}

function renderProcessChart(cycleTime, cycleCount, cycleStarts, unit) {
  const resources = getResources();

  if (!resources.length) {
    processChartEl.innerHTML = "";
    return;
  }

  const tickStep = 1;
  const timeScale = getVerticalTimeScale(cycleTime, cycleCount, resources);
  const chartHeight = Math.max(420, timeScale * 32) * state.zoom;
  const columnWidth = 190 * state.zoom;
  const barWidth = 114 * state.zoom;
  const barLeft = (columnWidth - barWidth) / 2;
  const yTicks = [];

  for (let time = 0; time < timeScale; time += tickStep) {
    yTicks.push(time);
  }

  if (yTicks[yTicks.length - 1] !== timeScale) {
    yTicks.push(timeScale);
  }

  const yTickLabels = yTicks.map((time) => `
    <span class="process-y-tick" style="bottom:${(time / timeScale) * 100}%;">${formatNumber(time)} ${escapeHtml(unit)}</span>
  `).join("");
  const columns = [];
  const cycleLabels = [];
  const resourceLabels = [];

  for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex += 1) {
    const cycleActivities = state.cycles[cycleIndex]?.activities || [];
    const cycleWidth = resources.length * columnWidth;

    cycleLabels.push(`
      <div class="process-cycle-label" style="width:${cycleWidth}px;min-width:${cycleWidth}px;">Cycle ${cycleIndex + 1}</div>
    `);

    resources.forEach((resource) => {
      const bars = buildBars(resource, cycleTime, cycleActivities).sort((a, b) => a.start - b.start);
      const processBars = bars
        .map((bar) => {
          const bottom = (bar.start / timeScale) * 100;
          const height = Math.max(2, (bar.duration / timeScale) * 100);
          const typeClass = bar.isWaiting ? "waiting" : resource.type;
          const absoluteStart = bar.start + (cycleStarts[cycleIndex] || 0);
          const absoluteEnd = bar.end + (cycleStarts[cycleIndex] || 0);
          const timeRange = `${formatNumber(absoluteStart)}-${formatNumber(absoluteEnd)}`;
          const title = `${bar.name}: ${formatNumber(absoluteStart)}-${formatNumber(absoluteEnd)} ${unit}`;
          const durationLabel = `${formatNumber(bar.duration)} ${unit}`;
          const suggestion = [
            `Cycle ${cycleIndex + 1}`,
            resource.name,
            bar.name,
            `Mulai-Selesai: ${timeRange} ${unit}`,
            `Durasi: ${durationLabel}`
          ].join(" | ");

          return `
            <div class="process-bar ${typeClass}" style="bottom:${bottom}%;height:${height}%;left:${barLeft}px;width:${barWidth}px;right:auto;" title="${escapeAttribute(title)}" data-suggestion="${escapeAttribute(suggestion)}">
              <span class="process-duration-label">${escapeHtml(durationLabel)}</span>
              <strong>${escapeHtml(bar.name)}</strong>
              <span class="process-time-range">${timeRange} ${escapeHtml(unit)}</span>
            </div>
          `;
        }).join("");

      columns.push(`
        <div class="process-x-column" style="height:${chartHeight}px;width:${columnWidth}px;min-width:${columnWidth}px;">
          ${processBars || '<span class="process-empty">Tidak ada proses</span>'}
        </div>
      `);
      resourceLabels.push(`
        <div class="process-x-label" style="width:${columnWidth}px;min-width:${columnWidth}px;">${escapeHtml(resource.name)}</div>
      `);
    });
  }

  processChartEl.innerHTML = `
    <h3>Grafik Batang Vertikal Proses</h3>
    <p>Sumbu X berisi cycle dan Man/Machine, sumbu Y berisi waktu ${unit}. Proses yang berlangsung bersamaan akan sejajar.</p>
    <div class="process-y-title">Waktu (${escapeHtml(unit)})</div>
    <div class="process-axis-chart">
      <div class="process-y-axis" style="height:${chartHeight}px;">${yTickLabels}</div>
      <div class="process-plot" style="height:${chartHeight}px;">${columns.join("")}</div>
      <div class="process-cycle-axis">${cycleLabels.join("")}</div>
      <div class="process-x-axis">${resourceLabels.join("")}</div>
    </div>
  `;
}

function setupProcessChartSuggestion() {
  let tooltip = null;

  const getTooltip = () => {
    if (!tooltip || !tooltip.isConnected) {
      tooltip = document.createElement("div");
      tooltip.className = "process-suggestion-tooltip";
      processChartEl.appendChild(tooltip);
    }

    return tooltip;
  };

  processChartEl.addEventListener("mousemove", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".process-bar") : null;
    const activeTooltip = getTooltip();

    if (!target || !processChartEl.contains(target)) {
      activeTooltip.classList.remove("is-visible");
      return;
    }

    const rect = processChartEl.getBoundingClientRect();
    activeTooltip.textContent = target.dataset.suggestion || target.getAttribute("title") || "";
    activeTooltip.style.left = `${processChartEl.scrollLeft + event.clientX - rect.left + 14}px`;
    activeTooltip.style.top = `${processChartEl.scrollTop + event.clientY - rect.top + 14}px`;
    activeTooltip.classList.add("is-visible");
  });

  processChartEl.addEventListener("mouseleave", () => {
    getTooltip().classList.remove("is-visible");
  });
}

function getVerticalTimeScale(cycleTime, cycleCount, resources) {
  const maxProcessEnd = Math.max(1, ...state.cycles.slice(0, cycleCount).flatMap((cycle) => (
    resources.flatMap((resource) => buildBars(resource, cycleTime, cycle.activities).map((bar) => bar.end))
  )));

  return Math.max(1, Math.ceil(maxProcessEnd));
}

function getResources() {
  const resourceMap = new Map();
  const humanCount = Math.max(0, Number(document.querySelector("#humanCount").value) || 0);
  const machineCount = Math.max(0, Number(document.querySelector("#machineCount").value) || 0);

  for (let index = 1; index <= humanCount; index += 1) {
    resourceMap.set(`human::Manusia ${index}`, { type: "human", name: `Manusia ${index}`, index });
  }

  for (let index = 1; index <= machineCount; index += 1) {
    resourceMap.set(`machine::Mesin ${index}`, { type: "machine", name: `Mesin ${index}`, index });
  }

  state.cycles.forEach((cycle) => {
    cycle.activities.forEach((activity) => {
      const type = activity.resourceType || "human";
      const name = activity.resourceName || (type === "human" ? "Manusia 1" : "Mesin 1");
      const key = `${type}::${name}`;

      if (!resourceMap.has(key)) {
        resourceMap.set(key, { type, name, index: getResourceNumber(name) });
      }
    });
  });

  return [...resourceMap.values()].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.type !== b.type) return a.type === "human" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function getResourceNumber(name) {
  const match = name.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function sumDurations(resource) {
  return state.cycles.reduce((grandTotal, cycle) => (
    grandTotal + cycle.activities
      .filter((activity) => activity.resourceType === resource.type && activity.resourceName === resource.name)
      .reduce((total, activity) => total + activity.duration, 0)
  ), 0);
}

function getTickStep(totalTime) {
  if (totalTime <= 60) return 5;
  if (totalTime <= 180) return 10;
  if (totalTime <= 600) return 30;
  return 60;
}

function percent(value, total) {
  if (!total) return 0;
  return formatNumber((value / total) * 100);
}

function formatNumber(value) {
  return Number(value.toFixed(1)).toString();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(String(value));
}

const restoreAutosave = shouldRestoreAutosave();

clearLegacyAutosave();
clearReloadMarker();

if (!restoreAutosave) {
  clearSessionAutosave();
}

if (!restoreAutosave || !loadAutosave()) {
  renderCycleEditor();
  renderRows();
  generateChart();
}

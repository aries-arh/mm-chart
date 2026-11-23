(() => {
  "use strict";

  const STORAGE_KEY = "easymmc_state_v1";
  const PROJECTS_KEY = "easymmc_projects_v1";
  const BASE_PX_PER_UNIT = 24;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;
  const RESOURCE_LABEL_WIDTH = 132;

  const CATEGORY_META = {
    "self": { label: "Kerja Mandiri", short: "Mandiri", color: "#16a34a", defaultResourceType: "human" },
    "machine-work": { label: "Kerja di Mesin", short: "Di Mesin", color: "#2563eb", defaultResourceType: "human" },
    "auto": { label: "Mesin Jalan Otomatis", short: "Otomatis", color: "#d97706", defaultResourceType: "machine" },
    "waiting": { label: "Menunggu / Menganggur", short: "Menunggu", color: "#64748b", defaultResourceType: "human" }
  };

  const TEMPLATES = {
    "1op-1mc": {
      processName: "Proses Bubut Part A (1 Operator · 1 Mesin)",
      timeUnit: "detik",
      cycleTime: 60,
      cycleCount: 1,
      humanCount: 1,
      machineCount: 1,
      activities: [
        { name: "Ambil & siapkan bahan", category: "self", resourceType: "human", resourceName: "Operator 1", start: 0, duration: 6 },
        { name: "Pasang part & tekan Start", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 6, duration: 8 },
        { name: "Mesin bubut otomatis", category: "auto", resourceType: "machine", resourceName: "Mesin 1", start: 14, duration: 30 },
        { name: "Lepas part dari mesin", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 44, duration: 8 },
        { name: "Cek visual & taruh ke rak", category: "self", resourceType: "human", resourceName: "Operator 1", start: 52, duration: 8 }
      ]
    },
    "1op-2mc": {
      processName: "Operasi 2 Mesin CNC (1 Operator · 2 Mesin)",
      timeUnit: "detik",
      cycleTime: 60,
      cycleCount: 1,
      humanCount: 1,
      machineCount: 2,
      activities: [
        { name: "Pasang & Start Mesin 1", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 0, duration: 10 },
        { name: "Mesin 1 proses otomatis", category: "auto", resourceType: "machine", resourceName: "Mesin 1", start: 10, duration: 36 },
        { name: "Pasang & Start Mesin 2", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 12, duration: 10 },
        { name: "Mesin 2 proses otomatis", category: "auto", resourceType: "machine", resourceName: "Mesin 2", start: 22, duration: 32 },
        { name: "Inspeksi hasil batch", category: "self", resourceType: "human", resourceName: "Operator 1", start: 24, duration: 12 },
        { name: "Lepas part Mesin 1", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 46, duration: 8 },
        { name: "Lepas part Mesin 2", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 54, duration: 6 }
      ]
    },
    "2op-2mc": {
      processName: "Loading - Machining - Unloading (2 Operator · 2 Mesin)",
      timeUnit: "detik",
      cycleTime: 60,
      cycleCount: 2,
      humanCount: 2,
      machineCount: 2,
      activities: [
        { name: "Ambil material", category: "self", resourceType: "human", resourceName: "Operator 1", start: 0, duration: 8 },
        { name: "Loading Mesin 1", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 8, duration: 10 },
        { name: "Siapkan fixture", category: "self", resourceType: "human", resourceName: "Operator 2", start: 12, duration: 14 },
        { name: "Proses otomatis 1", category: "auto", resourceType: "machine", resourceName: "Mesin 1", start: 18, duration: 32 },
        { name: "Proses otomatis 2", category: "auto", resourceType: "machine", resourceName: "Mesin 2", start: 26, duration: 24 },
        { name: "Inspeksi visual", category: "self", resourceType: "human", resourceName: "Operator 2", start: 42, duration: 8 },
        { name: "Unloading Mesin 1", category: "machine-work", resourceType: "human", resourceName: "Operator 1", start: 50, duration: 10 }
      ]
    },
    "blank": {
      processName: "Proses Baru",
      timeUnit: "detik",
      cycleTime: 60,
      cycleCount: 1,
      humanCount: 1,
      machineCount: 1,
      activities: []
    }
  };

  const state = {
    processName: "Proses Bubut Part A (1 Operator · 1 Mesin)",
    timeUnit: "detik",
    cycleTime: 60,
    cycleCount: 1,
    humanCount: 1,
    machineCount: 1,
    uiMode: "simple",
    chartFormat: "vertical",
    activeView: "workspace",
    activeCycleIndex: 0,
    zoom: 1,
    lastCycleTime: 60,
    cycles: [{ start: 0, activities: [] }],
    beforeSnapshot: null,
    afterSnapshot: null
  };

  const swState = {
    running: false,
    startedAt: 0,
    elapsedMs: 0,
    lastLapMs: 0,
    timerId: null,
    logs: []
  };

  const el = {
    projectHeading: document.querySelector("#projectHeading"),
    projectMeta: document.querySelector("#projectMeta"),
    kpiCycleTime: document.querySelector("#kpiCycleTime"),
    kpiOutputRate: document.querySelector("#kpiOutputRate"),
    kpiOperatorUtil: document.querySelector("#kpiOperatorUtil"),
    kpiOperatorDetail: document.querySelector("#kpiOperatorDetail"),
    kpiMachineUtil: document.querySelector("#kpiMachineUtil"),
    kpiMachineDetail: document.querySelector("#kpiMachineDetail"),

    simpleModeBtn: document.querySelector("#simpleModeBtn"),
    advancedModeBtn: document.querySelector("#advancedModeBtn"),
    advancedControlsBlock: document.querySelector("#advancedControlsBlock"),
    advancedTableWrap: document.querySelector("#advancedTableWrap"),

    processName: document.querySelector("#processName"),
    humanCount: document.querySelector("#humanCount"),
    machineCount: document.querySelector("#machineCount"),
    cycleTime: document.querySelector("#cycleTime"),
    timeUnit: document.querySelector("#timeUnit"),
    cycleCount: document.querySelector("#cycleCount"),
    activeCycleSelect: document.querySelector("#activeCycleSelect"),
    activeCycleStart: document.querySelector("#activeCycleStart"),
    copyPreviousCycleBtn: document.querySelector("#copyPreviousCycleBtn"),

    quickActor: document.querySelector("#quickActor"),
    quickCategory: document.querySelector("#quickCategory"),
    quickName: document.querySelector("#quickName"),
    quickStartMode: document.querySelector("#quickStartMode"),
    quickManualStartWrap: document.querySelector("#quickManualStartWrap"),
    quickManualStart: document.querySelector("#quickManualStart"),
    quickDuration: document.querySelector("#quickDuration"),
    quickAddBtn: document.querySelector("#quickAddBtn"),

    activityCountLabel: document.querySelector("#activityCountLabel"),
    activityListContainer: document.querySelector("#activityListContainer"),
    activityRows: document.querySelector("#activityRows"),

    verticalChartContainer: document.querySelector("#verticalChartContainer"),
    horizontalChartContainer: document.querySelector("#horizontalChartContainer"),
    numericTableContainer: document.querySelector("#numericTableContainer"),
    chartHeader: document.querySelector("#chartHeader"),
    chart: document.querySelector("#chart"),
    chartInteractionHint: document.querySelector("#chartInteractionHint"),
    summaryCards: document.querySelector("#summaryCards"),
    kaizenInsights: document.querySelector("#kaizenInsights"),
    zoomResetBtn: document.querySelector("#zoomResetBtn"),

    csvFileInput: document.querySelector("#csvFileInput"),
    simulationFileInput: document.querySelector("#simulationFileInput"),

    compareDeltaStrip: document.querySelector("#compareDeltaStrip"),
    beforeSummaryContent: document.querySelector("#beforeSummaryContent"),
    afterSummaryContent: document.querySelector("#afterSummaryContent"),

    stopwatchDisplay: document.querySelector("#stopwatchDisplay"),
    swStartPauseBtn: document.querySelector("#swStartPauseBtn"),
    swLapBtn: document.querySelector("#swLapBtn"),
    swResetBtn: document.querySelector("#swResetBtn"),
    swActor: document.querySelector("#swActor"),
    swCategory: document.querySelector("#swCategory"),
    swActivityName: document.querySelector("#swActivityName"),
    swCount: document.querySelector("#swCount"),
    swLogList: document.querySelector("#swLogList"),
    swSendToChartBtn: document.querySelector("#swSendToChartBtn"),

    savedProjectsList: document.querySelector("#savedProjectsList"),
    toastContainer: document.querySelector("#toastContainer"),
    appDialog: document.querySelector("#appDialog"),
    dialogTitle: document.querySelector("#dialogTitle"),
    dialogMessage: document.querySelector("#dialogMessage"),
    dialogCancelBtn: document.querySelector("#dialogCancelBtn"),
    dialogConfirmBtn: document.querySelector("#dialogConfirmBtn")
  };

  let dialogConfirmAction = null;

  function init() {
    bindEvents();
    const restored = loadStateFromStorage();
    if (!restored) {
      applyTemplate("1op-1mc", { silent: true });
    } else {
      syncInputsFromState();
      renderAll();
    }
  }

  function bindEvents() {
    document.querySelectorAll(".nav-link").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    document.querySelector("#brandLink").addEventListener("click", (e) => {
      e.preventDefault();
      switchView("workspace");
    });

    el.simpleModeBtn.addEventListener("click", () => setUiMode("simple"));
    el.advancedModeBtn.addEventListener("click", () => setUiMode("advanced"));

    document.querySelectorAll(".tpl-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.template;
        if (key === "blank" && getActiveCycle().activities.length > 0) {
          openConfirmDialog({
            title: "Mulai dari Kosong?",
            message: "Daftar aktivitas saat ini akan dikosongkan. Pastikan Anda sudah menyimpan jika masih dibutuhkan.",
            confirmText: "Kosongkan",
            onConfirm: () => applyTemplate("blank")
          });
          return;
        }
        applyTemplate(key);
      });
    });

    [el.processName, el.timeUnit, el.cycleTime, el.cycleCount, el.humanCount, el.machineCount].forEach((input) => {
      input.addEventListener("input", () => {
        state.processName = el.processName.value;
        state.timeUnit = el.timeUnit.value;
        state.cycleTime = Math.max(1, Number(el.cycleTime.value) || 1);
        state.cycleCount = Math.min(20, Math.max(1, Math.round(Number(el.cycleCount.value) || 1)));
        state.humanCount = Math.min(20, Math.max(0, Math.round(Number(el.humanCount.value) || 0)));
        state.machineCount = Math.min(20, Math.max(0, Math.round(Number(el.machineCount.value) || 0)));
        syncCyclesWithInputs();
        syncResourceNamesWithCounts();
        renderAll();
      });
    });

    el.activeCycleSelect.addEventListener("change", () => {
      state.activeCycleIndex = Number(el.activeCycleSelect.value) || 0;
      renderAll();
    });

    el.activeCycleStart.addEventListener("input", () => {
      const nextStart = Math.max(0, Number(el.activeCycleStart.value) || 0);
      getActiveCycle().start = nextStart;
      renderAll();
    });

    el.copyPreviousCycleBtn.addEventListener("click", copyPreviousCycle);

    el.quickCategory.addEventListener("change", () => {
      const cat = el.quickCategory.value;
      const preferredType = CATEGORY_META[cat]?.defaultResourceType || "human";
      const currentActor = parseActorValue(el.quickActor.value);
      if (cat === "auto" && currentActor.resourceType !== "machine") {
        const machines = getResourceOptions("machine");
        if (machines.length) el.quickActor.value = `machine::${machines[0]}`;
      } else if ((cat === "self" || cat === "machine-work") && currentActor.resourceType !== "human") {
        const humans = getResourceOptions("human");
        if (humans.length) el.quickActor.value = `human::${humans[0]}`;
      }
      if (cat === "waiting" && !el.quickName.value.trim()) {
        el.quickName.placeholder = "Contoh: Menunggu mesin selesai";
      } else if (preferredType === "machine" && !el.quickName.value.trim()) {
        el.quickName.placeholder = "Contoh: Mesin proses otomatis";
      } else {
        el.quickName.placeholder = "Contoh: Pasang part ke jig";
      }
    });

    el.quickStartMode.addEventListener("change", () => {
      el.quickManualStartWrap.classList.toggle("is-hidden", el.quickStartMode.value !== "manual");
    });
    el.quickManualStartWrap.classList.add("is-hidden");

    document.querySelector("#quickDurMinus5").addEventListener("click", () => adjustQuickDuration(-5));
    document.querySelector("#quickDurMinus1").addEventListener("click", () => adjustQuickDuration(-1));
    document.querySelector("#quickDurPlus1").addEventListener("click", () => adjustQuickDuration(1));
    document.querySelector("#quickDurPlus5").addEventListener("click", () => adjustQuickDuration(5));

    el.quickAddBtn.addEventListener("click", handleQuickAdd);
    el.quickName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuickAdd();
      }
    });

    document.querySelectorAll("[data-format]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.chartFormat = btn.dataset.format;
        renderAll();
      });
    });

    document.querySelector("#zoomOutBtn").addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
    document.querySelector("#zoomResetBtn").addEventListener("click", () => setZoom(1));
    document.querySelector("#zoomInBtn").addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));

    document.querySelector("#exportPngBtn").addEventListener("click", exportPng);
    document.querySelector("#exportCsvBtn").addEventListener("click", exportCsv);
    document.querySelector("#exportExcelBtn").addEventListener("click", exportExcel);
    document.querySelector("#exportPdfBtn").addEventListener("click", () => window.print());

    document.querySelector("#importCsvBtn").addEventListener("click", () => el.csvFileInput.click());
    el.csvFileInput.addEventListener("change", handleImportCsv);

    document.querySelector("#saveSimulationBtn").addEventListener("click", downloadJsonBackup);
    document.querySelector("#loadSimulationBtn").addEventListener("click", () => el.simulationFileInput.click());
    el.simulationFileInput.addEventListener("change", handleImportJson);

    document.querySelector("#newCalculationBtn").addEventListener("click", () => {
      openConfirmDialog({
        title: "Reset Proyek?",
        message: "Semua langkah kerja pada simulasi aktif akan dihapus.",
        confirmText: "Ya, Reset",
        onConfirm: () => applyTemplate("blank")
      });
    });

    document.querySelector("#quickSaveProjectBtn").addEventListener("click", () => saveNamedProject(true));
    document.querySelector("#saveNamedProjectBtn").addEventListener("click", () => saveNamedProject(false));

    document.querySelector("#snapshotBeforeBtn").addEventListener("click", () => {
      captureSnapshot("before");
      showToast("Kondisi saat ini disimpan sebagai Kondisi Awal (Before).");
    });

    document.querySelector("#captureBeforeBtn").addEventListener("click", () => {
      captureSnapshot("before");
      renderCompareView();
      showToast("Grafik aktif disalin ke Before.");
    });

    document.querySelector("#captureAfterBtn").addEventListener("click", () => {
      captureSnapshot("after");
      renderCompareView();
      showToast("Grafik aktif disalin ke After.");
    });

    document.querySelector("#loadBeforeToWorkspaceBtn").addEventListener("click", () => {
      if (!state.beforeSnapshot) return;
      applySimulationData(state.beforeSnapshot);
      switchView("workspace");
      showToast("Kondisi Before dibuka di editor.");
    });

    document.querySelector("#loadAfterToWorkspaceBtn").addEventListener("click", () => {
      if (!state.afterSnapshot) return;
      applySimulationData(state.afterSnapshot);
      switchView("workspace");
      showToast("Kondisi After dibuka di editor.");
    });

    el.swStartPauseBtn.addEventListener("click", toggleStopwatch);
    el.swLapBtn.addEventListener("click", recordStopwatchLap);
    el.swResetBtn.addEventListener("click", resetStopwatch);
    el.swSendToChartBtn.addEventListener("click", sendStopwatchToChart);

    setupDragScroll(el.horizontalChartContainer);
    setupWheelZoom(el.horizontalChartContainer);
    setupWheelZoom(el.verticalChartContainer);

    el.dialogCancelBtn.addEventListener("click", () => {
      dialogConfirmAction = null;
      el.appDialog.close();
    });
    el.dialogConfirmBtn.addEventListener("click", () => {
      const fn = dialogConfirmAction;
      dialogConfirmAction = null;
      el.appDialog.close();
      if (typeof fn === "function") fn();
    });

    document.querySelectorAll("[data-help]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openInfoDialog("Panduan Singkat", btn.dataset.help);
      });
    });

    document.querySelectorAll("[data-guide-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchView(btn.dataset.guideGo);
      });
    });
  }

  function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll(".nav-link").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === viewName);
    });
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("is-active", sec.id === `view-${viewName}`);
    });

    if (viewName === "compare") {
      if (!state.afterSnapshot) {
        state.afterSnapshot = getSerializableState();
      }
      renderCompareView();
    } else if (viewName === "projects") {
      renderSavedProjects();
    } else if (viewName === "stopwatch") {
      renderActorDropdowns();
    }
  }

  function setUiMode(mode) {
    state.uiMode = mode === "advanced" ? "advanced" : "simple";
    if (state.uiMode === "simple" && state.activeCycleIndex > 0) {
      state.activeCycleIndex = 0;
    }
    renderModeVisibility();
    renderAll();
  }

  function renderModeVisibility() {
    const isAdv = state.uiMode === "advanced";
    el.simpleModeBtn.classList.toggle("is-active", !isAdv);
    el.advancedModeBtn.classList.toggle("is-active", isAdv);
    el.advancedControlsBlock.classList.toggle("is-hidden", !isAdv);
    el.advancedTableWrap.classList.toggle("is-hidden", !isAdv);
    el.activityListContainer.classList.toggle("is-hidden", isAdv);

    document.querySelectorAll(".is-advanced-only").forEach((node) => {
      node.classList.toggle("is-hidden", !isAdv);
    });
  }

  function applyTemplate(templateKey, options = {}) {
    const tpl = TEMPLATES[templateKey] || TEMPLATES["1op-1mc"];
    state.processName = tpl.processName;
    state.timeUnit = tpl.timeUnit;
    state.cycleTime = tpl.cycleTime;
    state.cycleCount = tpl.cycleCount;
    state.humanCount = tpl.humanCount;
    state.machineCount = tpl.machineCount;
    state.activeCycleIndex = 0;
    state.lastCycleTime = tpl.cycleTime;
    state.cycles = Array.from({ length: tpl.cycleCount }, (_, i) => ({
      start: i * tpl.cycleTime,
      activities: tpl.activities.map((a) => ({ ...a }))
    }));

    syncInputsFromState();
    renderAll();

    if (!options.silent) {
      showToast(`Template "${tpl.processName}" dimuat.`);
    }
  }

  function syncInputsFromState() {
    el.processName.value = state.processName;
    el.timeUnit.value = state.timeUnit;
    el.cycleTime.value = state.cycleTime;
    el.cycleCount.value = state.cycleCount;
    el.humanCount.value = state.humanCount;
    el.machineCount.value = state.machineCount;
  }

  function getActiveCycle() {
    syncCyclesWithInputs();
    return state.cycles[state.activeCycleIndex] || state.cycles[0];
  }

  function syncCyclesWithInputs() {
    const cycleTime = Math.max(1, Number(state.cycleTime) || 1);
    const cycleCount = Math.max(1, Number(state.cycleCount) || 1);
    const prevCycleTime = state.lastCycleTime || cycleTime;
    const currentCycles = Array.isArray(state.cycles) ? state.cycles : [];
    const sourceActivities = currentCycles[state.activeCycleIndex]?.activities || currentCycles[0]?.activities || [];
    const synced = [];

    for (let i = 0; i < cycleCount; i += 1) {
      const existing = currentCycles[i];
      const existingStart = Math.max(0, Number(existing?.start) || 0);
      const wasAutoStart = i === 0 || (existing && Math.abs(existingStart - i * prevCycleTime) < 0.01);
      const sequentialStart = i === 0 ? 0 : (Math.max(0, Number(synced[i - 1]?.start) || 0) + cycleTime);

      synced.push({
        start: i === 0 ? 0 : (existing && !wasAutoStart ? existingStart : sequentialStart),
        activities: existing && Array.isArray(existing.activities)
          ? existing.activities.map(normalizeActivity)
          : sourceActivities.map((a) => ({ ...normalizeActivity(a) }))
      });
    }

    state.cycles = synced;
    state.activeCycleIndex = Math.min(state.activeCycleIndex, state.cycles.length - 1);
    state.lastCycleTime = cycleTime;
  }

  function normalizeActivity(act) {
    const resourceType = act.resourceType === "machine" ? "machine" : "human";
    let category = act.category;
    if (!CATEGORY_META[category]) {
      if (isWaitingName(act.name)) {
        category = "waiting";
      } else if (resourceType === "machine") {
        category = "auto";
      } else if (/mesin|loading|unloading|pasang|lepas|start|jig/i.test(String(act.name))) {
        category = "machine-work";
      } else {
        category = "self";
      }
    }
    const defaultName = resourceType === "human" ? "Operator 1" : "Mesin 1";
    const resourceName = String(act.resourceName || defaultName).replace(/^Manusia\b/i, "Operator");

    return {
      name: String(act.name || "Tanpa nama").trim() || "Tanpa nama",
      category,
      resourceType,
      resourceName,
      start: Math.max(0, Number(act.start) || 0),
      duration: Math.max(0.5, Number(act.duration) || 1)
    };
  }

  function isWaitingName(name) {
    return /\b(?:tunggu|menunggu|idle|kosong)\b/i.test(String(name || ""));
  }

  function getResourceOptions(type) {
    const count = type === "human" ? Math.max(0, Number(state.humanCount) || 0) : Math.max(0, Number(state.machineCount) || 0);
    const prefix = type === "human" ? "Operator" : "Mesin";
    return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
  }

  function syncResourceNamesWithCounts() {
    const humans = getResourceOptions("human");
    const machines = getResourceOptions("machine");

    state.cycles.forEach((cycle) => {
      cycle.activities = cycle.activities.map((act) => {
        const options = act.resourceType === "machine" ? machines : humans;
        if (!options.length) return act;
        if (!options.includes(act.resourceName)) {
          return { ...act, resourceName: options[0] };
        }
        return act;
      });
    });
  }

  function getResources() {
    const map = new Map();
    getResourceOptions("human").forEach((name, idx) => {
      map.set(`human::${name}`, { type: "human", name, index: idx + 1 });
    });
    getResourceOptions("machine").forEach((name, idx) => {
      map.set(`machine::${name}`, { type: "machine", name, index: idx + 1 });
    });

    getActiveCycle().activities.forEach((act) => {
      const key = `${act.resourceType}::${act.resourceName}`;
      if (!map.has(key)) {
        const m = act.resourceName.match(/\d+/);
        map.set(key, {
          type: act.resourceType,
          name: act.resourceName,
          index: m ? Number(m[0]) : 999
        });
      }
    });

    return [...map.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "human" ? -1 : 1;
      return a.index - b.index || a.name.localeCompare(b.name);
    });
  }

  function parseActorValue(val) {
    const [resourceType, ...rest] = String(val || "human::Operator 1").split("::");
    return {
      resourceType: resourceType === "machine" ? "machine" : "human",
      resourceName: rest.join("::") || (resourceType === "machine" ? "Mesin 1" : "Operator 1")
    };
  }

  function adjustQuickDuration(delta) {
    const current = Number(el.quickDuration.value) || 0;
    const next = Math.max(0.5, roundToHalf(current + delta));
    el.quickDuration.value = formatNumber(next);
  }

  function handleQuickAdd() {
    const { resourceType, resourceName } = parseActorValue(el.quickActor.value);
    const category = el.quickCategory.value;
    const defaultLabel = CATEGORY_META[category]?.label || "Aktivitas baru";
    const name = el.quickName.value.trim() || defaultLabel;
    const duration = Math.max(0.5, Number(el.quickDuration.value) || 5);
    const activities = getActiveCycle().activities;

    let start = 0;
    const mode = el.quickStartMode.value;
    if (mode === "manual") {
      start = Math.max(0, Number(el.quickManualStart.value) || 0);
    } else if (mode === "zero") {
      start = 0;
    } else if (mode === "after-all") {
      start = activities.reduce((max, a) => Math.max(max, a.start + a.duration), 0);
    } else {
      const actorActs = activities.filter((a) => a.resourceType === resourceType && a.resourceName === resourceName);
      start = actorActs.reduce((max, a) => Math.max(max, a.start + a.duration), 0);
    }

    activities.push({
      name,
      category,
      resourceType,
      resourceName,
      start: roundToHalf(start),
      duration: roundToHalf(duration)
    });

    el.quickName.value = "";
    renderAll();
    showToast(`Ditambahkan: ${name} (${formatNumber(duration)} ${state.timeUnit})`);
  }

  function copyPreviousCycle() {
    if (state.activeCycleIndex <= 0) {
      showToast("Siklus 1 tidak memiliki siklus sebelumnya.", true);
      return;
    }
    const prev = state.cycles[state.activeCycleIndex - 1];
    const active = getActiveCycle();
    active.activities = prev.activities.map((a) => ({ ...a }));
    renderAll();
    showToast(`Aktivitas dari Siklus ${state.activeCycleIndex} disalin.`);
  }

  function computeMetrics(dataObj = state) {
    const cycleTime = Math.max(1, Number(dataObj.cycleTime) || 1);
    const cycleCount = Math.max(1, Number(dataObj.cycleCount) || 1);
    const unit = dataObj.timeUnit || "detik";
    const cycle = dataObj.cycles?.[0] || { activities: [] };
    const activities = (cycle.activities || []).map(normalizeActivity);

    const resources = [];
    const seen = new Set();
    const hCount = Math.max(0, Number(dataObj.humanCount) || 0);
    const mCount = Math.max(0, Number(dataObj.machineCount) || 0);
    for (let i = 1; i <= hCount; i += 1) {
      const name = `Operator ${i}`;
      seen.add(`human::${name}`);
      resources.push({ type: "human", name });
    }
    for (let i = 1; i <= mCount; i += 1) {
      const name = `Mesin ${i}`;
      seen.add(`machine::${name}`);
      resources.push({ type: "machine", name });
    }
    activities.forEach((a) => {
      const key = `${a.resourceType}::${a.resourceName}`;
      if (!seen.has(key)) {
        seen.add(key);
        resources.push({ type: a.resourceType, name: a.resourceName });
      }
    });

    const resourceStats = resources.map((res) => {
      const resActs = activities.filter((a) => a.resourceType === res.type && a.resourceName === res.name);
      const activeIntervals = [];
      let explicitWait = 0;
      let selfTime = 0;
      let machineWorkTime = 0;
      let autoTime = 0;

      resActs.forEach((a) => {
        const s = Math.max(0, Math.min(cycleTime, a.start));
        const e = Math.max(s, Math.min(cycleTime, a.start + a.duration));
        const dur = e - s;
        if (dur <= 0) return;

        if (a.category === "waiting") {
          explicitWait += dur;
        } else {
          activeIntervals.push([s, e]);
          if (a.category === "self") selfTime += dur;
          else if (a.category === "machine-work") machineWorkTime += dur;
          else if (a.category === "auto") autoTime += dur;
        }
      });

      const merged = mergeIntervals(activeIntervals);
      const workTime = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
      const idleTime = Math.max(0, cycleTime - workTime);
      const utilization = Math.min(100, (workTime / cycleTime) * 100);

      const gaps = [];
      let cursor = 0;
      merged.forEach(([s, e]) => {
        if (s > cursor) gaps.push({ start: cursor, end: s, duration: s - cursor });
        cursor = Math.max(cursor, e);
      });
      if (cursor < cycleTime) {
        gaps.push({ start: cursor, end: cycleTime, duration: cycleTime - cursor });
      }

      return {
        ...res,
        workTime,
        idleTime,
        explicitWait,
        selfTime,
        machineWorkTime,
        autoTime,
        utilization,
        gaps,
        mergedIntervals: merged
      };
    });

    const humanStats = resourceStats.filter((r) => r.type === "human");
    const machineStats = resourceStats.filter((r) => r.type === "machine");

    const totalHumanWork = humanStats.reduce((s, r) => s + r.workTime, 0);
    const totalHumanCap = humanStats.length * cycleTime;
    const humanUtil = totalHumanCap > 0 ? (totalHumanWork / totalHumanCap) * 100 : 0;

    const totalMachineWork = machineStats.reduce((s, r) => s + r.workTime, 0);
    const totalMachineCap = machineStats.length * cycleTime;
    const machineUtil = totalMachineCap > 0 ? (totalMachineWork / totalMachineCap) * 100 : 0;

    const unitsPerHour = unit === "menit" ? (60 / cycleTime) : (3600 / cycleTime);

    return {
      cycleTime,
      cycleCount,
      unit,
      resourceStats,
      humanStats,
      machineStats,
      totalHumanWork,
      totalHumanIdle: Math.max(0, totalHumanCap - totalHumanWork),
      humanUtil,
      totalMachineWork,
      totalMachineIdle: Math.max(0, totalMachineCap - totalMachineWork),
      machineUtil,
      unitsPerHour
    };
  }

  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const out = [sorted[0].slice()];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = out[out.length - 1];
      const curr = sorted[i];
      if (curr[0] <= prev[1]) {
        prev[1] = Math.max(prev[1], curr[1]);
      } else {
        out.push(curr.slice());
      }
    }
    return out;
  }

  function renderAll() {
    renderModeVisibility();
    renderActorDropdowns();
    renderCycleEditor();
    renderHeaderKpis();
    renderActivityList();
    renderAdvancedTable();
    renderChart();
    renderResourceSummary();
    renderKaizenInsights();
    saveStateToStorage();
  }

  function renderActorDropdowns() {
    const resources = getResources();
    const optionsHtml = resources.map((r) => (
      `<option value="${escapeAttr(`${r.type}::${r.name}`)}">${escapeHtml(r.name)}</option>`
    )).join("");

    const prevQuick = el.quickActor.value;
    el.quickActor.innerHTML = optionsHtml || `<option value="human::Operator 1">Operator 1</option>`;
    if ([...el.quickActor.options].some((o) => o.value === prevQuick)) {
      el.quickActor.value = prevQuick;
    }

    const prevSw = el.swActor.value;
    el.swActor.innerHTML = optionsHtml || `<option value="human::Operator 1">Operator 1</option>`;
    if ([...el.swActor.options].some((o) => o.value === prevSw)) {
      el.swActor.value = prevSw;
    }

    document.querySelectorAll(".unit-text").forEach((span) => {
      span.textContent = state.timeUnit;
    });
  }

  function renderCycleEditor() {
    syncCyclesWithInputs();
    el.activeCycleSelect.innerHTML = state.cycles.map((_, idx) => (
      `<option value="${idx}" ${idx === state.activeCycleIndex ? "selected" : ""}>Siklus ${idx + 1}</option>`
    )).join("");
    el.activeCycleStart.value = formatNumber(getActiveCycle().start);
  }

  function renderHeaderKpis() {
    const metrics = computeMetrics(state);
    const unitLabel = state.timeUnit;

    el.projectHeading.textContent = state.processName.trim() || "Proyek Man-Machine Chart";
    el.projectMeta.textContent = `${state.humanCount} Operator · ${state.machineCount} Mesin · Satuan ${capitalize(unitLabel)}`;

    el.kpiCycleTime.textContent = `${formatNumber(metrics.cycleTime)} ${unitLabel}`;
    el.kpiOutputRate.textContent = `Kapasitas: ±${formatNumber(metrics.unitsPerHour)} unit/jam`;

    if (metrics.humanStats.length > 0) {
      el.kpiOperatorUtil.textContent = `${formatNumber(metrics.humanUtil)}%`;
      el.kpiOperatorDetail.textContent = `${formatNumber(metrics.totalHumanWork)} ${unitLabel} kerja · ${formatNumber(metrics.totalHumanIdle)} ${unitLabel} menganggur`;
    } else {
      el.kpiOperatorUtil.textContent = "—";
      el.kpiOperatorDetail.textContent = "Belum ada operator";
    }

    if (metrics.machineStats.length > 0) {
      el.kpiMachineUtil.textContent = `${formatNumber(metrics.machineUtil)}%`;
      el.kpiMachineDetail.textContent = `${formatNumber(metrics.totalMachineWork)} ${unitLabel} jalan · ${formatNumber(metrics.totalMachineIdle)} ${unitLabel} kosong`;
    } else {
      el.kpiMachineUtil.textContent = "—";
      el.kpiMachineDetail.textContent = "Belum ada mesin";
    }
  }

  let draggedActivityIndex = null;

  function renderActivityList() {
    const activities = getActiveCycle().activities;
    el.activityCountLabel.textContent = String(activities.length);

    if (!activities.length) {
      el.activityListContainer.innerHTML = `<p class="empty-msg">Belum ada langkah kerja. Tambahkan langkah pertama di atas atau pilih Template.</p>`;
      return;
    }

    el.activityListContainer.innerHTML = activities.map((act, idx) => {
      const catLabel = CATEGORY_META[act.category]?.short || "Kerja";
      const end = act.start + act.duration;
      return `
        <div class="activity-item" draggable="true" data-index="${idx}">
          <div class="activity-item-top">
            <div class="activity-item-title">
              <span class="cat-marker ${act.category}" aria-hidden="true"></span>
              <input type="text" class="activity-name-input" data-act-name="${idx}" value="${escapeAttr(act.name)}" aria-label="Nama aktivitas">
            </div>
            <button type="button" class="mini-btn danger" data-act-del="${idx}" title="Hapus langkah">Hapus</button>
          </div>
          <div class="activity-item-meta">
            <span class="activity-submeta tabular-nums">${escapeHtml(act.resourceName)} · ${escapeHtml(catLabel)} · ${formatNumber(act.start)}–${formatNumber(end)} ${state.timeUnit}</span>
            <div class="activity-item-controls">
              <button type="button" class="mini-btn" data-act-step="${idx}" data-delta="-1" title="Kurangi 1">-1</button>
              <span class="mini-dur tabular-nums">${formatNumber(act.duration)} ${state.timeUnit === "detik" ? "s" : "m"}</span>
              <button type="button" class="mini-btn" data-act-step="${idx}" data-delta="1" title="Tambah 1">+1</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    el.activityListContainer.querySelectorAll("[data-act-name]").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = Number(input.dataset.actName);
        activities[idx].name = input.value.trim() || "Tanpa nama";
        renderChart();
        renderKaizenInsights();
        saveStateToStorage();
      });
    });

    el.activityListContainer.querySelectorAll("[data-act-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.actStep);
        const delta = Number(btn.dataset.delta);
        const target = activities[idx];
        const prevDur = target.duration;
        target.duration = Math.max(0.5, roundToHalf(target.duration + delta));
        const actualDelta = target.duration - prevDur;

        const prevEnd = target.start + prevDur;
        for (let j = idx + 1; j < activities.length; j += 1) {
          if (activities[j].resourceName === target.resourceName && Math.abs(activities[j].start - prevEnd) < 0.01) {
            activities[j].start = Math.max(0, roundToHalf(activities[j].start + actualDelta));
          }
        }
        renderAll();
      });
    });

    el.activityListContainer.querySelectorAll("[data-act-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.actDel);
        activities.splice(idx, 1);
        renderAll();
      });
    });

    el.activityListContainer.querySelectorAll(".activity-item").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") {
          e.preventDefault();
          return;
        }
        draggedActivityIndex = Number(card.dataset.index);
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        draggedActivityIndex = null;
        el.activityListContainer.querySelectorAll(".activity-item").forEach((c) => c.classList.remove("is-drag-over"));
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        card.classList.add("is-drag-over");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("is-drag-over");
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetIndex = Number(card.dataset.index);
        if (draggedActivityIndex === null || draggedActivityIndex === targetIndex) return;

        const [moved] = activities.splice(draggedActivityIndex, 1);
        activities.splice(targetIndex, 0, moved);
        recalculatePerActorSequential(activities);
        renderAll();
      });
    });
  }

  function recalculatePerActorSequential(activities) {
    const actorCursor = new Map();
    activities.forEach((act) => {
      const key = `${act.resourceType}::${act.resourceName}`;
      const start = actorCursor.get(key) || 0;
      act.start = roundToHalf(start);
      actorCursor.set(key, act.start + act.duration);
    });
  }

  function renderAdvancedTable() {
    const activeCycle = getActiveCycle();
    const cycleStart = Math.max(0, Number(activeCycle.start) || 0);
    const activities = activeCycle.activities;
    const resources = getResources();

    el.activityRows.innerHTML = activities.map((act, idx) => {
      const actorOptions = resources.map((r) => (
        `<option value="${escapeAttr(`${r.type}::${r.name}`)}" ${r.type === act.resourceType && r.name === act.resourceName ? "selected" : ""}>${escapeHtml(r.name)}</option>`
      )).join("");

      return `
        <tr>
          <td>
            <div class="row-actions">
              <button type="button" class="mini-btn" data-move="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="mini-btn" data-move="down" data-idx="${idx}" ${idx === activities.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </td>
          <td><input type="text" data-tbl-field="name" data-idx="${idx}" value="${escapeAttr(act.name)}"></td>
          <td>
            <select data-tbl-field="category" data-idx="${idx}">
              <option value="machine-work" ${act.category === "machine-work" ? "selected" : ""}>Kerja di Mesin</option>
              <option value="self" ${act.category === "self" ? "selected" : ""}>Kerja Mandiri</option>
              <option value="auto" ${act.category === "auto" ? "selected" : ""}>Mesin Otomatis</option>
              <option value="waiting" ${act.category === "waiting" ? "selected" : ""}>Menunggu</option>
            </select>
          </td>
          <td><select data-tbl-field="actor" data-idx="${idx}">${actorOptions}</select></td>
          <td><input type="number" min="0" step="0.5" class="tabular-nums" data-tbl-field="start" data-idx="${idx}" value="${formatNumber(cycleStart + act.start)}"></td>
          <td><input type="number" min="0.5" step="0.5" class="tabular-nums" data-tbl-field="duration" data-idx="${idx}" value="${formatNumber(act.duration)}"></td>
          <td><button type="button" class="mini-btn danger" data-tbl-del="${idx}">Hapus</button></td>
        </tr>
      `;
    }).join("");

    el.activityRows.querySelectorAll("[data-tbl-field]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        const idx = Number(input.dataset.idx);
        const field = input.dataset.tblField;
        const act = activities[idx];
        if (!act) return;

        if (field === "name") {
          act.name = input.value;
        } else if (field === "category") {
          act.category = input.value;
        } else if (field === "actor") {
          const parsed = parseActorValue(input.value);
          act.resourceType = parsed.resourceType;
          act.resourceName = parsed.resourceName;
        } else if (field === "start") {
          act.start = Math.max(0, (Number(input.value) || 0) - cycleStart);
        } else if (field === "duration") {
          act.duration = Math.max(0.5, Number(input.value) || 0.5);
        }

        renderHeaderKpis();
        renderChart();
        renderResourceSummary();
        renderKaizenInsights();
        renderActivityList();
        saveStateToStorage();
      });
    });

    el.activityRows.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const target = btn.dataset.move === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= activities.length) return;
        [activities[idx], activities[target]] = [activities[target], activities[idx]];
        recalculatePerActorSequential(activities);
        renderAll();
      });
    });

    el.activityRows.querySelectorAll("[data-tbl-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activities.splice(Number(btn.dataset.tblDel), 1);
        renderAll();
      });
    });
  }

  function renderChart() {
    document.querySelectorAll("[data-format]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.format === state.chartFormat);
    });

    el.verticalChartContainer.classList.toggle("is-hidden", state.chartFormat !== "vertical");
    el.horizontalChartContainer.classList.toggle("is-hidden", state.chartFormat !== "timeline");
    el.numericTableContainer.classList.toggle("is-hidden", state.chartFormat !== "table");

    if (state.chartFormat === "vertical") {
      el.chartInteractionHint.textContent = "Tips: Tarik balok ke atas/bawah untuk menggeser waktu mulai, atau tarik garis bawah balok untuk mengubah durasi.";
      renderVerticalChart();
    } else if (state.chartFormat === "timeline") {
      el.chartInteractionHint.textContent = "Tips: Arahkan kursor ke timeline untuk melihat garis koordinat waktu, atau seret area grafik untuk menggulir.";
      renderHorizontalTimeline();
    } else {
      el.chartInteractionHint.textContent = "Tabel rekapitulasi durasi kerja, waktu menganggur, dan utilisasi tiap operator serta mesin.";
      renderNumericTable();
    }
  }

  function renderVerticalChart() {
    const resources = getResources();
    if (!resources.length) {
      el.verticalChartContainer.innerHTML = `<p class="empty-msg">Tambahkan minimal 1 Operator atau 1 Mesin untuk menampilkan grafik.</p>`;
      return;
    }

    const cycleTime = Math.max(1, Number(state.cycleTime) || 1);
    const displayCycleCount = state.uiMode === "advanced" ? state.cycleCount : 1;
    const metrics = computeMetrics(state);

    let maxEnd = cycleTime;
    state.cycles.slice(0, displayCycleCount).forEach((c) => {
      c.activities.forEach((a) => {
        maxEnd = Math.max(maxEnd, a.start + a.duration);
      });
    });
    const timeScale = Math.max(cycleTime, Math.ceil(maxEnd));
    const pxPerUnit = 8.5 * state.zoom;
    const plotHeight = Math.max(420, Math.round(timeScale * pxPerUnit));
    const colWidth = Math.round(170 * Math.max(0.85, Math.min(1.5, state.zoom)));

    const tickStep = timeScale <= 30 ? 5 : timeScale <= 120 ? 10 : timeScale <= 300 ? 30 : 60;
    const ticks = [];
    for (let t = 0; t <= timeScale; t += tickStep) ticks.push(t);
    if (ticks[ticks.length - 1] !== timeScale) ticks.push(timeScale);

    const yTicksHtml = ticks.map((t, idx) => {
      const topPct = (t / timeScale) * 100;
      const cls = idx === 0 ? "is-first" : idx === ticks.length - 1 ? "is-last" : "";
      return `<span class="vchart-ytick tabular-nums ${cls}" style="top:${topPct}%;">${formatNumber(t)}</span>`;
    }).join("");

    const cycleRowHtml = [];
    const headerRowHtml = [];
    const colsHtml = [];

    for (let cIdx = 0; cIdx < displayCycleCount; cIdx += 1) {
      const cycle = state.cycles[cIdx] || { start: 0, activities: [] };
      const cycleWidth = resources.length * colWidth;

      if (displayCycleCount > 1) {
        cycleRowHtml.push(`<div class="vchart-cycle-cell" style="width:${cycleWidth}px;">Siklus ${cIdx + 1} (Mulai ${formatNumber(cycle.start)} ${state.timeUnit})</div>`);
      }

      resources.forEach((res) => {
        const resStat = metrics.resourceStats.find((s) => s.type === res.type && s.name === res.name);
        const utilPct = resStat ? `${formatNumber(resStat.utilization)}% sibuk` : "";

        headerRowHtml.push(`
          <div class="vchart-col-head" style="width:${colWidth}px;">
            <strong>${escapeHtml(res.name)}</strong>
            <span class="tabular-nums">${escapeHtml(utilPct)}</span>
          </div>
        `);

        const bars = cycle.activities
          .map((act, actIdx) => ({ act, actIdx }))
          .filter(({ act }) => act.resourceType === res.type && act.resourceName === res.name && act.duration > 0)
          .sort((a, b) => a.act.start - b.act.start);

        const activeIntervals = bars
          .filter(({ act }) => act.category !== "waiting")
          .map(({ act }) => [Math.max(0, act.start), Math.min(cycleTime, act.start + act.duration)]);
        const merged = mergeIntervals(activeIntervals);
        const gaps = [];
        let cursor = 0;
        merged.forEach(([s, e]) => {
          if (s > cursor + 0.25) gaps.push({ start: cursor, end: s });
          cursor = Math.max(cursor, e);
        });
        if (cursor + 0.25 < cycleTime) {
          gaps.push({ start: cursor, end: cycleTime });
        }

        const gapsHtml = gaps.map((g) => {
          const topPct = (g.start / timeScale) * 100;
          const heightPct = ((g.end - g.start) / timeScale) * 100;
          const dur = g.end - g.start;
          return `
            <div class="vchart-idle-gap" style="top:${topPct}%;height:${heightPct}%;">
              ${dur >= 3 ? `Kosong ${formatNumber(dur)} ${state.timeUnit === "detik" ? "s" : "m"}` : ""}
            </div>
          `;
        }).join("");

        const barsHtml = bars.map(({ act, actIdx }) => {
          const topPct = (act.start / timeScale) * 100;
          const heightPct = Math.max(2.4, (act.duration / timeScale) * 100);
          const absStart = cycle.start + act.start;
          const absEnd = absStart + act.duration;

          return `
            <div class="vchart-bar ${act.category}"
                 data-cycle-idx="${cIdx}"
                 data-act-idx="${actIdx}"
                 style="top:${topPct}%;height:${heightPct}%;"
                 title="${escapeAttr(`${act.name} (${formatNumber(act.duration)} ${state.timeUnit}, ${formatNumber(absStart)}–${formatNumber(absEnd)})`)}">
              <span class="vchart-bar-title">${escapeHtml(act.name)}</span>
              <span class="vchart-bar-time tabular-nums">${formatNumber(act.duration)} ${state.timeUnit === "detik" ? "s" : "m"} · ${formatNumber(absStart)}–${formatNumber(absEnd)}</span>
              <div class="vchart-resize-handle" data-resize="true" title="Tarik untuk ubah durasi"></div>
            </div>
          `;
        }).join("");

        colsHtml.push(`
          <div class="vchart-col" style="width:${colWidth}px;height:${plotHeight}px;background-size:100% ${(tickStep / timeScale) * plotHeight}px;">
            ${gapsHtml}
            ${barsHtml}
          </div>
        `);
      });
    }

    el.verticalChartContainer.innerHTML = `
      <div class="vchart-wrap">
        <div class="vchart-corner tabular-nums">Waktu<br>(${escapeHtml(state.timeUnit)})</div>
        ${displayCycleCount > 1 ? `<div class="vchart-cycle-row">${cycleRowHtml.join("")}</div>` : ""}
        <div class="vchart-header-row" style="${displayCycleCount === 1 ? "grid-row: 1 / span 2;" : ""}">${headerRowHtml.join("")}</div>
        <div class="vchart-yaxis" style="height:${plotHeight}px;">${yTicksHtml}</div>
        <div class="vchart-plot" style="height:${plotHeight}px;">${colsHtml.join("")}</div>
      </div>
    `;

    attachVerticalBarInteractions(plotHeight, timeScale);
  }

  function attachVerticalBarInteractions(plotHeight, timeScale) {
    el.verticalChartContainer.querySelectorAll(".vchart-bar").forEach((barEl) => {
      barEl.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        const cIdx = Number(barEl.dataset.cycleIdx);
        const aIdx = Number(barEl.dataset.actIdx);
        const act = state.cycles[cIdx]?.activities[aIdx];
        if (!act) return;

        const isResize = e.target.closest("[data-resize='true']") !== null;
        const startY = e.clientY;
        const origStart = act.start;
        const origDuration = act.duration;

        barEl.setPointerCapture(e.pointerId);

        const onMove = (ev) => {
          const deltaPx = ev.clientY - startY;
          const deltaUnits = (deltaPx / plotHeight) * timeScale;

          if (isResize) {
            const nextDur = Math.max(0.5, roundToHalf(origDuration + deltaUnits));
            act.duration = nextDur;
            barEl.style.height = `${Math.max(2.4, (nextDur / timeScale) * 100)}%`;
            const timeLabel = barEl.querySelector(".vchart-bar-time");
            if (timeLabel) {
              const absS = (state.cycles[cIdx]?.start || 0) + act.start;
              timeLabel.textContent = `${formatNumber(nextDur)} ${state.timeUnit === "detik" ? "s" : "m"} · ${formatNumber(absS)}–${formatNumber(absS + nextDur)}`;
            }
          } else {
            const nextStart = Math.max(0, roundToHalf(origStart + deltaUnits));
            act.start = nextStart;
            barEl.style.top = `${(nextStart / timeScale) * 100}%`;
            const timeLabel = barEl.querySelector(".vchart-bar-time");
            if (timeLabel) {
              const absS = (state.cycles[cIdx]?.start || 0) + nextStart;
              timeLabel.textContent = `${formatNumber(act.duration)} ${state.timeUnit === "detik" ? "s" : "m"} · ${formatNumber(absS)}–${formatNumber(absS + act.duration)}`;
            }
          }
        };

        const onUp = () => {
          barEl.removeEventListener("pointermove", onMove);
          barEl.removeEventListener("pointerup", onUp);
          renderAll();
        };

        barEl.addEventListener("pointermove", onMove);
        barEl.addEventListener("pointerup", onUp);
      });
    });
  }

  function renderHorizontalTimeline() {
    const cycleTime = Math.max(1, Number(state.cycleTime) || 1);
    const cycleCount = state.uiMode === "advanced" ? Math.max(1, Number(state.cycleCount) || 1) : 1;
    const resources = getResources();
    const pxPerUnit = BASE_PX_PER_UNIT * state.zoom;

    let maxEnd = cycleTime;
    state.cycles.slice(0, cycleCount).forEach((c) => {
      c.activities.forEach((a) => {
        maxEnd = Math.max(maxEnd, c.start + a.start + a.duration);
      });
    });
    const totalTimeline = Math.max(cycleTime, Math.ceil(maxEnd));
    const timelineWidth = totalTimeline * pxPerUnit;

    document.documentElement.style.setProperty("--grid-width", `${pxPerUnit}px`);
    el.chartHeader.style.width = `${timelineWidth}px`;
    el.chartHeader.style.minWidth = `${timelineWidth}px`;
    el.chart.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
    el.chart.style.minWidth = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;

    const tickStep = totalTimeline <= 60 ? 5 : totalTimeline <= 180 ? 10 : 30;
    el.chartHeader.innerHTML = "";
    for (let t = 0; t <= totalTimeline; t += tickStep) {
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.style.left = `${t * pxPerUnit}px`;
      tick.style.transform = t === 0 ? "translateX(0)" : t >= totalTimeline ? "translateX(-100%)" : "translateX(-50%)";
      tick.textContent = formatNumber(t);
      el.chartHeader.appendChild(tick);
    }

    el.chart.innerHTML = "";
    for (let c = 0; c < cycleCount; c += 1) {
      const cycle = state.cycles[c] || { start: c * cycleTime, activities: [] };
      const group = document.createElement("section");
      group.className = "cycle-group";
      group.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
      group.innerHTML = `<div class="cycle-title">Siklus ${c + 1} (Mulai ${formatNumber(cycle.start)} ${state.timeUnit})</div>`;
      el.chart.appendChild(group);

      resources.forEach((res) => {
        const lane = document.createElement("div");
        lane.className = "lane";
        lane.style.width = `${timelineWidth + RESOURCE_LABEL_WIDTH}px`;
        lane.innerHTML = `<div class="lane-label">${escapeHtml(res.name)}</div><div class="timeline"><div class="idle-fill"></div></div>`;
        group.appendChild(lane);

        const timeline = lane.querySelector(".timeline");
        timeline.style.width = `${timelineWidth}px`;
        timeline.style.minWidth = `${timelineWidth}px`;

        const idleFill = timeline.querySelector(".idle-fill");
        idleFill.style.left = `${cycle.start * pxPerUnit}px`;
        idleFill.style.width = `${Math.min(timelineWidth - cycle.start * pxPerUnit, cycleTime * pxPerUnit)}px`;

        attachHoverCoordinate(timeline, pxPerUnit);

        cycle.activities
          .filter((a) => a.resourceType === res.type && a.resourceName === res.name && a.duration > 0)
          .forEach((act) => {
            const absStart = cycle.start + act.start;
            const bar = document.createElement("div");
            bar.className = `bar ${act.category}`;
            bar.style.left = `${absStart * pxPerUnit}px`;
            bar.style.width = `${Math.max(4, act.duration * pxPerUnit)}px`;
            bar.dataset.name = act.name;
            bar.dataset.dur = `${formatNumber(act.duration)} ${state.timeUnit}`;
            bar.innerHTML = `
              <div class="bar-content">
                <strong>${escapeHtml(act.name)}</strong>
                <span class="tabular-nums">${formatNumber(act.duration)} ${state.timeUnit}</span>
              </div>
            `;
            timeline.appendChild(bar);
          });
      });
    }
  }

  function attachHoverCoordinate(timeline, pxPerUnit) {
    const tooltip = document.createElement("span");
    tooltip.className = "hover-tooltip tabular-nums";
    timeline.append(tooltip);

    let guide = el.horizontalChartContainer.querySelector(".hover-guide-line");
    if (!guide) {
      guide = document.createElement("span");
      guide.className = "hover-guide-line";
      el.horizontalChartContainer.appendChild(guide);
    }

    timeline.addEventListener("mousemove", (e) => {
      const rect = timeline.getBoundingClientRect();
      const shellRect = el.horizontalChartContainer.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const guideX = rect.left - shellRect.left + x;
      const coord = `${formatNumber(x / pxPerUnit)} ${state.timeUnit}`;
      const activeBar = e.target instanceof Element ? e.target.closest(".bar") : null;

      guide.style.left = `${el.horizontalChartContainer.scrollLeft + guideX}px`;
      guide.style.top = `${el.horizontalChartContainer.scrollTop}px`;
      guide.style.height = `${el.horizontalChartContainer.clientHeight}px`;
      tooltip.style.left = `${x}px`;
      tooltip.textContent = activeBar ? `${coord} · ${activeBar.dataset.name} (${activeBar.dataset.dur})` : coord;
      el.horizontalChartContainer.classList.add("show-chart-hover-guide");
      timeline.classList.add("show-hover-guide");
    });

    timeline.addEventListener("mouseleave", () => {
      el.horizontalChartContainer.classList.remove("show-chart-hover-guide");
      timeline.classList.remove("show-hover-guide");
    });
  }

  function renderNumericTable() {
    const metrics = computeMetrics(state);
    const unit = state.timeUnit;
    const rowsHtml = metrics.resourceStats.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>${r.type === "human" ? "Operator" : "Mesin"}</td>
        <td class="num tabular-nums">${formatNumber(r.workTime)} ${unit}</td>
        <td class="num tabular-nums">${formatNumber(r.idleTime)} ${unit}</td>
        <td class="num tabular-nums">${formatNumber(r.utilization)}%</td>
      </tr>
    `).join("");

    el.numericTableContainer.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Pelaku Kerja</th>
            <th>Jenis</th>
            <th class="num">Waktu Kerja Aktif</th>
            <th class="num">Waktu Menganggur / Kosong</th>
            <th class="num">Kesibukan (%)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="5" class="empty-msg">Belum ada data.</td></tr>`}
        </tbody>
      </table>
    `;
  }

  function renderResourceSummary() {
    const metrics = computeMetrics(state);
    const unit = state.timeUnit;
    el.summaryCards.innerHTML = metrics.resourceStats.map((r) => `
      <div class="resource-stat-row">
        <div class="resource-stat-head">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="tabular-nums">${formatNumber(r.utilization)}% sibuk</span>
        </div>
        <div class="resource-util-bar">
          <div class="resource-util-fill" style="width:${Math.min(100, r.utilization)}%;"></div>
        </div>
        <div class="resource-stat-nums tabular-nums">
          <span>Kerja: ${formatNumber(r.workTime)} ${unit}</span>
          <span>Kosong: ${formatNumber(r.idleTime)} ${unit}</span>
        </div>
      </div>
    `).join("");
  }

  function renderKaizenInsights() {
    const metrics = computeMetrics(state);
    const cycle = getActiveCycle();
    const activities = cycle.activities;
    const unit = state.timeUnit;
    const insights = [];

    const resources = getResources();
    resources.forEach((res) => {
      const list = activities
        .filter((a) => a.resourceType === res.type && a.resourceName === res.name && a.duration > 0)
        .sort((a, b) => a.start - b.start);

      for (let i = 1; i < list.length; i += 1) {
        const prev = list[i - 1];
        const curr = list[i];
        const prevEnd = prev.start + prev.duration;
        if (curr.start < prevEnd - 0.05) {
          insights.push({
            tone: "is-alert",
            label: "Jadwal Bentrok",
            title: `${res.name} memiliki 2 pekerjaan bersamaan`,
            desc: `"${prev.name}" (${formatNumber(prev.start)}–${formatNumber(prevEnd)}) bertumpuk dengan "${curr.name}" (${formatNumber(curr.start)}–${formatNumber(curr.start + curr.duration)} ${unit}). Geser salah satu balok.`
          });
          break;
        }
      }
    });

    const maxFinish = activities.reduce((m, a) => Math.max(m, a.start + a.duration), 0);
    if (maxFinish > metrics.cycleTime) {
      insights.push({
        tone: "is-warning",
        label: "Melebihi Target Siklus",
        title: `Total proses mencapai ${formatNumber(maxFinish)} ${unit}`,
        desc: `Target waktu 1 siklus saat ini ${formatNumber(metrics.cycleTime)} ${unit}. Anda bisa menaikkan target siklus atau menyusun ulang langkah paralel.`
      });
    }

    const hasAutoMachine = metrics.machineStats.some((m) => m.autoTime > 0);
    metrics.humanStats.forEach((h) => {
      const longestGap = h.gaps.slice().sort((a, b) => b.duration - a.duration)[0];
      if (longestGap && longestGap.duration >= 5) {
        const pct = (longestGap.duration / metrics.cycleTime) * 100;
        insights.push({
          tone: "is-opportunity",
          label: "Peluang Kaizen Operator",
          title: `${h.name} menganggur ${formatNumber(longestGap.duration)} ${unit} (${formatNumber(pct)}%)`,
          desc: hasAutoMachine
            ? `Waktu kosong terpanjang terjadi di ${unit} ${formatNumber(longestGap.start)}–${formatNumber(longestGap.end)}. Pertimbangkan memindahkan aktivitas "Kerja Mandiri" (persiapan/inspeksi) ke rentang ini atau menambah 1 mesin.`
            : `Terdapat jeda kosong pada ${formatNumber(longestGap.start)}–${formatNumber(longestGap.end)} ${unit}. Periksa apakah pekerjaan bisa dirapatkan untuk mempercepat siklus.`
        });
      }
    });

    metrics.machineStats.forEach((m) => {
      if (m.utilization < 55 && activities.length > 0) {
        insights.push({
          tone: "is-warning",
          label: "Mesin Belum Optimal",
          title: `${m.name} hanya bekerja ${formatNumber(m.utilization)}%`,
          desc: `${m.name} kosong selama ${formatNumber(m.idleTime)} ${unit} dalam 1 siklus. Cek apakah loading/unloading bisa dipercepat dengan jig atau persiapan di luar siklus.`
        });
      }
    });

    if (!insights.length) {
      insights.push({
        tone: "is-opportunity",
        label: "Alur Seimbang",
        title: `Tidak ada bentrok jadwal · Kapasitas ±${formatNumber(metrics.unitsPerHour)} unit/jam`,
        desc: "Simpan kondisi ini sebagai Before lalu coba geser aktivitas di grafik vertikal untuk menguji skenario perbaikan."
      });
    }

    el.kaizenInsights.innerHTML = insights.slice(0, 4).map((item) => `
      <article class="insight-item ${item.tone}">
        <span class="insight-label">${escapeHtml(item.label)}</span>
        <strong class="insight-title">${escapeHtml(item.title)}</strong>
        <p class="insight-desc">${escapeHtml(item.desc)}</p>
      </article>
    `).join("");
  }

  function getSerializableState() {
    return {
      processName: state.processName,
      timeUnit: state.timeUnit,
      cycleTime: state.cycleTime,
      cycleCount: state.cycleCount,
      humanCount: state.humanCount,
      machineCount: state.machineCount,
      cycles: state.cycles.map((c) => ({
        start: c.start,
        activities: c.activities.map((a) => ({ ...a }))
      }))
    };
  }

  function captureSnapshot(slot) {
    const snap = getSerializableState();
    if (slot === "before") state.beforeSnapshot = snap;
    else state.afterSnapshot = snap;
    saveStateToStorage();
  }

  function renderCompareView() {
    const before = state.beforeSnapshot;
    const after = state.afterSnapshot || getSerializableState();

    if (!before) {
      el.compareDeltaStrip.innerHTML = "";
      el.beforeSummaryContent.innerHTML = `<p class="empty-msg">Belum ada data Before. Klik "Ambil Grafik Aktif ke Before" untuk merekam kondisi awal sebelum perbaikan.</p>`;
    } else {
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      const cycleDiff = mAfter.cycleTime - mBefore.cycleTime;
      const opDiff = mAfter.humanUtil - mBefore.humanUtil;
      const mcDiff = mAfter.machineUtil - mBefore.machineUtil;
      const outDiff = mAfter.unitsPerHour - mBefore.unitsPerHour;

      el.compareDeltaStrip.innerHTML = `
        <div class="delta-card">
          <span>Selisih Waktu Siklus</span>
          <strong class="tabular-nums ${cycleDiff <= 0 ? "is-good" : "is-bad"}">${cycleDiff > 0 ? "+" : ""}${formatNumber(cycleDiff)} ${after.timeUnit}</strong>
        </div>
        <div class="delta-card">
          <span>Kesibukan Operator</span>
          <strong class="tabular-nums ${opDiff >= 0 ? "is-good" : "is-bad"}">${opDiff > 0 ? "+" : ""}${formatNumber(opDiff)}%</strong>
        </div>
        <div class="delta-card">
          <span>Kesibukan Mesin</span>
          <strong class="tabular-nums ${mcDiff >= 0 ? "is-good" : "is-bad"}">${mcDiff > 0 ? "+" : ""}${formatNumber(mcDiff)}%</strong>
        </div>
        <div class="delta-card">
          <span>Perubahan Kapasitas</span>
          <strong class="tabular-nums ${outDiff >= 0 ? "is-good" : "is-bad"}">${outDiff > 0 ? "+" : ""}${formatNumber(outDiff)} unit/jam</strong>
        </div>
      `;

      el.beforeSummaryContent.innerHTML = buildSnapshotHtml(before, mBefore);
    }

    const mAfter = computeMetrics(after);
    el.afterSummaryContent.innerHTML = buildSnapshotHtml(after, mAfter);
  }

  function buildSnapshotHtml(snap, metrics) {
    const acts = snap.cycles?.[0]?.activities || [];
    const stepsHtml = acts.map((a) => `
      <div class="mini-step-row">
        <span>${escapeHtml(a.resourceName)} · <strong>${escapeHtml(a.name)}</strong></span>
        <span class="tabular-nums">${formatNumber(a.start)}–${formatNumber(a.start + a.duration)} ${snap.timeUnit} (${formatNumber(a.duration)})</span>
      </div>
    `).join("");

    return `
      <div class="muted-meta">${escapeHtml(snap.processName || "Tanpa Judul")}</div>
      <div class="resource-stat-nums tabular-nums">
        <span>Siklus: <strong>${formatNumber(metrics.cycleTime)} ${snap.timeUnit}</strong></span>
        <span>Operator: <strong>${formatNumber(metrics.humanUtil)}%</strong></span>
        <span>Mesin: <strong>${formatNumber(metrics.machineUtil)}%</strong></span>
      </div>
      <div class="mini-timeline-list">
        ${stepsHtml || `<p class="empty-msg">Tidak ada aktivitas.</p>`}
      </div>
    `;
  }

  function toggleStopwatch() {
    if (swState.running) {
      swState.elapsedMs += performance.now() - swState.startedAt;
      swState.running = false;
      clearInterval(swState.timerId);
      el.swStartPauseBtn.textContent = "Lanjut";
      el.swLapBtn.disabled = true;
    } else {
      swState.startedAt = performance.now();
      swState.running = true;
      el.swStartPauseBtn.textContent = "Jeda";
      el.swLapBtn.disabled = false;
      swState.timerId = setInterval(updateStopwatchDisplay, 100);
    }
    updateStopwatchDisplay();
  }

  function getCurrentElapsedMs() {
    return swState.running ? swState.elapsedMs + (performance.now() - swState.startedAt) : swState.elapsedMs;
  }

  function updateStopwatchDisplay() {
    const totalMs = getCurrentElapsedMs();
    const totalSec = totalMs / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1).padStart(4, "0");
    el.stopwatchDisplay.textContent = `${String(mins).padStart(2, "0")}:${secs}`;
  }

  function recordStopwatchLap() {
    const nowMs = getCurrentElapsedMs();
    const deltaSec = Math.max(0.5, roundToHalf((nowMs - swState.lastLapMs) / 1000));
    const startSec = roundToHalf(swState.lastLapMs / 1000);
    swState.lastLapMs = nowMs;

    const { resourceType, resourceName } = parseActorValue(el.swActor.value);
    const category = el.swCategory.value;
    const name = el.swActivityName.value.trim() || `${CATEGORY_META[category]?.label || "Langkah"} ${swState.logs.length + 1}`;

    swState.logs.push({
      name,
      category,
      resourceType,
      resourceName,
      start: startSec,
      duration: deltaSec
    });

    el.swActivityName.value = "";
    renderStopwatchLogs();
  }

  function resetStopwatch() {
    clearInterval(swState.timerId);
    swState.running = false;
    swState.elapsedMs = 0;
    swState.lastLapMs = 0;
    swState.logs = [];
    el.swStartPauseBtn.textContent = "Mulai";
    el.swLapBtn.disabled = true;
    updateStopwatchDisplay();
    renderStopwatchLogs();
  }

  function renderStopwatchLogs() {
    el.swCount.textContent = String(swState.logs.length);
    el.swSendToChartBtn.disabled = swState.logs.length === 0;

    if (!swState.logs.length) {
      el.swLogList.innerHTML = `<p class="empty-msg">Belum ada langkah yang dicatat. Tekan "Mulai" lalu "Catat Langkah".</p>`;
      return;
    }

    el.swLogList.innerHTML = swState.logs.map((item, idx) => `
      <div class="mini-step-row">
        <span>${idx + 1}. <strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.resourceName)})</span>
        <span class="tabular-nums">${formatNumber(item.duration)} detik</span>
      </div>
    `).join("");
  }

  function sendStopwatchToChart() {
    if (!swState.logs.length) return;
    state.timeUnit = "detik";
    const totalEnd = swState.logs.reduce((m, l) => Math.max(m, l.start + l.duration), 1);
    state.cycleTime = Math.max(1, Math.ceil(totalEnd));
    state.cycles[state.activeCycleIndex].activities = swState.logs.map((l) => ({ ...l }));
    syncInputsFromState();
    renderAll();
    switchView("workspace");
    showToast(`${swState.logs.length} langkah dari Stopwatch berhasil dimasukkan ke grafik.`);
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...getSerializableState(),
        uiMode: state.uiMode,
        chartFormat: state.chartFormat,
        beforeSnapshot: state.beforeSnapshot,
        afterSnapshot: state.afterSnapshot
      }));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadStateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cycles)) return false;
      applySimulationData(parsed, { silent: true });
      state.uiMode = parsed.uiMode === "advanced" ? "advanced" : "simple";
      state.chartFormat = ["vertical", "timeline", "table"].includes(parsed.chartFormat) ? parsed.chartFormat : "vertical";
      state.beforeSnapshot = parsed.beforeSnapshot || null;
      state.afterSnapshot = parsed.afterSnapshot || null;
      return true;
    } catch {
      return false;
    }
  }

  function applySimulationData(data, options = {}) {
    state.processName = data.processName || "Man-Machine Chart";
    state.timeUnit = data.timeUnit === "menit" ? "menit" : "detik";
    state.cycleTime = Math.max(1, Number(data.cycleTime) || 60);
    state.cycleCount = Math.min(20, Math.max(1, Number(data.cycleCount) || 1));
    state.humanCount = Math.min(20, Math.max(0, Number(data.humanCount ?? 1)));
    state.machineCount = Math.min(20, Math.max(0, Number(data.machineCount ?? 1)));
    state.lastCycleTime = state.cycleTime;
    state.activeCycleIndex = 0;

    if (Array.isArray(data.cycles)) {
      state.cycles = data.cycles.map((c, idx) => ({
        start: Math.max(0, Number(c.start) || idx * state.cycleTime),
        activities: Array.isArray(c.activities) ? c.activities.map(normalizeActivity) : []
      }));
    } else if (Array.isArray(data.activities)) {
      state.cycles = [{ start: 0, activities: data.activities.map(normalizeActivity) }];
    } else {
      state.cycles = [{ start: 0, activities: [] }];
    }

    syncInputsFromState();
    if (!options.silent) {
      renderAll();
    }
  }

  function getSavedProjects() {
    try {
      return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function setSavedProjects(list) {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    } catch {
      showToast("Gagal menyimpan ke memori browser.", true);
    }
  }

  function saveNamedProject(stayInPlace) {
    const projects = getSavedProjects();
    const title = state.processName.trim() || `Proyek ${projects.length + 1}`;
    const entry = {
      id: `${Date.now()}`,
      name: title,
      savedAt: new Date().toLocaleString("id-ID"),
      data: getSerializableState()
    };
    projects.unshift(entry);
    setSavedProjects(projects.slice(0, 30));
    if (!stayInPlace) renderSavedProjects();
    showToast(`Proyek "${title}" tersimpan di browser.`);
  }

  function renderSavedProjects() {
    const projects = getSavedProjects();
    if (!projects.length) {
      el.savedProjectsList.innerHTML = `<p class="empty-msg">Belum ada proyek yang disimpan secara permanen. Klik "Simpan Proyek" di pojok kanan atas.</p>`;
      return;
    }

    el.savedProjectsList.innerHTML = projects.map((p) => {
      const m = computeMetrics(p.data);
      return `
        <article class="project-card">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="muted-meta tabular-nums">${escapeHtml(p.savedAt)} · Siklus ${formatNumber(m.cycleTime)} ${p.data.timeUnit} · Op ${formatNumber(m.humanUtil)}% · Mesin ${formatNumber(m.machineUtil)}%</div>
          <div class="project-card-actions">
            <button type="button" class="btn-primary" data-load-proj="${escapeAttr(p.id)}">Buka</button>
            <button type="button" class="btn-ghost" data-del-proj="${escapeAttr(p.id)}">Hapus</button>
          </div>
        </article>
      `;
    }).join("");

    el.savedProjectsList.querySelectorAll("[data-load-proj]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const found = getSavedProjects().find((p) => p.id === btn.dataset.loadProj);
        if (!found) return;
        applySimulationData(found.data);
        switchView("workspace");
        showToast(`Proyek "${found.name}" dimuat.`);
      });
    });

    el.savedProjectsList.querySelectorAll("[data-del-proj]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = getSavedProjects().filter((p) => p.id !== btn.dataset.delProj);
        setSavedProjects(next);
        renderSavedProjects();
      });
    });
  }

  function exportPng() {
    const resources = getResources();
    if (!resources.length) {
      showToast("Tidak ada grafik untuk diekspor.", true);
      return;
    }

    const metrics = computeMetrics(state);
    const cycle = getActiveCycle();
    const cycleTime = metrics.cycleTime;
    const maxEnd = Math.max(cycleTime, ...cycle.activities.map((a) => a.start + a.duration));
    const timeScale = Math.ceil(maxEnd);

    const scale = 2;
    const colW = 200;
    const axisW = 80;
    const headerH = 128;
    const colHeadH = 54;
    const plotH = Math.max(460, timeScale * 8);
    const legendH = 66;
    const pad = 28;
    const width = Math.max(760, pad * 2 + axisW + resources.length * colW);
    const height = headerH + colHeadH + plotH + legendH + pad;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 20px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText(state.processName.trim() || "EasyMMC — Man-Machine Chart", pad, 38);

    ctx.fillStyle = "#475569";
    ctx.font = "500 13px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText(
      `Total Siklus: ${formatNumber(cycleTime)} ${state.timeUnit}   ·   Kesibukan Operator: ${formatNumber(metrics.humanUtil)}%   ·   Kesibukan Mesin: ${formatNumber(metrics.machineUtil)}%   ·   Kapasitas: ±${formatNumber(metrics.unitsPerHour)} unit/jam`,
      pad,
      64
    );

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, 82);
    ctx.lineTo(width - pad, 82);
    ctx.stroke();

    const plotTop = headerH + colHeadH;
    const plotLeft = pad + axisW;

    resources.forEach((res, i) => {
      const x = plotLeft + i * colW;
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(x, headerH, colW, colHeadH);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(x, headerH, colW, colHeadH);

      const stat = metrics.resourceStats.find((s) => s.name === res.name && s.type === res.type);
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 13px 'Plus Jakarta Sans', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(res.name, x + colW / 2, headerH + 22);
      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.fillText(`${formatNumber(stat?.utilization || 0)}% sibuk`, x + colW / 2, headerH + 40);
    });

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(pad, headerH, axisW, colHeadH);
    ctx.strokeRect(pad, headerH, axisW, colHeadH);
    ctx.fillStyle = "#475569";
    ctx.font = "700 11px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Waktu (${state.timeUnit})`, pad + axisW / 2, headerH + 31);

    const tickStep = timeScale <= 30 ? 5 : timeScale <= 120 ? 10 : 30;
    for (let t = 0; t <= timeScale; t += tickStep) {
      const y = plotTop + (t / timeScale) * plotH;
      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotLeft + resources.length * colW, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(formatNumber(t), plotLeft - 10, y + 4);
    }

    resources.forEach((res, i) => {
      const colX = plotLeft + i * colW;
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(colX, plotTop, colW, plotH);

      const stat = metrics.resourceStats.find((s) => s.name === res.name && s.type === res.type);
      (stat?.gaps || []).forEach((g) => {
        const gy = plotTop + (g.start / timeScale) * plotH;
        const gh = ((g.end - g.start) / timeScale) * plotH;
        ctx.fillStyle = "#eef2f6";
        ctx.fillRect(colX + 12, gy, colW - 24, gh);
        if (gh >= 20) {
          ctx.fillStyle = "#64748b";
          ctx.font = "500 10px 'Plus Jakarta Sans', Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`Kosong ${formatNumber(g.duration)}`, colX + colW / 2, gy + gh / 2 + 4);
        }
      });

      cycle.activities
        .filter((a) => a.resourceType === res.type && a.resourceName === res.name && a.duration > 0)
        .forEach((act) => {
          const by = plotTop + (act.start / timeScale) * plotH;
          const bh = Math.max(16, (act.duration / timeScale) * plotH);
          const color = act.category === "waiting" ? "#cbd5e1" : (CATEGORY_META[act.category]?.color || "#2563eb");

          ctx.fillStyle = color;
          roundRect(ctx, colX + 12, by, colW - 24, bh, 6);
          ctx.fill();

          ctx.fillStyle = act.category === "waiting" ? "#0f172a" : "#ffffff";
          ctx.textAlign = "center";
          ctx.font = "700 11px 'Plus Jakarta Sans', Arial, sans-serif";
          ctx.fillText(truncateText(act.name, 22), colX + colW / 2, by + bh / 2 - (bh > 28 ? 3 : -4));
          if (bh > 28) {
            ctx.font = "500 10px 'IBM Plex Mono', monospace";
            ctx.fillText(`${formatNumber(act.duration)} ${state.timeUnit}`, colX + colW / 2, by + bh / 2 + 12);
          }
        });
    });

    const legY = plotTop + plotH + 28;
    const legendItems = [
      { label: "Kerja Mandiri", color: "#16a34a" },
      { label: "Kerja di Mesin", color: "#2563eb" },
      { label: "Mesin Jalan Otomatis", color: "#d97706" },
      { label: "Menunggu / Menganggur", color: "#cbd5e1" }
    ];
    let lx = pad;
    ctx.textAlign = "left";
    legendItems.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, legY - 10, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.font = "600 12px 'Plus Jakarta Sans', Arial, sans-serif";
      ctx.fillText(item.label, lx + 18, legY);
      lx += ctx.measureText(item.label).width + 44;
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(state.processName)}-easymmc.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Gambar PNG siap cetak berhasil diunduh.");
    }, "image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function truncateText(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function exportCsv() {
    const rows = [["Siklus", "Urut", "Aktivitas", "Kategori", "Pelaku", "JenisPelaku", "Mulai", "Durasi", "Satuan"]];
    state.cycles.forEach((c, cIdx) => {
      c.activities.forEach((a, idx) => {
        rows.push([
          cIdx + 1,
          idx + 1,
          a.name,
          a.category,
          a.resourceName,
          a.resourceType,
          a.start,
          a.duration,
          state.timeUnit
        ]);
      });
    });

    const csvContent = rows.map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadFile("\uFEFF" + csvContent, `${slugify(state.processName)}.csv`, "text/csv;charset=utf-8;");
    showToast("File CSV berhasil diunduh.");
  }

  function handleImportCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result || "").split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("Kosong");
        const parsedActivities = [];
        for (let i = 1; i < lines.length; i += 1) {
          const cols = parseCsvLine(lines[i]);
          if (cols.length < 8) continue;
          parsedActivities.push(normalizeActivity({
            name: cols[2],
            category: cols[3],
            resourceName: cols[4],
            resourceType: cols[5],
            start: Number(cols[6]) || 0,
            duration: Number(cols[7]) || 1
          }));
        }
        if (!parsedActivities.length) throw new Error("Format tidak cocok");
        state.cycles[state.activeCycleIndex].activities = parsedActivities;
        renderAll();
        showToast(`${parsedActivities.length} langkah kerja berhasil diimpor dari CSV.`);
      } catch {
        showToast("File CSV tidak valid. Gunakan format hasil Export CSV EasyMMC.", true);
      } finally {
        el.csvFileInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function exportExcel() {
    const metrics = computeMetrics(state);
    const resources = getResources();
    const unit = state.timeUnit;
    const cycleTime = metrics.cycleTime;
    const cycleCount = state.uiMode === "advanced" ? state.cycleCount : 1;

    const statRows = metrics.resourceStats.map((r) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${escapeHtml(r.name)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;">${r.type === "human" ? "Operator" : "Mesin"}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatNumber(r.workTime)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatNumber(r.idleTime)} ${unit}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatNumber(r.utilization)}%</td>
      </tr>
    `).join("");

    const actRows = [];
    for (let c = 0; c < cycleCount; c += 1) {
      const cyc = state.cycles[c];
      if (!cyc) continue;
      cyc.activities.forEach((a) => {
        const bg = CATEGORY_META[a.category]?.color || "#2563eb";
        const fg = a.category === "waiting" ? "#0f172a" : "#ffffff";
        actRows.push(`
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">Siklus ${c + 1}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${escapeHtml(a.resourceName)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;background:${bg};color:${fg};font-weight:bold;">${escapeHtml(CATEGORY_META[a.category]?.label || a.category)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${escapeHtml(a.name)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatNumber(cyc.start + a.start)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatNumber(a.duration)}</td>
          </tr>
        `);
      });
    }

    const html = `
      <html><head><meta charset="utf-8"></head><body>
        <h2>${escapeHtml(state.processName || "EasyMMC")}</h2>
        <p>Target Siklus: ${formatNumber(cycleTime)} ${unit} | Kesibukan Operator: ${formatNumber(metrics.humanUtil)}% | Kesibukan Mesin: ${formatNumber(metrics.machineUtil)}%</p>
        <h3>Ringkasan Pelaku Kerja (${resources.length})</h3>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;margin-bottom:16px;">
          <tr>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Pelaku</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Jenis</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Kerja Aktif</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Menganggur</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Kesibukan</th>
          </tr>
          ${statRows}
        </table>
        <h3>Daftar Langkah Kerja</h3>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">
          <tr>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Siklus</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Pelaku</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Kategori</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Aktivitas</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Mulai (${unit})</th>
            <th style="background:#0f172a;color:#fff;padding:6px;border:1px solid #0f172a;">Durasi (${unit})</th>
          </tr>
          ${actRows.join("")}
        </table>
      </body></html>
    `;
    downloadFile(html, `${slugify(state.processName)}-easymmc.xls`, "application/vnd.ms-excel");
    showToast("Laporan Excel (.xls) berhasil diunduh.");
  }

  function downloadJsonBackup() {
    const content = JSON.stringify(getSerializableState(), null, 2);
    downloadFile(content, `${slugify(state.processName)}-backup.json`, "application/json");
    showToast("Backup JSON diunduh.");
  }

  function handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applySimulationData(JSON.parse(String(reader.result || "{}")));
        showToast("File JSON berhasil dimuat.");
      } catch {
        showToast("File JSON tidak dapat dibaca.", true);
      } finally {
        el.simulationFileInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function setZoom(next) {
    state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    el.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
    renderChart();
    saveStateToStorage();
  }

  function setupDragScroll(scrollEl) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let sLeft = 0;
    let sTop = 0;

    scrollEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      sLeft = scrollEl.scrollLeft;
      sTop = scrollEl.scrollTop;
      scrollEl.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      scrollEl.scrollLeft = sLeft - (e.clientX - startX);
      scrollEl.scrollTop = sTop - (e.clientY - startY);
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      scrollEl.classList.remove("is-dragging");
    });
  }

  function setupWheelZoom(scrollEl) {
    scrollEl.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });
  }

  function openConfirmDialog({ title, message, confirmText = "Lanjutkan", onConfirm }) {
    el.dialogTitle.textContent = title;
    el.dialogMessage.textContent = message;
    el.dialogCancelBtn.classList.remove("is-hidden");
    el.dialogConfirmBtn.textContent = confirmText;
    dialogConfirmAction = onConfirm;
    el.appDialog.showModal();
  }

  function openInfoDialog(title, message) {
    el.dialogTitle.textContent = title;
    el.dialogMessage.textContent = message;
    el.dialogCancelBtn.classList.add("is-hidden");
    el.dialogConfirmBtn.textContent = "Mengerti";
    dialogConfirmAction = null;
    el.appDialog.showModal();
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast ${isError ? "is-error" : ""}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function roundToHalf(val) {
    return Math.round(val * 2) / 2;
  }

  function formatNumber(val) {
    return Number((Number(val) || 0).toFixed(1)).toString();
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }

  function slugify(value) {
    return String(value || "easymmc")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "easymmc";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  init();
})();

// app.js

const MIN_SLOTS = 5;
const STORAGE_KEY = "CitiTool_SyncOperator_v1";

const state = {
  currentKanal: "1",
  slots: { "1": Array(MIN_SLOTS).fill(null), "2": Array(MIN_SLOTS).fill(null) },
  library: [],
  categories: ["Alle", "Außen", "Innen", "Radial", "Axial"],
  activeCategory: "Alle",
  spindleFilter: "ALL", // ALL | SP3 | SP4
  nextOpId: 1,
  slotPickerCategory: "Alle",
  slotPickerSpindle: "ALL",
  planViewMode: "PLAN", // PLAN | EINRICHTE
  libraryCollapsed: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOperationById(id) {
  return state.library.find((op) => op.id === id) || null;
}

function formatOperationLabel(op) {
  if (!op) return "";
  const title = (op.title || "").trim();
  const code = (op.code || "").trim();
  if (title && code) return `${title} ${code}`;
  return title || code || "";
}

/* PWA */
function initPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
}

/* Dynamic L */
function getDynamicLCode(kanal, rowNumber) {
  const n = Math.max(1, rowNumber | 0);
  const suffix = String(n).padStart(2, "0");
  if (kanal === "1") return "L11" + suffix;
  if (kanal === "2") return "L21" + suffix;
  return null;
}

function formatOperationName(op) {
  const title = (op.title || "").trim();
  const fallback = (op.code || "").trim();
  return title || fallback || "";
}

function formatPlanCellHtml(op, kanal, rowNumber) {
  if (!op) return "";
  const name = escapeHtml(formatOperationName(op));
  const l = escapeHtml(getDynamicLCode(kanal, rowNumber) || "");
  const t = escapeHtml((op.toolNo || "").trim());

  let html = name;
  if (l) html += ` <span class="plan-l">${l}</span>`;
  if (t) html += ` <span class="plan-t">${t}</span>`;
  return html;
}

function formatSlotTitleText(op, kanal, rowNumber) {
  const name = formatOperationName(op);
  const l = getDynamicLCode(kanal, rowNumber);
  return l ? `${name} ${l}` : name;
}

/* Local storage / import export */
function getSerializableState() {
  return {
    currentKanal: state.currentKanal,
    slots: state.slots,
    library: state.library,
    nextOpId: state.nextOpId,
    activeCategory: state.activeCategory,
    spindleFilter: state.spindleFilter,
    planViewMode: state.planViewMode,
    libraryCollapsed: state.libraryCollapsed,
  };
}

function normalizeOperation(op) {
  return {
    id: op.id || "op_" + Math.random().toString(16).slice(2),
    code: op.code || "",
    title: op.title || "",
    spindle: op.spindle === "SP3" ? "SP3" : "SP4",
    category: ["Außen", "Innen", "Radial", "Axial"].includes(op.category) ? op.category : "Außen",
    doppelhalter: !!op.doppelhalter,
    toolNo: op.toolNo || "",
    toolName: op.toolName || "",
  };
}

function applyLoadedState(raw) {
  if (!raw || typeof raw !== "object") return false;

  const slots = raw.slots || {};
  const lib = Array.isArray(raw.library) ? raw.library : [];

  const newSlots = {
    "1": Array.isArray(slots["1"]) ? [...slots["1"]] : Array(MIN_SLOTS).fill(null),
    "2": Array.isArray(slots["2"]) ? [...slots["2"]] : Array(MIN_SLOTS).fill(null),
  };

  ["1", "2"].forEach((k) => {
    while (newSlots[k].length < MIN_SLOTS) newSlots[k].push(null);
  });

  const newLib = lib.map(normalizeOperation);

  state.currentKanal = raw.currentKanal === "2" ? "2" : "1";
  state.slots = newSlots;
  state.library = newLib;
  state.nextOpId = typeof raw.nextOpId === "number" && raw.nextOpId > 0 ? raw.nextOpId : newLib.length + 1;
  state.activeCategory = raw.activeCategory || "Alle";
  state.spindleFilter = raw.spindleFilter || "ALL";
  state.planViewMode = raw.planViewMode === "EINRICHTE" ? "EINRICHTE" : "PLAN";
  state.libraryCollapsed = !!raw.libraryCollapsed;

  return true;
}

function saveToLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, data: getSerializableState() }));
  } catch (_) {}
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return false;
    return applyLoadedState(parsed.data);
  } catch (_) {
    return false;
  }
}

function touchState() {
  saveToLocal();
}

function exportStateToFile() {
  const payload = { version: 3, exportedAt: new Date().toISOString(), data: getSerializableState() };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `CitiTool_SyncOperator_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function initJsonExportImport() {
  const exportBtn = $("#exportJsonBtn");
  const importBtn = $("#importJsonBtn");
  const fileInput = $("#importFileInput");

  if (exportBtn) exportBtn.addEventListener("click", exportStateToFile);

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const data = parsed && parsed.data ? parsed.data : parsed;
          if (!applyLoadedState(data)) return;
          touchState();
          renderAll();
        } catch (_) {}
      };
      reader.readAsText(file);
    });
  }
}

/* DEFAULT DATA */
const DEFAULT_DATA = {
  currentKanal: "2",
  slots: {
    "1": ["op_1","op_3","op_2","op_26","op_28","op_27","op_5","op_8","op_25","op_14","op_36","op_9","op_4","op_30","op_31","op_27","op_10"],
    "2": ["op_11","op_12","op_13","op_21","op_18","op_22","op_16","op_20","op_32","op_33","op_34","op_35",null,"op_37","op_19","op_15",null]
  },
  library: [
    { id:"op_1", code:"L1101", title:"Planen / Vordrehen", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_2", code:"L1103", title:"Bohren / Ausdrehen Ø20 Ø27 Ø32", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_3", code:"L1102", title:"Außen Schlichten", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_4", code:"L1113", title:"I–Gewinde M26×1", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_5", code:"L1105", title:"Lochkreis Bohren Radial Ø5", spindle:"SP4", category:"Radial", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_6", code:"L0106", title:"A–Nut Stechen Ø43", spindle:"SP3", category:"Radial", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_7", code:"L0107", title:"Lochkreis Entgr. mit Senker Ø6", spindle:"SP3", category:"Radial", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_8", code:"L1108", title:"6–Kant fräsen", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_9", code:"L1112", title:"I–Nut 2×Ø17.9 FertigStechen", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_10", code:"L1117", title:"Y-Abstechen", spindle:"SP4", category:"Axial", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_11", code:"L2101", title:"A– Planen / Vordrehen", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_12", code:"L2102", title:"A– Schlichten", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_13", code:"L2103", title:"I– Freistich Ø16 stechen", spindle:"SP3", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_14", code:"L1110", title:"I– Bohrung Ø13 – Fertig drehen", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_15", code:"L2116", title:"I– Bohrungen Ø5 Bürsten", spindle:"SP4", category:"Innen", doppelhalter:true, toolNo:"", toolName:"" },
    { id:"op_16", code:"L2107", title:"A–Gewinde M40 × 1.5", spindle:"SP3", category:"Außen", doppelhalter:true, toolNo:"", toolName:"" },
    { id:"op_17", code:"L0207", title:"A– Gew – Entgraten / Fräsen", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_18", code:"L2105", title:"A– Bohrungen Ø5 Bürsten", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_19", code:"L2115", title:"A– Gew. Gang Wegfräsen", spindle:"SP4", category:"Außen", doppelhalter:true, toolNo:"", toolName:"" },
    { id:"op_20", code:"L2108", title:"A– Gew. Gang Wegfräsen", spindle:"SP3", category:"Außen", doppelhalter:true, toolNo:"", toolName:"" },
    { id:"op_21", code:"L2104", title:"I– Bohren Ø12.5", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_22", code:"L2106", title:"A_Gewinde_M40×2", spindle:"SP4", category:"Außen", doppelhalter:true, toolNo:"", toolName:"" },
    { id:"op_25", code:"L1109", title:"Bohrungen Ø20 Ø27 Ø32 FertigDrehen", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_26", code:"L1104", title:"N_O_P", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_27", code:"L1106", title:"N_O_P", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_28", code:"L1107", title:"Nute 2xd43 Stechen", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_30", code:"L1113", title:"N_O_P", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_31", code:"L1114", title:"N_O_P", spindle:"SP4", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_32", code:"L2109", title:"N_O_P", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_33", code:"L2110", title:"N_O_P", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_34", code:"L2111", title:"N_O_P", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_35", code:"L2112", title:"N_O_P", spindle:"SP3", category:"Außen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_36", code:"L1111", title:"I-Nut 2xØ17.9 Vorstechen", spindle:"SP4", category:"Innen", doppelhalter:false, toolNo:"", toolName:"" },
    { id:"op_37", code:"L2114", title:"Senker_Lochkreis_Ø5_Entgraten", spindle:"SP4", category:"Radial", doppelhalter:false, toolNo:"", toolName:"" }
  ],
  nextOpId: 38,
  activeCategory: "Außen",
  spindleFilter: "SP4",
  planViewMode: "PLAN",
  libraryCollapsed: false,
};

/* MODAL */
function closeModal() {
  const overlay = $("#modalOverlay");
  if (!overlay) return;
  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
  $("#modalBody").innerHTML = "";
  $("#modalFooter").innerHTML = "";
}

function openModalBase({ title, description }) {
  const overlay = $("#modalOverlay");
  if (!overlay) return;
  $("#modalTitle").textContent = title || "";
  $("#modalDescription").textContent = description || "";
  $("#modalBody").innerHTML = "";
  $("#modalFooter").innerHTML = "";
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

function openInfoModal() {
  openModalBase({
    title: "CitiTool · SyncOperator",
    description: "Programmplan pro Kanal mit Werkzeugzuordnung und Einrichteblatt.",
  });

  $("#modalBody").innerHTML = `
    <p class="text-muted">
      • Klick auf leeren Slot: Operation auswählen oder neue Operation anlegen.<br>
      • Drag & Drop: Library → Slot, Slot → Slot.<br>
      • Programmplan: Operation + L-Code (dynamisch) + T (kleiner).<br>
      • Einrichteblatt: Werkzeugliste oben/unten nach Kanal.
    </p>
  `;

  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "btn-primary";
  ok.textContent = "OK";
  ok.addEventListener("click", closeModal);
  $("#modalFooter").appendChild(ok);
}

function initModalBaseEvents() {
  const overlay = $("#modalOverlay");
  const closeBtn = $("#modalCloseButton");
  const infoBtn = $("#infoButton");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  if (infoBtn) infoBtn.addEventListener("click", openInfoModal);
}

/**
 * Operation editor
 * assignToSlot: если создаём новую из пустого слота → сразу кладём в слот
 */
function openOperationEditor(opId = null, assignToSlot = null) {
  const isEdit = !!opId;
  const existing = isEdit ? getOperationById(opId) : null;
  if (isEdit && !existing) return;

  openModalBase({
    title: isEdit ? "Operation bearbeiten" : "Neue Operation",
    description: "Basis-L, Name, Spindel, Kategorie, Doppelhalter, Werkzeug.",
  });

  const body = $("#modalBody");

  const row1 = document.createElement("div");
  row1.className = "form-row";

  const codeGroup = document.createElement("div");
  codeGroup.className = "form-group form-group--code";
  codeGroup.innerHTML = `<div class="form-label">L-Code (Basis)</div>`;
  const codeInput = document.createElement("input");
  codeInput.className = "field-input";
  codeInput.placeholder = "L1101";
  codeInput.value = existing ? existing.code || "" : "";
  codeGroup.appendChild(codeInput);

  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";
  nameGroup.innerHTML = `<div class="form-label">Name</div>`;
  const nameInput = document.createElement("input");
  nameInput.className = "field-input";
  nameInput.placeholder = "Einstechen";
  nameInput.value = existing ? existing.title || "" : "";
  nameGroup.appendChild(nameInput);

  row1.append(codeGroup, nameGroup);

  const row2 = document.createElement("div");
  row2.className = "form-row";

  const spGroup = document.createElement("div");
  spGroup.className = "form-group";
  spGroup.innerHTML = `<div class="form-label">Spindel</div>`;
  const spSel = document.createElement("select");
  spSel.className = "field-select";
  spSel.innerHTML = `<option value="SP4">SP4</option><option value="SP3">SP3</option>`;
  spSel.value = existing ? existing.spindle : "SP4";
  spGroup.appendChild(spSel);

  const catGroup = document.createElement("div");
  catGroup.className = "form-group";
  catGroup.innerHTML = `<div class="form-label">Kategorie</div>`;
  const catSel = document.createElement("select");
  catSel.className = "field-select";
  catSel.innerHTML = `
    <option value="Außen">Außen Bearbeitung</option>
    <option value="Innen">Innen Bearbeitung</option>
    <option value="Radial">Radial Bearbeitung</option>
    <option value="Axial">Axial</option>
  `;
  catSel.value = existing ? existing.category : "Außen";
  catGroup.appendChild(catSel);

  row2.append(spGroup, catGroup);

  const row3 = document.createElement("div");
  row3.className = "toggle-row";
  const toggle = document.createElement("div");
  toggle.className = "toggle-pill";
  toggle.innerHTML = `<div class="toggle-dot"></div><span>Doppelhalter</span>`;
  if (existing && existing.doppelhalter) toggle.classList.add("active");
  toggle.addEventListener("click", () => toggle.classList.toggle("active"));
  row3.appendChild(toggle);

  const row4 = document.createElement("div");
  row4.className = "form-row";

  const toolNoGroup = document.createElement("div");
  toolNoGroup.className = "form-group form-group--code";
  toolNoGroup.innerHTML = `<div class="form-label">Werkzeug-Nr.</div>`;
  const toolNoInput = document.createElement("input");
  toolNoInput.className = "field-input";
  toolNoInput.placeholder = "T0101";
  toolNoInput.value = existing ? existing.toolNo || "" : "";
  toolNoGroup.appendChild(toolNoInput);

  const toolNameGroup = document.createElement("div");
  toolNameGroup.className = "form-group";
  toolNameGroup.innerHTML = `<div class="form-label">Werkzeug-Name</div>`;
  const toolNameInput = document.createElement("input");
  toolNameInput.className = "field-input";
  toolNameInput.placeholder = "ABSTECHER-2mm-Y";
  toolNameInput.value = existing ? existing.toolName || "" : "";
  toolNameGroup.appendChild(toolNameInput);

  row4.append(toolNoGroup, toolNameGroup);

  body.append(row1, row2, row3, row4);

  const footer = $("#modalFooter");

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-outline";
  cancel.textContent = "Abbrechen";
  cancel.addEventListener("click", closeModal);

  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn-primary";
  save.textContent = isEdit ? "Speichern" : "Anlegen";

  save.addEventListener("click", () => {
    const code = codeInput.value.trim();
    const title = nameInput.value.trim();
    if (!code) return codeInput.focus();
    if (!title) return nameInput.focus();

    const opData = {
      code,
      title,
      spindle: spSel.value,
      category: catSel.value,
      doppelhalter: toggle.classList.contains("active"),
      toolNo: toolNoInput.value.trim(),
      toolName: toolNameInput.value.trim(),
    };

    if (isEdit) {
      Object.assign(existing, opData);
    } else {
      const newOp = { id: "op_" + state.nextOpId++, ...opData };
      state.library.push(newOp);

      if (assignToSlot && assignToSlot.kanal && typeof assignToSlot.index === "number") {
        ensureSlotCount(assignToSlot.kanal, assignToSlot.index + 1);
        state.slots[assignToSlot.kanal][assignToSlot.index] = newOp.id;
      }
    }

    closeModal();
    touchState();
    renderAll();
  });

  footer.append(cancel, save);
}

function openDeleteOperationModal(opId) {
  const op = getOperationById(opId);
  if (!op) return;

  openModalBase({
    title: "Operation löschen",
    description: "Operation wird aus Library und allen Slots entfernt.",
  });

  $("#modalBody").innerHTML = `
    <p>Möchtest du <strong>${escapeHtml(formatOperationLabel(op))}</strong> wirklich löschen?</p>
  `;

  const footer = $("#modalFooter");

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-outline";
  cancel.textContent = "Abbrechen";
  cancel.addEventListener("click", closeModal);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn-outline";
  del.style.borderColor = "rgba(239,68,68,0.3)";
  del.style.color = "#b91c1c";
  del.style.background = "#fef2f2";
  del.innerHTML = `<svg class="icon-svg"><use href="#icon-trash"></use></svg> Löschen`;

  del.addEventListener("click", () => {
    ["1", "2"].forEach((k) => {
      state.slots[k] = state.slots[k].map((id) => (id === opId ? null : id));
    });
    state.library = state.library.filter((x) => x.id !== opId);

    closeModal();
    touchState();
    renderAll();
  });

  footer.append(cancel, del);
}

/* Kanal switcher */
function initKanalSwitcher() {
  const hint = $("#kanalHint");

  const updateHint = () => {
    hint.textContent = state.currentKanal === "1" ? "Revolver oben · Kanal 1" : "Revolver unten · Kanal 2";
  };

  $$("#kanalSwitcher .kanal-option").forEach((el) => {
    el.addEventListener("click", () => {
      const kanal = el.dataset.kanal;
      if (!kanal || kanal === state.currentKanal) return;

      state.currentKanal = kanal;
      $$("#kanalSwitcher .kanal-option").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.kanal === state.currentKanal);
      });

      updateHint();
      touchState();
      renderSlots();
      renderPlan();
      updatePlanViewSwitcherUI();
    });
  });

  updateHint();
}

/* Slots */
function ensureSlotCount(kanal, count) {
  while (state.slots[kanal].length < count) state.slots[kanal].push(null);
}

function onSlotDragEnter(e) { e.preventDefault(); e.stopPropagation(); this.classList.add("drag-over"); }
function onSlotDragOver(e) { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect="move"; this.classList.add("drag-over"); }
function onSlotDragLeave(e) { e.stopPropagation(); this.classList.remove("drag-over"); }

function onSlotDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove("drag-over");

  const raw = e.dataTransfer.getData("text/plain");
  if (!raw) return;

  let payload;
  try { payload = JSON.parse(raw); } catch { return; }

  const targetIndex = Number(this.dataset.index);
  if (Number.isNaN(targetIndex)) return;

  const kanalSlots = state.slots[state.currentKanal];

  if (payload.kind === "op") {
    ensureSlotCount(state.currentKanal, targetIndex + 1);
    kanalSlots[targetIndex] = payload.id;
  } else if (payload.kind === "slot") {
    const fromIndex = Number(payload.index);
    if (Number.isNaN(fromIndex) || fromIndex === targetIndex) return;
    if (fromIndex < 0 || fromIndex >= kanalSlots.length) return;

    const [moved] = kanalSlots.splice(fromIndex, 1);
    kanalSlots.splice(targetIndex, 0, moved);
  } else {
    return;
  }

  touchState();
  renderSlots();
  renderPlan();
  updatePlanViewSwitcherUI();
}

function renderSlots() {
  const list = $("#slotList");
  list.innerHTML = "";

  const kanalSlots = state.slots[state.currentKanal];
  const rowCount = Math.max(MIN_SLOTS, kanalSlots.length);

  for (let i = 0; i < rowCount; i++) {
    const rowNumber = i + 1;

    const row = document.createElement("div");
    row.className = "slot-row";
    row.dataset.index = String(i);

    row.addEventListener("dragover", onSlotDragOver);
    row.addEventListener("dragenter", onSlotDragEnter);
    row.addEventListener("dragleave", onSlotDragLeave);
    row.addEventListener("drop", onSlotDrop);

    const idx = document.createElement("div");
    idx.className = "slot-index";
    idx.textContent = rowNumber;

    const main = document.createElement("div");
    main.className = "slot-main";

    const opId = kanalSlots[i] ?? null;
    const op = opId ? getOperationById(opId) : null;

    if (op) {
      row.classList.add("filled");
      row.setAttribute("draggable", "true");

      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "slot", index: i }));
      });

      const title = document.createElement("div");
      title.className = "slot-title";
      title.textContent = formatSlotTitleText(op, state.currentKanal, rowNumber);
      main.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "slot-meta";

      const toolName = (op.toolName || "").trim();
      if (toolName) {
        const bTool = document.createElement("span");
        bTool.className = "badge badge-tool";
        bTool.textContent = toolName;
        meta.appendChild(bTool);
      }

      const bSp = document.createElement("span");
      bSp.className = "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
      bSp.textContent = op.spindle;

      const bCat = document.createElement("span");
      bCat.className = "badge badge-soft";
      bCat.textContent = op.category;

      meta.append(bSp, bCat);

      if (op.doppelhalter) {
        const bD = document.createElement("span");
        bD.className = "badge badge-tag";
        bD.textContent = "Doppelhalter";
        meta.appendChild(bD);
      }

      main.appendChild(meta);

      row.addEventListener("click", (e) => {
        if (e.target.closest(".slot-actions")) return;
        openOperationEditor(opId);
      });
    } else {
      const p = document.createElement("div");
      p.className = "slot-placeholder";
      p.textContent = "Operation hier ablegen (Drag & Drop oder Klick)";
      main.appendChild(p);

      row.addEventListener("click", () => openSlotOperationPicker(i));
    }

    const actions = document.createElement("div");
    actions.className = "slot-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "icon-button";
    clearBtn.title = "Slot leeren";
    clearBtn.innerHTML = `<svg class="icon-svg"><use href="#icon-trash"></use></svg>`;
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      kanalSlots[i] = null;
      touchState();
      renderSlots();
      renderPlan();
      updatePlanViewSwitcherUI();
    });

    actions.appendChild(clearBtn);

    row.append(idx, main, actions);
    list.appendChild(row);
  }
}

function initAddSlotButton() {
  const btn = $("#addSlotBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.slots[state.currentKanal].push(null);
    touchState();
    renderSlots();
    renderPlan();
    updatePlanViewSwitcherUI();
  });
}

/* Library filters */
function getFilteredOperations() {
  let ops = state.library;

  if (state.activeCategory !== "Alle") ops = ops.filter((op) => op.category === state.activeCategory);

  if (state.spindleFilter === "SP3") ops = ops.filter((op) => op.spindle === "SP3");
  else if (state.spindleFilter === "SP4") ops = ops.filter((op) => op.spindle === "SP4");

  return ops;
}

function renderLibraryFilters() {
  const container = $("#libraryFilters");
  container.innerHTML = "";

  const row1 = document.createElement("div");
  row1.className = "library-filters-row";

  state.categories.forEach((cat) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-pill" + (state.activeCategory === cat ? " active" : "");
    pill.textContent = cat === "Alle" ? "Alle Kategorien" : `${cat} Bearbeitung`;
    pill.addEventListener("click", () => {
      state.activeCategory = cat;
      touchState();
      renderLibraryFilters();
      renderLibraryList();
    });
    row1.appendChild(pill);
  });

  container.appendChild(row1);

  const row2 = document.createElement("div");
  row2.className = "library-spindle-row";

  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = "Spindel:";
  row2.appendChild(label);

  const opts = [
    { v: "ALL", t: "Alle" },
    { v: "SP4", t: "SP4" },
    { v: "SP3", t: "SP3" },
  ];

  opts.forEach((o) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-pill" + (state.spindleFilter === o.v ? " active" : "");
    pill.textContent = o.t;
    pill.addEventListener("click", () => {
      state.spindleFilter = o.v;
      touchState();
      renderLibraryFilters();
      renderLibraryList();
    });
    row2.appendChild(pill);
  });

  container.appendChild(row2);
}

function renderLibraryList() {
  const list = $("#libraryList");
  list.innerHTML = "";

  const ops = getFilteredOperations();
  if (!ops.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "Keine Operationen in dieser Auswahl.";
    list.appendChild(empty);
    return;
  }

  ops.forEach((op) => {
    const card = document.createElement("div");
    card.className = "op-card";
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "op", id: op.id }));
    });

    card.addEventListener("click", () => openOperationEditor(op.id));

    const title = document.createElement("div");
    title.className = "op-title";
    title.textContent = formatOperationLabel(op);

    const footer = document.createElement("div");
    footer.className = "op-footer";

    const meta = document.createElement("div");
    meta.className = "op-meta";

    const bSp = document.createElement("span");
    bSp.className = "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
    bSp.textContent = op.spindle;

    const bCat = document.createElement("span");
    bCat.className = "badge badge-soft";
    bCat.textContent = op.category;

    meta.append(bSp, bCat);

    if (op.doppelhalter) {
      const bD = document.createElement("span");
      bD.className = "badge badge-tag";
      bD.textContent = "Doppelhalter";
      meta.appendChild(bD);
    }

    const toolNo = (op.toolNo || "").trim();
    if (toolNo) {
      const bT = document.createElement("span");
      bT.className = "badge badge-soft";
      bT.textContent = toolNo;
      meta.appendChild(bT);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-button";
    del.title = "Löschen";
    del.innerHTML = `<svg class="icon-svg"><use href="#icon-trash"></use></svg>`;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteOperationModal(op.id);
    });

    footer.append(meta, del);
    card.append(title, footer);
    list.appendChild(card);
  });
}

function initAddOperationButton() {
  const btn = $("#addOpButton");
  if (!btn) return;
  btn.addEventListener("click", () => openOperationEditor(null));
}

/* Slot picker: click empty slot */
function getSlotPickerFilteredOps() {
  let ops = state.library;

  if (state.slotPickerCategory !== "Alle") ops = ops.filter((op) => op.category === state.slotPickerCategory);

  if (state.slotPickerSpindle === "SP3") ops = ops.filter((op) => op.spindle === "SP3");
  else if (state.slotPickerSpindle === "SP4") ops = ops.filter((op) => op.spindle === "SP4");

  return ops;
}

function openSlotOperationPicker(slotIndex) {
  state.slotPickerCategory = "Alle";
  state.slotPickerSpindle = "ALL";

  openModalBase({
    title: "Operation auswählen",
    description: "Wähle eine Operation oder lege eine neue an (direkt in den Slot).",
  });

  const body = $("#modalBody");

  const filters = document.createElement("div");
  filters.className = "library-filters";

  const row1 = document.createElement("div");
  row1.className = "library-filters-row";

  ["Alle", "Außen", "Innen", "Radial", "Axial"].forEach((cat) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-pill" + (state.slotPickerCategory === cat ? " active" : "");
    pill.textContent = cat === "Alle" ? "Alle Kategorien" : `${cat} Bearbeitung`;
    pill.addEventListener("click", () => {
      state.slotPickerCategory = cat;
      renderList();
      updateStyles();
    });
    pill.dataset.cat = cat;
    row1.appendChild(pill);
  });

  const row2 = document.createElement("div");
  row2.className = "library-spindle-row";

  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = "Spindel:";
  row2.appendChild(label);

  [
    { v: "ALL", t: "Alle" },
    { v: "SP4", t: "SP4" },
    { v: "SP3", t: "SP3" },
  ].forEach((o) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-pill" + (state.slotPickerSpindle === o.v ? " active" : "");
    pill.textContent = o.t;
    pill.addEventListener("click", () => {
      state.slotPickerSpindle = o.v;
      renderList();
      updateStyles();
    });
    pill.dataset.sp = o.v;
    row2.appendChild(pill);
  });

  filters.append(row1, row2);

  const list = document.createElement("div");
  list.className = "slot-picker-list";

  body.append(filters, list);

  function updateStyles() {
    filters.querySelectorAll("[data-cat]").forEach((b) => b.classList.toggle("active", b.dataset.cat === state.slotPickerCategory));
    filters.querySelectorAll("[data-sp]").forEach((b) => b.classList.toggle("active", b.dataset.sp === state.slotPickerSpindle));
  }

  function renderList() {
    list.innerHTML = "";
    const ops = getSlotPickerFilteredOps();

    if (!ops.length) {
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = "Keine Operationen für aktuelle Filter.";
      list.appendChild(p);
      return;
    }

    ops.forEach((op) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "op-card";
      btn.style.width = "100%";

      const title = document.createElement("div");
      title.className = "op-title";
      title.textContent = formatOperationLabel(op);

      const footer = document.createElement("div");
      footer.className = "op-footer";

      const meta = document.createElement("div");
      meta.className = "op-meta";

      const bSp = document.createElement("span");
      bSp.className = "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
      bSp.textContent = op.spindle;

      const bCat = document.createElement("span");
      bCat.className = "badge badge-soft";
      bCat.textContent = op.category;

      meta.append(bSp, bCat);

      if (op.doppelhalter) {
        const bD = document.createElement("span");
        bD.className = "badge badge-tag";
        bD.textContent = "Doppelhalter";
        meta.appendChild(bD);
      }

      const toolNo = (op.toolNo || "").trim();
      if (toolNo) {
        const bT = document.createElement("span");
        bT.className = "badge badge-soft";
        bT.textContent = toolNo;
        meta.appendChild(bT);
      }

      footer.appendChild(meta);
      btn.append(title, footer);

      btn.addEventListener("click", () => {
        ensureSlotCount(state.currentKanal, slotIndex + 1);
        state.slots[state.currentKanal][slotIndex] = op.id;
        closeModal();
        touchState();
        renderSlots();
        renderPlan();
        updatePlanViewSwitcherUI();
      });

      list.appendChild(btn);
    });
  }

  updateStyles();
  renderList();

  const footer = $("#modalFooter");

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-outline";
  cancel.textContent = "Abbrechen";
  cancel.addEventListener("click", closeModal);

  const create = document.createElement("button");
  create.type = "button";
  create.className = "btn-primary";
  create.textContent = "Neue Operation anlegen";
  create.addEventListener("click", () => {
    closeModal();
    openOperationEditor(null, { kanal: state.currentKanal, index: slotIndex });
  });

  footer.append(cancel, create);
}

/* Plan view switcher */
function initPlanViewSwitcher() {
  const actions = document.querySelector(".plan-card .section-actions");
  if (!actions) return;

  const container = document.createElement("div");
  container.className = "plan-view-switch";

  const btnPlan = document.createElement("button");
  btnPlan.type = "button";
  btnPlan.className = "plan-view-pill";
  btnPlan.dataset.view = "PLAN";
  btnPlan.textContent = "Programmplan";

  const btnEin = document.createElement("button");
  btnEin.type = "button";
  btnEin.className = "plan-view-pill";
  btnEin.dataset.view = "EINRICHTE";
  btnEin.textContent = "Einrichteblatt";

  container.append(btnPlan, btnEin);
  actions.prepend(container);

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".plan-view-pill");
    if (!btn) return;
    const view = btn.dataset.view;
    if (!view || view === state.planViewMode) return;
    state.planViewMode = view;
    touchState();
    updatePlanViewSwitcherUI();
    renderPlan();
  });

  updatePlanViewSwitcherUI();
}

function updatePlanViewSwitcherUI() {
  document.querySelectorAll(".plan-view-pill").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.planViewMode);
  });
}

/* Einrichteblatt */
function buildEinrichteData() {
  const map = {};

  function addFromKanal(kanal, isOben) {
    const slots = state.slots[kanal] || [];
    for (let i = 0; i < slots.length; i++) {
      const opId = slots[i];
      if (!opId) continue;
      const op = getOperationById(opId);
      if (!op) continue;

      const toolNo = (op.toolNo || "").trim();
      if (!toolNo) continue;

      if (!map[toolNo]) map[toolNo] = { toolNo, oben: "", unten: "" };

      const text = (op.toolName || "").trim() || (op.title || "").trim() || "";
      if (isOben) { if (!map[toolNo].oben) map[toolNo].oben = text; }
      else { if (!map[toolNo].unten) map[toolNo].unten = text; }
    }
  }

  addFromKanal("1", true);
  addFromKanal("2", false);

  const arr = Object.values(map);
  arr.sort((a, b) => {
    const na = a.toolNo.startsWith("T") ? (parseInt(a.toolNo.slice(1), 10) || 999999) : 999999;
    const nb = b.toolNo.startsWith("T") ? (parseInt(b.toolNo.slice(1), 10) || 999999) : 999999;
    if (na !== nb) return na - nb;
    return a.toolNo.localeCompare(b.toolNo);
  });
  return arr;
}

/* Render Plan */
function renderPlan() {
  const table = $("#planTable");
  if (!table) return;
  if (state.planViewMode === "EINRICHTE") renderEinrichteblatt(table);
  else renderProgrammplan(table);
}

function renderProgrammplan(table) {
  const slots1 = state.slots["1"];
  const slots2 = state.slots["2"];
  const rowCount = Math.max(slots1.length, slots2.length, MIN_SLOTS);

  let html = "";
  html += "<thead>";
  html += "<tr>";
  html += '<th class="plan-row-index"></th>';
  html += '<th colspan="2" class="th-group">Kanal 1 · 1000.MPF</th>';
  html += '<th colspan="2" class="th-group kanal-divider">Kanal 2 · 2000.MPF</th>';
  html += "</tr>";
  html += "<tr>";
  html += '<th class="plan-row-index"></th>';
  html += '<th class="sp4-head">Spindel 4</th>';
  html += '<th class="sp3-head">Spindel 3</th>';
  html += '<th class="sp3-head kanal-divider">Spindel 3</th>';
  html += '<th class="sp4-head">Spindel 4</th>';
  html += "</tr>";
  html += "</thead><tbody>";

  for (let i = 0; i < rowCount; i++) {
    const rowNumber = i + 1;

    const op1 = slots1[i] ? getOperationById(slots1[i]) : null;
    const op2 = slots2[i] ? getOperationById(slots2[i]) : null;

    const cell1 = op1 ? formatPlanCellHtml(op1, "1", rowNumber) : "";
    const cell2 = op2 ? formatPlanCellHtml(op2, "2", rowNumber) : "";

    const c1sp4 = op1 && op1.spindle === "SP4" ? cell1 : "";
    const c1sp3 = op1 && op1.spindle === "SP3" ? cell1 : "";

    const c2sp3 = op2 && op2.spindle === "SP3" ? cell2 : "";
    const c2sp4 = op2 && op2.spindle === "SP4" ? cell2 : "";

    html += "<tr>";
    html += `<td class="plan-row-index">${rowNumber}</td>`;
    html += `<td class="plan-cell">${c1sp4}</td>`;
    html += `<td class="plan-cell">${c1sp3}</td>`;
    html += `<td class="plan-cell kanal-divider">${c2sp3}</td>`;
    html += `<td class="plan-cell">${c2sp4}</td>`;
    html += "</tr>";
  }

  html += "</tbody>";
  table.innerHTML = html;
}

function renderEinrichteblatt(table) {
  const data = buildEinrichteData();

  let html = "";
  html += "<thead>";
  html += "<tr>";
  html += '<th class="plan-row-index">T (K1)</th>';
  html += '<th class="sp4-head">Werkzeug · Revolver oben (Kanal 1)</th>';
  html += '<th class="plan-row-index kanal-divider">T (K2)</th>';
  html += '<th class="sp3-head">Werkzeug · Revolver unten (Kanal 2)</th>';
  html += "</tr>";
  html += "</thead><tbody>";

  if (!data.length) {
    html += '<tr><td colspan="4" class="plan-cell">Keine Werkzeugdaten vorhanden.</td></tr>';
  } else {
    data.forEach((row) => {
      const t1 = row.oben ? escapeHtml(row.toolNo) : "";
      const t2 = row.unten ? escapeHtml(row.toolNo) : "";
      html += "<tr>";
      html += `<td class="plan-row-index">${t1}</td>`;
      html += `<td class="plan-cell">${escapeHtml(row.oben || "")}</td>`;
      html += `<td class="plan-row-index kanal-divider">${t2}</td>`;
      html += `<td class="plan-cell">${escapeHtml(row.unten || "")}</td>`;
      html += "</tr>";
    });
  }

  html += "</tbody>";
  table.innerHTML = html;
}

/* Export PDF */
function initExportButton() {
  const btn = $("#exportPdfBtn");
  if (!btn) return;
  btn.addEventListener("click", () => window.print());
}

/* Render all */
function renderAll() {
  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
  updatePlanViewSwitcherUI();
}

/* INIT */
function init() {
  initPWA();

  const loaded = loadFromLocal();
  if (!loaded) {
    applyLoadedState(DEFAULT_DATA);
    touchState();
  }

  initModalBaseEvents();
  initJsonExportImport();

  initKanalSwitcher();
  initAddSlotButton();
  initAddOperationButton();

  initPlanViewSwitcher();
  initExportButton();

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
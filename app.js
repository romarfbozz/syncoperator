// app.js — CitiTool / SyncOperator (mobile)
// ЦЕЛЫЙ ФАЙЛ, без "find & replace"

/* ================== КОНСТАНТЫ И ДЕФОЛТНЫЕ ДАННЫЕ ================== */

const STORAGE_KEY = "CitiTool_SyncOperator_State_v3";

const PLAN_ROWS = 40;

const SPINDLE_SP4 = "SP4";
const SPINDLE_SP3 = "SP3";

const PLAN_VIEW_PROGRAMMPLAN = "programmplan";
const PLAN_VIEW_EINRICHTE = "einrichteblatt";

// Минималистичная SVG-иконка мусорки
const TRASH_SVG = `
<svg class="icon-svg icon-svg-trash" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M9 3.5a1 1 0 0 1 .94-.66h4.12a1 1 0 0 1 .94.66l.5 1.5H19a.75.75 0 0 1 0 1.5h-1.1l-1.02 12.02A1.75 1.75 0 0 1 15.13 20H8.87a1.75 1.75 0 0 1-1.75-1.48L6.1 6.5H5a.75.75 0 0 1 0-1.5h3.5l.5-1.5Zm1.62 1.5h2.76l-.2-.6h-2.36l-.2.6ZM7.62 6.5l1 11.78a.25.25 0 0 0 .25.22h6.26a.25.25 0 0 0 .25-.22L16.38 6.5H7.62Zm2.13 2.5a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Z" />
</svg>
`;

/** Демо-операции */
const DEFAULT_OPERATION_LIBRARY = [
  {
    id: "op-1",
    name: "Planen / Vordrehen",
    toolNo: "T0101",
    spindle: SPINDLE_SP4,
    category: "Hauptspindel",
    doppelhalter: false
  },
  {
    id: "op-2",
    name: "Bohren / Ausdrehen Ø31.5",
    toolNo: "T0102",
    spindle: SPINDLE_SP4,
    category: "Hauptspindel",
    doppelhalter: false
  },
  {
    id: "op-3",
    name: "Außen Schlichten",
    toolNo: "T0103",
    spindle: SPINDLE_SP4,
    category: "Hauptspindel",
    doppelhalter: false
  },
  {
    id: "op-4",
    name: "A– Planen / Vordrehen",
    toolNo: "T0201",
    spindle: SPINDLE_SP3,
    category: "GegenSpindel",
    doppelhalter: false
  }
];

/* ================== СОСТОЯНИЕ ================== */

let state = {
  zeichnungsnummer: {
    nummer: "231850",
    name: "Gehäuse"
  },
  currentKanal: 1,
  currentPlanView: PLAN_VIEW_PROGRAMMPLAN,
  programmplan: {
    kanal1: [],
    kanal2: []
  },
  operationLibrary: [],
  // Einrichteblatt – инструменты, пока простая структура
  werkzeuge: {
    kanal1: [], // [{row:1, t:"T1", name:"..."}]
    kanal2: []
  }
};

// служебные переменные
let currentEditingOperation = null; // {mode: 'library'|'slot'|'createForSlot', opId/slotId}
let currentPickerTargetSlotId = null;

let dragSlotId = null; // если тащим слот
let dragOpId = null;   // если тащим операцию из библиотеки

/* ================== УТИЛИТЫ ================== */

function generateId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// L-Code: L1{kanal}{rowIndex(2)} → L1115, L1210 …
function computeLCode(kanal, rowIndex) {
  const line = String(rowIndex).padStart(2, "0");
  return `L1${kanal}${line}`;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getCurrentKanalArray() {
  return state.currentKanal === 1
    ? state.programmplan.kanal1
    : state.programmplan.kanal2;
}

function setCurrentKanalArray(arr) {
  if (state.currentKanal === 1) {
    state.programmplan.kanal1 = arr;
  } else {
    state.programmplan.kanal2 = arr;
  }
}

/* ================== LOAD / SAVE ================== */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.operationLibrary = clone(DEFAULT_OPERATION_LIBRARY);
      // авто 5 слотов для обоих каналов
      state.programmplan.kanal1 = createInitialEmptySlots(1);
      state.programmplan.kanal2 = createInitialEmptySlots(2);
      return;
    }
    const parsed = JSON.parse(raw);

    if (parsed.zeichnungsnummer) {
      if (typeof parsed.zeichnungsnummer === "string") {
        state.zeichnungsnummer = { nummer: parsed.zeichnungsnummer, name: "" };
      } else {
        state.zeichnungsnummer = {
          nummer: parsed.zeichnungsnummer.nummer || "",
          name: parsed.zeichnungsnummer.name || ""
        };
      }
    }

    state.programmplan = parsed.programmplan || { kanal1: [], kanal2: [] };
    state.operationLibrary =
      parsed.operationLibrary || clone(DEFAULT_OPERATION_LIBRARY);
    state.werkzeuge = parsed.werkzeuge || { kanal1: [], kanal2: [] };
    state.currentKanal = parsed.currentKanal || 1;
    state.currentPlanView = parsed.currentPlanView || PLAN_VIEW_PROGRAMMPLAN;

    // если план пустой – создаём 5 слотов
    if (!state.programmplan.kanal1 || !state.programmplan.kanal1.length) {
      state.programmplan.kanal1 = createInitialEmptySlots(1);
    }
    if (!state.programmplan.kanal2 || !state.programmplan.kanal2.length) {
      state.programmplan.kanal2 = createInitialEmptySlots(2);
    }
  } catch (e) {
    console.error("Fehler beim Laden state:", e);
    state.operationLibrary = clone(DEFAULT_OPERATION_LIBRARY);
    state.programmplan.kanal1 = createInitialEmptySlots(1);
    state.programmplan.kanal2 = createInitialEmptySlots(2);
  }
}

function saveState() {
  const toSave = {
    zeichnungsnummer: clone(state.zeichnungsnummer),
    programmplan: clone(state.programmplan),
    operationLibrary: clone(state.operationLibrary),
    werkzeuge: clone(state.werkzeuge),
    currentKanal: state.currentKanal,
    currentPlanView: state.currentPlanView
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

/* ================== ИНИЦИАЛЬНЫЕ СЛОТЫ ================== */

function createEmptySlot(kanal, index) {
  return {
    id: generateId(`slot${kanal}`),
    kanal,
    sequenceIndex: index,
    name: "",
    toolNo: "",
    spindle: kanal === 1 ? SPINDLE_SP4 : SPINDLE_SP3, // базово, можно менять
    category: "",
    doppelhalter: false
  };
}

function createInitialEmptySlots(kanal) {
  const arr = [];
  for (let i = 1; i <= 5; i++) {
    arr.push(createEmptySlot(kanal, i));
  }
  return arr;
}

/* ================== RENDER: ZEICHNUNGSNUMMER ================== */

function renderZeichnungsnummer() {
  const el = document.getElementById("drawingNumberText");
  if (!el) return;
  const { nummer, name } = state.zeichnungsnummer;
  const text = [nummer, name].filter(Boolean).join(" ");
  el.textContent = text || "–";
}

/* ================== RENDER: PROGRAMMPLAN (SLOTS) ================== */

function renderSlots() {
  const listEl = document.getElementById("slotList");
  if (!listEl) return;

  listEl.innerHTML = "";
  const arr = getCurrentKanalArray();

  const sorted = [...arr].sort(
    (a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0)
  );

  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i];
    const row = document.createElement("div");
    row.className = "slot-row filled";
    row.draggable = true;
    row.dataset.slotId = slot.id;

    const idxEl = document.createElement("div");
    idxEl.className = "slot-index";
    idxEl.textContent = String(i + 1);

    const mainEl = document.createElement("div");
    mainEl.className = "slot-main";

    const titleEl = document.createElement("div");
    titleEl.className = "slot-title";
    titleEl.textContent = slot.name || "(ohne Bezeichnung)";

    const metaEl = document.createElement("div");
    metaEl.className = "slot-meta";

    if (slot.toolNo) {
      const badgeTool = document.createElement("span");
      badgeTool.className = "badge badge-tool";
      badgeTool.textContent = slot.toolNo;
      metaEl.appendChild(badgeTool);
    }

    if (slot.spindle === SPINDLE_SP4) {
      const badge = document.createElement("span");
      badge.className = "badge badge-sp4";
      badge.textContent = "SP4";
      metaEl.appendChild(badge);
    } else if (slot.spindle === SPINDLE_SP3) {
      const badge = document.createElement("span");
      badge.className = "badge badge-sp3";
      badge.textContent = "SP3";
      metaEl.appendChild(badge);
    }

    if (slot.doppelhalter) {
      const badge = document.createElement("span");
      badge.className = "badge badge-tag";
      badge.textContent = "Doppelhalter";
      metaEl.appendChild(badge);
    }

    mainEl.appendChild(titleEl);
    mainEl.appendChild(metaEl);

    const actionsEl = document.createElement("div");
    actionsEl.className = "slot-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-button";
    editBtn.innerHTML = "✎";
    editBtn.title = "Operation bearbeiten";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openOperationEditorForSlot(slot.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-button";
    deleteBtn.innerHTML = TRASH_SVG;
    deleteBtn.title = "Operation entfernen";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSlot(slot.id);
    });

    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(deleteBtn);

    row.appendChild(idxEl);
    row.appendChild(mainEl);
    row.appendChild(actionsEl);

    // клик по строке – окно выбора операции
    row.addEventListener("click", () => {
      openOperationPicker(slot.id);
    });

    // drag&drop слотов и операций
    row.addEventListener("dragstart", onSlotDragStart);
    row.addEventListener("dragover", onSlotDragOver);
    row.addEventListener("dragleave", onSlotDragLeave);
    row.addEventListener("drop", onSlotDrop);

    listEl.appendChild(row);
  }

  // кнопка "+ Weitere Zeile"
  const addBtn = document.getElementById("addSlotBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      const arrNow = getCurrentKanalArray();
      const newSlot = createEmptySlot(state.currentKanal, arrNow.length + 1);
      arrNow.push(newSlot);
      setCurrentKanalArray(arrNow);
      saveState();
      renderSlots();
      renderPlan();
      openOperationPicker(newSlot.id);
    };
  }
}

function deleteSlot(slotId) {
  let arr = getCurrentKanalArray();
  arr = arr.filter((s) => s.id !== slotId);
  arr.forEach((s, i) => (s.sequenceIndex = i + 1));
  setCurrentKanalArray(arr);
  saveState();
  renderSlots();
  renderPlan();
}

/* ================== DRAG & DROP СЛОТОВ + ОПЕРАЦИЙ ================== */

function onSlotDragStart(e) {
  const slotId = e.currentTarget.dataset.slotId;
  dragSlotId = slotId;
  dragOpId = null;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/slotId", slotId);
}

function onSlotDragOver(e) {
  e.preventDefault();
  const row = e.currentTarget;
  row.classList.add("drag-over");
}

function onSlotDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function onSlotDrop(e) {
  e.preventDefault();
  const targetRow = e.currentTarget;
  targetRow.classList.remove("drag-over");
  const targetSlotId = targetRow.dataset.slotId;
  if (!targetSlotId) return;

  // тянули операцию из библиотеки
  if (dragOpId) {
    const op = state.operationLibrary.find((o) => o.id === dragOpId);
    if (!op) {
      dragOpId = null;
      return;
    }
    let arr = getCurrentKanalArray();
    const idx = arr.findIndex((s) => s.id === targetSlotId);
    if (idx === -1) {
      dragOpId = null;
      return;
    }
    arr[idx] = {
      ...arr[idx],
      name: op.name,
      toolNo: op.toolNo,
      spindle: op.spindle || SPINDLE_SP4,
      category: op.category || "",
      doppelhalter: !!op.doppelhalter
    };
    setCurrentKanalArray(arr);
    saveState();
    renderSlots();
    renderPlan();
    dragOpId = null;
    dragSlotId = null;
    return;
  }

  // тянули сам слот
  if (!dragSlotId || dragSlotId === targetSlotId) {
    dragSlotId = null;
    return;
  }

  let arr = getCurrentKanalArray();
  const fromIndex = arr.findIndex((s) => s.id === dragSlotId);
  const toIndex = arr.findIndex((s) => s.id === targetSlotId);
  if (fromIndex === -1 || toIndex === -1) {
    dragSlotId = null;
    return;
  }

  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  arr.forEach((s, i) => (s.sequenceIndex = i + 1));
  setCurrentKanalArray(arr);
  saveState();
  renderSlots();
  renderPlan();
  dragSlotId = null;
}

/* ================== PLAN – KANAL / SPINDEL ================== */

function renderPlan() {
  const table = document.getElementById("planTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (state.currentPlanView === PLAN_VIEW_PROGRAMMPLAN) {
    renderPlanProgrammplan(tbody);
  } else {
    renderPlanEinrichteblatt(tbody);
  }
}

// План по слотам (Programmplan)
function renderPlanProgrammplan(tbody) {
  for (let rowIndex = 1; rowIndex <= PLAN_ROWS; rowIndex++) {
    const tr = document.createElement("tr");

    const idxTd = document.createElement("td");
    idxTd.className = "plan-row-index";
    idxTd.textContent = String(rowIndex);
    tr.appendChild(idxTd);

    const cellConfigs = [
      { kanal: 1, spindle: SPINDLE_SP4 },
      { kanal: 1, spindle: SPINDLE_SP3 },
      { kanal: 2, spindle: SPINDLE_SP3 },
      { kanal: 2, spindle: SPINDLE_SP4 }
    ];

    for (const cfg of cellConfigs) {
      const td = document.createElement("td");
      td.className = "plan-cell";

      const op = findOperationForPlanCell(cfg.kanal, cfg.spindle, rowIndex);
      if (op) {
        const lCode = computeLCode(cfg.kanal, rowIndex);
        const name = op.name || "(ohne)";
        const tool = op.toolNo || "";
        const text = `${name}  ${tool}  ${lCode}`;
        td.textContent = text.trim();
      } else {
        td.textContent = "";
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

// Einrichteblatt – по инструментам (пока просто T + Name)
function renderPlanEinrichteblatt(tbody) {
  for (let rowIndex = 1; rowIndex <= PLAN_ROWS; rowIndex++) {
    const tr = document.createElement("tr");

    const idxTd = document.createElement("td");
    idxTd.className = "plan-row-index";
    idxTd.textContent = String(rowIndex);
    tr.appendChild(idxTd);

    const rowK1 = state.werkzeuge.kanal1[rowIndex - 1];
    const rowK2 = state.werkzeuge.kanal2[rowIndex - 1];

    // Kanal 1 – две ячейки (Revolver oben/unten ты можешь дальше разделить)
    const tdK1a = document.createElement("td");
    tdK1a.className = "plan-cell";
    tdK1a.textContent = rowK1 ? `${rowK1.t || ""} ${rowK1.name || ""}`.trim() : "";
    const tdK1b = document.createElement("td");
    tdK1b.className = "plan-cell";
    tdK1b.textContent = ""; // резерв под Standzeit / что захочешь

    // Kanal 2 – две ячейки
    const tdK2a = document.createElement("td");
    tdK2a.className = "plan-cell";
    tdK2a.textContent = rowK2 ? `${rowK2.t || ""} ${rowK2.name || ""}`.trim() : "";
    const tdK2b = document.createElement("td");
    tdK2b.className = "plan-cell";
    tdK2b.textContent = "";

    tr.appendChild(tdK1a);
    tr.appendChild(tdK1b);
    tr.appendChild(tdK2a);
    tr.appendChild(tdK2b);

    tbody.appendChild(tr);
  }

  if (!state.werkzeuge.kanal1.length && !state.werkzeuge.kanal2.length) {
    const trInfo = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "plan-cell";
    td.textContent = "Keine Werkzeugdaten vorhanden.";
    trInfo.appendChild(td);
    tbody.appendChild(trInfo);
  }
}

function findOperationForPlanCell(kanal, spindle, rowIndex) {
  const arr =
    kanal === 1 ? state.programmplan.kanal1 : state.programmplan.kanal2;
  return arr.find(
    (s) => s.sequenceIndex === rowIndex && s.spindle === spindle
  );
}

/* ================== OPERATION LIBRARY ================== */

function renderOperationLibrary() {
  const listEl = document.getElementById("libraryList");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!state.operationLibrary.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "Keine Operationen in der Bibliothek.";
    listEl.appendChild(empty);
    return;
  }

  state.operationLibrary.forEach((op) => {
    const card = document.createElement("div");
    card.className = "op-card";
    card.dataset.opId = op.id;
    card.draggable = true;

    const title = document.createElement("div");
    title.className = "op-title";
    title.textContent = op.name || "(ohne Bezeichnung)";

    const footer = document.createElement("div");
    footer.className = "op-footer";

    const meta = document.createElement("div");
    meta.className = "op-meta";

    if (op.toolNo) {
      const badgeTool = document.createElement("span");
      badgeTool.className = "badge badge-tool";
      badgeTool.textContent = op.toolNo;
      meta.appendChild(badgeTool);
    }

    if (op.spindle === SPINDLE_SP4) {
      const badge = document.createElement("span");
      badge.className = "badge badge-sp4";
      badge.textContent = "SP4";
      meta.appendChild(badge);
    } else if (op.spindle === SPINDLE_SP3) {
      const badge = document.createElement("span");
      badge.className = "badge badge-sp3";
      badge.textContent = "SP3";
      meta.appendChild(badge);
    }

    if (op.doppelhalter) {
      const badge = document.createElement("span");
      badge.className = "badge badge-tag";
      badge.textContent = "Doppelhalter";
      meta.appendChild(badge);
    }

    footer.appendChild(meta);
    card.appendChild(title);
    card.appendChild(footer);

    // клик – редактор операции
    card.addEventListener("click", () => {
      openOperationEditorForLibrary(op.id);
    });

    // dragstart – перетаскиваем в слот
    card.addEventListener("dragstart", (e) => {
      dragOpId = op.id;
      dragSlotId = null;
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("text/opId", op.id);
    });

    listEl.appendChild(card);
  });
}

/* ================== OPERATION EDITOR MODAL ================== */

function getOperationEditorElements() {
  return {
    overlay: document.getElementById("operationModalOverlay"),
    modal: document.getElementById("operationModal"),
    inpName: document.getElementById("opNameInput"),
    inpTool: document.getElementById("opToolInput"),
    selSpindle: document.getElementById("opSpindleSelect"),
    selCategory: document.getElementById("opCategorySelect"),
    chkDoppel: document.getElementById("opDoppelhalter"),
    btnSave: document.getElementById("opSaveBtn"),
    btnCancel: document.getElementById("opCancelBtn"),
    btnDelete: document.getElementById("opDeleteBtn")
  };
}

function openOperationEditorForLibrary(opId) {
  const op = state.operationLibrary.find((o) => o.id === opId);
  if (!op) return;
  currentEditingOperation = { mode: "library", opId };
  showOperationEditor(op);
}

function openOperationEditorForSlot(slotId) {
  const arr = getCurrentKanalArray();
  const slot = arr.find((s) => s.id === slotId);
  if (!slot) return;
  currentEditingOperation = { mode: "slot", slotId };
  showOperationEditor(slot);
}

function openOperationEditorForNewSlot(slotId) {
  const arr = getCurrentKanalArray();
  const slot = arr.find((s) => s.id === slotId);
  if (!slot) return;
  currentEditingOperation = { mode: "createForSlot", slotId };
  showOperationEditor({
    name: "",
    toolNo: "",
    spindle: slot.spindle || SPINDLE_SP4,
    category: "",
    doppelhalter: false
  });
}

function showOperationEditor(data) {
  const {
    overlay,
    modal,
    inpName,
    inpTool,
    selSpindle,
    selCategory,
    chkDoppel,
    btnSave,
    btnCancel,
    btnDelete
  } = getOperationEditorElements();
  if (!overlay || !modal) return;

  inpName.value = data.name || "";
  inpTool.value = data.toolNo || "";
  if (selSpindle) selSpindle.value = data.spindle || SPINDLE_SP4;
  if (selCategory) selCategory.value = data.category || "";
  if (chkDoppel) chkDoppel.checked = !!data.doppelhalter;

  overlay.style.display = "flex";

  btnSave.onclick = () => {
    const updated = {
      name: inpName.value.trim(),
      toolNo: inpTool.value.trim(),
      spindle: selSpindle ? selSpindle.value : SPINDLE_SP4,
      category: selCategory ? selCategory.value : "",
      doppelhalter: chkDoppel ? chkDoppel.checked : false
    };
    applyOperationEditorSave(updated);
    hideOperationEditor();
  };

  btnCancel.onclick = () => {
    hideOperationEditor();
  };

  if (btnDelete) {
    btnDelete.onclick = () => {
      applyOperationEditorDelete();
      hideOperationEditor();
    };
  }
}

function hideOperationEditor() {
  const { overlay } = getOperationEditorElements();
  if (overlay) overlay.style.display = "none";
  currentEditingOperation = null;
}

function applyOperationEditorSave(updated) {
  if (!currentEditingOperation) return;

  if (currentEditingOperation.mode === "library") {
    const idx = state.operationLibrary.findIndex(
      (o) => o.id === currentEditingOperation.opId
    );
    if (idx !== -1) {
      state.operationLibrary[idx] = {
        ...state.operationLibrary[idx],
        ...updated
      };
    }
    saveState();
    renderOperationLibrary();
  } else if (currentEditingOperation.mode === "slot") {
    const arr = getCurrentKanalArray();
    const idx = arr.findIndex((s) => s.id === currentEditingOperation.slotId);
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], ...updated };
      setCurrentKanalArray(arr);
      saveState();
      renderSlots();
      renderPlan();
    }
  } else if (currentEditingOperation.mode === "createForSlot") {
    const newOpId = generateId("op");
    const newOp = {
      id: newOpId,
      ...updated
    };
    state.operationLibrary.push(newOp);

    const arr = getCurrentKanalArray();
    const idx = arr.findIndex((s) => s.id === currentEditingOperation.slotId);
    if (idx !== -1) {
      arr[idx] = {
        ...arr[idx],
        name: updated.name,
        toolNo: updated.toolNo,
        spindle: updated.spindle,
        category: updated.category,
        doppelhalter: updated.doppelhalter
      };
      setCurrentKanalArray(arr);
    }

    saveState();
    renderOperationLibrary();
    renderSlots();
    renderPlan();
  }
}

function applyOperationEditorDelete() {
  if (!currentEditingOperation) return;

  if (currentEditingOperation.mode === "library") {
    const id = currentEditingOperation.opId;
    state.operationLibrary = state.operationLibrary.filter((o) => o.id !== id);
    saveState();
    renderOperationLibrary();
  } else if (currentEditingOperation.mode === "slot") {
    deleteSlot(currentEditingOperation.slotId);
  }
}

/* ================== OPERATION PICKER (Operation auswählen) ================== */

function getPickerElements() {
  return {
    overlay: document.getElementById("pickerModalOverlay"),
    modal: document.getElementById("pickerModal"),
    list: document.getElementById("pickerList"),
    btnNew: document.getElementById("pickerNewOpBtn"),
    btnCancel: document.getElementById("pickerCancelBtn")
  };
}

function openOperationPicker(slotId) {
  currentPickerTargetSlotId = slotId;
  const { overlay, list, btnNew, btnCancel } = getPickerElements();
  if (!overlay || !list) return;

  list.innerHTML = "";

  if (!state.operationLibrary.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "Keine Operationen.";
    list.appendChild(empty);
  } else {
    state.operationLibrary.forEach((op) => {
      const card = document.createElement("div");
      card.className = "op-card";
      card.dataset.opId = op.id;

      const title = document.createElement("div");
      title.className = "op-title";
      title.textContent = op.name || "(ohne Bezeichnung)";

      const footer = document.createElement("div");
      footer.className = "op-footer";
      const meta = document.createElement("div");
      meta.className = "op-meta";

      if (op.toolNo) {
        const badgeTool = document.createElement("span");
        badgeTool.className = "badge badge-tool";
        badgeTool.textContent = op.toolNo;
        meta.appendChild(badgeTool);
      }
      if (op.spindle === SPINDLE_SP4) {
        const b = document.createElement("span");
        b.className = "badge badge-sp4";
        b.textContent = "SP4";
        meta.appendChild(b);
      } else if (op.spindle === SPINDLE_SP3) {
        const b = document.createElement("span");
        b.className = "badge badge-sp3";
        b.textContent = "SP3";
        meta.appendChild(b);
      }

      footer.appendChild(meta);
      card.appendChild(title);
      card.appendChild(footer);

      card.addEventListener("click", () => {
        applyPickerSelect(op.id);
        hideOperationPicker();
      });

      list.appendChild(card);
    });
  }

  if (btnNew) {
    btnNew.onclick = () => {
      hideOperationPicker();
      if (currentPickerTargetSlotId) {
        openOperationEditorForNewSlot(currentPickerTargetSlotId);
      }
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => {
      hideOperationPicker();
    };
  }

  overlay.style.display = "flex";
}

function hideOperationPicker() {
  const { overlay } = getPickerElements();
  if (overlay) overlay.style.display = "none";
  currentPickerTargetSlotId = null;
}

function applyPickerSelect(opId) {
  if (!currentPickerTargetSlotId) return;
  const template = state.operationLibrary.find((o) => o.id === opId);
  if (!template) return;

  const arr = getCurrentKanalArray();
  const idx = arr.findIndex((s) => s.id === currentPickerTargetSlotId);
  if (idx === -1) return;

  arr[idx] = {
    ...arr[idx],
    name: template.name,
    toolNo: template.toolNo,
    spindle: template.spindle || SPINDLE_SP4,
    category: template.category || "",
    doppelhalter: !!template.doppelhalter
  };
  setCurrentKanalArray(arr);
  saveState();
  renderSlots();
  renderPlan();
}

/* ================== EXPORT / IMPORT JSON ================== */

function exportJson() {
  const data = {
    zeichnungsnummer: clone(state.zeichnungsnummer),
    programmplan: clone(state.programmplan),
    operationLibrary: clone(state.operationLibrary),
    werkzeuge: clone(state.werkzeuge)
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const { nummer, name } = state.zeichnungsnummer;
  const baseName = [nummer, name].filter(Boolean).join("_") || "CitiTool";
  a.download = `${baseName}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      if (!parsed.zeichnungsnummer) {
        alert("Ungültige Datei: keine Zeichnungsnummer.");
        return;
      }

      if (typeof parsed.zeichnungsnummer === "string") {
        state.zeichnungsnummer = {
          nummer: parsed.zeichnungsnummer,
          name: ""
        };
      } else {
        state.zeichnungsnummer = {
          nummer: parsed.zeichnungsnummer.nummer || "",
          name: parsed.zeichnungsnummer.name || ""
        };
      }

      state.programmplan = parsed.programmplan || { kanal1: [], kanal2: [] };
      state.operationLibrary =
        parsed.operationLibrary || clone(DEFAULT_OPERATION_LIBRARY);
      state.werkzeuge = parsed.werkzeuge || { kanal1: [], kanal2: [] };

      // если после импорта план пустой – создаём 5 слотов
      if (!state.programmplan.kanal1 || !state.programmplan.kanal1.length) {
        state.programmplan.kanal1 = createInitialEmptySlots(1);
      }
      if (!state.programmplan.kanal2 || !state.programmplan.kanal2.length) {
        state.programmplan.kanal2 = createInitialEmptySlots(2);
      }

      saveState();
      renderAll();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Import der JSON-Datei.");
    }
  };
  reader.readAsText(file);
}

/* ================== NEUE ZEICHNUNGSNUMMER ================== */

function newZeichnungsnummerFlow() {
  const nummer = prompt("Neue Zeichnungsnummer (Nummer):", "");
  if (nummer === null) return;
  const name = prompt("Bezeichnung (Name):", "");
  if (name === null) return;

  state.zeichnungsnummer = { nummer: nummer.trim(), name: name.trim() };

  state.programmplan = {
    kanal1: createInitialEmptySlots(1),
    kanal2: createInitialEmptySlots(2)
  };
  state.werkzeuge = { kanal1: [], kanal2: [] };

  saveState();
  renderAll();
}

/* ================== РЕДАКТИРОВАНИЕ ZEICHNUNGSNUMMER ================== */

function editZeichnungsnummerFlow() {
  const current = state.zeichnungsnummer || { nummer: "", name: "" };
  const nummer = prompt("Zeichnungsnummer (Nummer):", current.nummer || "");
  if (nummer === null) return;
  const name = prompt("Bezeichnung (Name):", current.name || "");
  if (name === null) return;

  state.zeichnungsnummer = { nummer: nummer.trim(), name: name.trim() };
  saveState();
  renderZeichnungsnummer();
}

/* ================== KANAL SWITCH ================== */

function initKanalSwitcher() {
  const switcher = document.getElementById("kanalSwitcher");
  if (!switcher) return;
  const buttons = switcher.querySelectorAll("[data-kanal]");
  buttons.forEach((btn) => {
    const kanal = parseInt(btn.dataset.kanal, 10);
    if (kanal === state.currentKanal) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    btn.onclick = () => {
      state.currentKanal = kanal;
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      saveState();
      renderSlots();
      renderPlan();
    };
  });
}

/* ================== PLAN VIEW SWITCH (Programmplan / Einrichteblatt) ================== */

function initPlanViewSwitcher() {
  const btnProg = document.getElementById("planViewProgrammplanBtn");
  const btnEin = document.getElementById("planViewEinrichteBtn");
  if (!btnProg || !btnEin) return;

  function updateButtons() {
    if (state.currentPlanView === PLAN_VIEW_PROGRAMMPLAN) {
      btnProg.classList.add("active");
      btnEin.classList.remove("active");
    } else {
      btnProg.classList.remove("active");
      btnEin.classList.add("active");
    }
  }

  btnProg.onclick = () => {
    state.currentPlanView = PLAN_VIEW_PROGRAMMPLAN;
    saveState();
    updateButtons();
    renderPlan();
  };

  btnEin.onclick = () => {
    state.currentPlanView = PLAN_VIEW_EINRICHTE;
    saveState();
    updateButtons();
    renderPlan();
  };

  updateButtons();
}

/* ================== ИНИЦИАЛИЗАЦИЯ ================== */

function renderAll() {
  renderZeichnungsnummer();
  initKanalSwitcher();
  initPlanViewSwitcher();
  renderSlots();
  renderPlan();
  renderOperationLibrary();
}

function initApp() {
  loadState();

  const exportBtn = document.getElementById("exportJsonBtn");
  if (exportBtn) exportBtn.onclick = exportJson;

  const importBtn = document.getElementById("importJsonBtn");
  const importInput = document.getElementById("importJsonInput");
  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();
    importInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      importInput.value = "";
    };
  }

  const newDrawBtn = document.getElementById("newDrawingBtn");
  if (newDrawBtn) newDrawBtn.onclick = newZeichnungsnummerFlow;

  const editDrawBtn = document.getElementById("editDrawingNumberBtn");
  if (editDrawBtn) editDrawBtn.onclick = editZeichnungsnummerFlow;

  renderAll();
}

document.addEventListener("DOMContentLoaded", initApp);
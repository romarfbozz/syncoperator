// app.js

// ---------- STATE -------------------------------------------------------

const MIN_SLOTS = 5;
const STORAGE_KEY = "CitiTool_SyncOperator_v1";

const state = {
  currentKanal: "1",
  slots: {
    "1": Array(MIN_SLOTS).fill(null),
    "2": Array(MIN_SLOTS).fill(null),
  },
  // operations: {id, code, title, spindle, category, doppelhalter, toolNo, toolName}
  library: [],
  categories: ["Alle", "Außen", "Innen", "Radial", "Axial"],
  activeCategory: "Alle",
  spindleFilter: "ALL", // ALL | SP3 | SP4
  nextOpId: 1,
  // локальные фильтры только для модалки пустого слота
  slotPickerCategory: "Alle",
  slotPickerSpindle: "ALL",
  // режим нижнего блока
  planViewMode: "PLAN", // PLAN | EINRICHTE
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function getOperationById(id) {
  return state.library.find((op) => op.id === id) || null;
}

// Базовый формат: Name L-Code
function formatOperationLabel(op) {
  if (!op) return "";
  const title = (op.title || "").trim();
  const code = (op.code || "").trim();
  if (title && code) return `${title} ${code}`;
  return title || code || "";
}

// ---------- ДИНАМИЧЕСКИЙ L-КОД -----------------------------------------

function getDynamicLCode(kanal, rowNumber) {
  const n = Math.max(1, rowNumber | 0);
  const suffix = String(n).padStart(2, "0");
  let prefix;
  if (kanal === "1") prefix = "L11";
  else if (kanal === "2") prefix = "L21";
  else return null;
  return prefix + suffix;
}

// Формат в слотах/плане: Name L11xx / Name L21xx
function formatOperationLabelDynamic(op, kanal, rowNumber) {
  if (!op) return "";
  const dyn = getDynamicLCode(kanal, rowNumber);
  const title = (op.title || "").trim();
  const fallback = (op.code || "").trim();
  const name = title || fallback;
  if (name && dyn) return `${name} ${dyn}`;
  if (name) return name;
  if (dyn) return dyn;
  return "";
}

// ---------- LOCAL STORAGE / EXPORT / IMPORT -----------------------------

function getSerializableState() {
  return {
    currentKanal: state.currentKanal,
    slots: state.slots,
    library: state.library,
    nextOpId: state.nextOpId,
    activeCategory: state.activeCategory,
    spindleFilter: state.spindleFilter,
    planViewMode: state.planViewMode,
  };
}

function normalizeOperation(op) {
  return {
    id: op.id || "op_" + Math.random().toString(16).slice(2),
    code: op.code || "",
    title: op.title || "",
    spindle: op.spindle === "SP3" ? "SP3" : "SP4",
    category: ["Außen", "Innen", "Radial", "Axial"].includes(op.category)
      ? op.category
      : "Außen",
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

  // гарантируем минимум слотов
  ["1", "2"].forEach((k) => {
    while (newSlots[k].length < MIN_SLOTS) {
      newSlots[k].push(null);
    }
  });

  const newLib = lib.map(normalizeOperation);

  state.currentKanal = raw.currentKanal === "2" ? "2" : "1";
  state.slots = newSlots;
  state.library = newLib;
  state.nextOpId =
    typeof raw.nextOpId === "number" && raw.nextOpId > 0
      ? raw.nextOpId
      : newLib.length + 1;
  state.activeCategory = raw.activeCategory || "Alle";
  state.spindleFilter = raw.spindleFilter || "ALL";
  state.planViewMode =
    raw.planViewMode === "EINRICHTE" || raw.planViewMode === "PLAN"
      ? raw.planViewMode
      : "PLAN";

  return true;
}

function saveToLocal() {
  try {
    const payload = {
      version: 2,
      data: getSerializableState(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore
  }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.data) return false;
    return applyLoadedState(parsed.data);
  } catch (_) {
    return false;
  }
}

function touchState() {
  saveToLocal();
}

function exportStateToFile() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: getSerializableState(),
  };
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

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportStateToFile();
    });
  }

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
          const text = ev.target.result;
          const parsed = JSON.parse(text);
          const data = parsed && parsed.data ? parsed.data : parsed;
          if (!applyLoadedState(data)) return;
          touchState();
          renderSlots();
          renderLibraryFilters();
          renderLibraryList();
          renderPlan();
          updatePlanViewSwitcherUI();
        } catch (_) {
          // ignore
        }
      };
      reader.readAsText(file);
    });
  }
}

// ---------- DEFAULT DATA (твоя последняя версия, без toolNo/toolName) ---

const DEFAULT_DATA = {
  currentKanal: "2",
  slots: {
    "1": [
      "op_1",
      "op_3",
      "op_2",
      "op_26",
      "op_28",
      "op_27",
      "op_5",
      "op_8",
      "op_25",
      "op_14",
      "op_36",
      "op_9",
      "op_4",
      "op_30",
      "op_31",
      "op_27",
      "op_10",
    ],
    "2": [
      "op_11",
      "op_12",
      "op_13",
      "op_21",
      "op_18",
      "op_22",
      "op_16",
      "op_20",
      "op_32",
      "op_33",
      "op_34",
      "op_35",
      null,
      "op_37",
      "op_19",
      "op_15",
      null,
    ],
  },
  library: [
    {
      id: "op_1",
      code: "L1101",
      title: "Planen / Vordrehen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_2",
      code: "L1103",
      title: "Bohren / Ausdrehen Ø20 Ø27 Ø32",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_3",
      code: "L1102",
      title: "Außen Schlichten",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_4",
      code: "L1113",
      title: "I–Gewinde M26×1",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_5",
      code: "L1105",
      title: "Lochkreis Bohren Radial Ø5",
      spindle: "SP4",
      category: "Radial",
      doppelhalter: false,
    },
    {
      id: "op_6",
      code: "L0106",
      title: "A–Nut Stechen Ø43",
      spindle: "SP3",
      category: "Radial",
      doppelhalter: false,
    },
    {
      id: "op_7",
      code: "L0107",
      title: "Lochkreis Entgr. mit Senker Ø6",
      spindle: "SP3",
      category: "Radial",
      doppelhalter: false,
    },
    {
      id: "op_8",
      code: "L1108",
      title: "6–Kant fräsen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_9",
      code: "L1112",
      title: "I–Nut 2×Ø17.9 FertigStechen",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_10",
      code: "L1117",
      title: "Y-Abstechen",
      spindle: "SP4",
      category: "Axial",
      doppelhalter: false,
    },
    {
      id: "op_11",
      code: "L2101",
      title: "A– Planen / Vordrehen",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_12",
      code: "L2102",
      title: "A– Schlichten",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_13",
      code: "L2103",
      title: "I– Freistich Ø16 stechen",
      spindle: "SP3",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_14",
      code: "L1110",
      title: "I– Bohrung Ø13 – Fertig drehen",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_15",
      code: "L2116",
      title: "I– Bohrungen Ø5 Bürsten",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: true,
    },
    {
      id: "op_16",
      code: "L2107",
      title: "A–Gewinde M40 × 1.5",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: true,
    },
    {
      id: "op_17",
      code: "L0207",
      title: "A– Gew – Entgraten / Fräsen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_18",
      code: "L2105",
      title: "A– Bohrungen Ø5 Bürsten",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_19",
      code: "L2115",
      title: "A– Gew. Gang Wegfräsen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: true,
    },
    {
      id: "op_20",
      code: "L2108",
      title: "A– Gew. Gang Wegfräsen",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: true,
    },
    {
      id: "op_21",
      code: "L2104",
      title: "I– Bohren Ø12.5",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_22",
      code: "L2106",
      title: "A_Gewinde_M40×2",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: true,
    },
    {
      id: "op_23",
      code: "L1101",
      title: "Außen Schruppen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_24",
      code: "L2101",
      title: "Einstechen",
      spindle: "SP3",
      category: "Radial",
      doppelhalter: false,
    },
    {
      id: "op_25",
      code: "L1109",
      title: "Bohrungen Ø20 Ø27 Ø32 FertigDrehen",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_26",
      code: "L1104",
      title: "N_O_P",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_27",
      code: "L1106",
      title: "N_O_P",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_28",
      code: "L1107",
      title: "Nute 2xd43 Stechen",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_29",
      code: "L2115",
      title: "N_O_P",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_30",
      code: "L1113",
      title: "N_O_P",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_31",
      code: "L1114",
      title: "N_O_P",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_32",
      code: "L2109",
      title: "N_O_P",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_33",
      code: "L2110",
      title: "N_O_P",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_34",
      code: "L2111",
      title: "N_O_P",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_35",
      code: "L2112",
      title: "N_O_P",
      spindle: "SP3",
      category: "Außen",
      doppelhalter: false,
    },
    {
      id: "op_36",
      code: "L1111",
      title: "I-Nut 2xØ17.9 Vorstechen",
      spindle: "SP4",
      category: "Innen",
      doppelhalter: false,
    },
    {
      id: "op_37",
      code: "L2114",
      title: "Senker_Lochkreis_Ø5_Entgraten",
      spindle: "SP4",
      category: "Radial",
      doppelhalter: false,
    },
    {
      id: "op_38",
      code: "L1116",
      title: "N_O_P",
      spindle: "SP4",
      category: "Außen",
      doppelhalter: false,
    },
  ],
  nextOpId: 39,
  activeCategory: "Außen",
  spindleFilter: "SP4",
  planViewMode: "PLAN",
};

// ---------- MODAL -------------------------------------------------------

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
    description:
      "Programmplan pro Kanal mit Werkzeugzuordnung und Einrichteblatt-Ansicht.",
  });

  const body = $("#modalBody");
  body.innerHTML = `
    <p class="text-muted">
      • Operationen im Programmplan: Name L-Code + Werkzeugname.<br>
      • Werkzeugdaten je Operation: Werkzeug-Nr. (T..) und Werkzeug-Name.<br>
      • Klick auf leeren Slot: Operation aus Liste wählen (mit Filtern).<br>
      • Umschalter unten: Programmplan ↔ Einrichteblatt (Werkzeugübersicht).<br>
      • L-Code im Plan: dynamisch nach Kanal und Zeile (L11xx / L21xx).
    </p>
  `;

  const footer = $("#modalFooter");
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn-primary";
  closeBtn.textContent = "OK";
  closeBtn.addEventListener("click", closeModal);
  footer.appendChild(closeBtn);
}

// единый редактор: create + edit, включая Werkzeug

function openOperationEditor(opId = null) {
  const isEdit = !!opId;
  const existing = isEdit ? getOperationById(opId) : null;

  if (isEdit && !existing) return;

  openModalBase({
    title: isEdit ? "Operation bearbeiten" : "Neue Operation",
    description:
      "L-Code, Name, Spindel, Kategorie, Doppelhalter und Werkzeugdaten.",
  });

  const body = $("#modalBody");

  // Первая строка: L-Code + Name
  const row1 = document.createElement("div");
  row1.className = "form-row";

  const codeGroup = document.createElement("div");
  codeGroup.className = "form-group form-group--code";
  const codeLabel = document.createElement("div");
  codeLabel.className = "form-label";
  codeLabel.textContent = "L-Code (Basis)";
  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.className = "field-input";
  codeInput.placeholder = "L1101";
  codeInput.value = existing ? existing.code || "" : "";
  codeGroup.append(codeLabel, codeInput);

  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";
  const nameLabel = document.createElement("div");
  nameLabel.className = "form-label";
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "field-input";
  nameInput.placeholder = "Einstechen";
  nameInput.value = existing ? existing.title || "" : "";
  nameGroup.append(nameLabel, nameInput);

  row1.append(codeGroup, nameGroup);

  // Вторая строка: Spindel + Kategorie
  const row2 = document.createElement("div");
  row2.className = "form-row";

  const spindleGroup = document.createElement("div");
  spindleGroup.className = "form-group";
  const spindleLabel = document.createElement("div");
  spindleLabel.className = "form-label";
  spindleLabel.textContent = "Spindel";
  const spindleSelect = document.createElement("select");
  spindleSelect.className = "field-select";
  spindleSelect.innerHTML = `
    <option value="SP4">SP4 (grün)</option>
    <option value="SP3">SP3 (blau)</option>
  `;
  spindleSelect.value = existing ? existing.spindle : "SP4";
  spindleGroup.append(spindleLabel, spindleSelect);

  const catGroup = document.createElement("div");
  catGroup.className = "form-group";
  const catLabel = document.createElement("div");
  catLabel.className = "form-label";
  catLabel.textContent = "Kategorie";
  const catSelect = document.createElement("select");
  catSelect.className = "field-select";
  catSelect.innerHTML = `
    <option value="Außen">Außen Bearbeitung</option>
    <option value="Innen">Innen Bearbeitung</option>
    <option value="Radial">Radial Bearbeitung</option>
    <option value="Axial">Axial</option>
  `;
  catSelect.value = existing ? existing.category : "Außen";
  catGroup.append(catLabel, catSelect);

  row2.append(spindleGroup, catGroup);

  // Третья строка: Doppelhalter toggle
  const row3 = document.createElement("div");
  row3.className = "toggle-row";
  const toggle = document.createElement("div");
  toggle.className = "toggle-pill";
  const toggleDot = document.createElement("div");
  toggleDot.className = "toggle-dot";
  const toggleLabel = document.createElement("span");
  toggleLabel.textContent = "Doppelhalter";

  toggle.append(toggleDot, toggleLabel);
  row3.appendChild(toggle);

  const initialDoppel = existing ? !!existing.doppelhalter : false;
  if (initialDoppel) {
    toggle.classList.add("active");
  }

  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
  });

  // Четвёртая строка: Werkzeug-Nr. + Werkzeug-Name
  const row4 = document.createElement("div");
  row4.className = "form-row";

  const toolNoGroup = document.createElement("div");
  toolNoGroup.className = "form-group form-group--code";
  const toolNoLabel = document.createElement("div");
  toolNoLabel.className = "form-label";
  toolNoLabel.textContent = "Werkzeug-Nr.";
  const toolNoInput = document.createElement("input");
  toolNoInput.type = "text";
  toolNoInput.className = "field-input";
  toolNoInput.placeholder = "T11";
  toolNoInput.value = existing ? existing.toolNo || "" : "";
  toolNoGroup.append(toolNoLabel, toolNoInput);

  const toolNameGroup = document.createElement("div");
  toolNameGroup.className = "form-group";
  const toolNameLabel = document.createElement("div");
  toolNameLabel.className = "form-label";
  toolNameLabel.textContent = "Werkzeug-Name";
  const toolNameInput = document.createElement("input");
  toolNameInput.type = "text";
  toolNameInput.className = "field-input";
  toolNameInput.placeholder = "ABSTECHER-2mm-Y";
  toolNameInput.value = existing ? existing.toolName || "" : "";
  toolNameGroup.append(toolNameLabel, toolNameInput);

  row4.append(toolNoGroup, toolNameGroup);

  body.append(row1, row2, row3, row4);

  const footer = $("#modalFooter");

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = isEdit ? "Speichern" : "Anlegen";

  saveBtn.addEventListener("click", () => {
    const code = codeInput.value.trim();
    const title = nameInput.value.trim();
    if (!code) {
      codeInput.focus();
      return;
    }
    if (!title) {
      nameInput.focus();
      return;
    }

    const spindle = spindleSelect.value;
    const category = catSelect.value;
    const doppelhalter = toggle.classList.contains("active");

    const toolNo = toolNoInput.value.trim();
    const toolName = toolNameInput.value.trim();

    if (isEdit) {
      existing.code = code;
      existing.title = title;
      existing.spindle = spindle;
      existing.category = category;
      existing.doppelhalter = doppelhalter;
      existing.toolNo = toolNo;
      existing.toolName = toolName;
    } else {
      const newOp = {
        id: "op_" + state.nextOpId++,
        code,
        title,
        spindle,
        category,
        doppelhalter,
        toolNo,
        toolName,
      };
      state.library.push(newOp);
    }

    closeModal();
    renderLibraryList();
    renderSlots();
    renderPlan();
    updatePlanViewSwitcherUI();
    touchState();
  });

  footer.append(cancelBtn, saveBtn);
}

function openDeleteOperationModal(opId) {
  const op = getOperationById(opId);
  if (!op) return;

  openModalBase({
    title: "Operation löschen",
    description: "Operation wird aus Library und allen Slots entfernt.",
  });

  const body = $("#modalBody");
  body.innerHTML = `
    <p>
      Möchtest du die Operation<br>
      <strong>${formatOperationLabel(op)}</strong><br>
      wirklich löschen?
    </p>
  `;

  const footer = $("#modalFooter");

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", closeModal);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-outline btn-outline-danger";
  deleteBtn.innerHTML =
    '<span class="btn-icon"><svg class="icon-svg"><use href="#icon-trash"></use></svg></span><span>Löschen</span>';
  deleteBtn.addEventListener("click", () => {
    ["1", "2"].forEach((kanal) => {
      state.slots[kanal] = state.slots[kanal].map((id) =>
        id === opId ? null : id
      );
    });

    state.library = state.library.filter((o) => o.id !== opId);

    closeModal();
    renderLibraryList();
    renderSlots();
    renderPlan();
    updatePlanViewSwitcherUI();
    touchState();
  });

  footer.append(cancelBtn, deleteBtn);
}

function initModalBaseEvents() {
  const overlay = $("#modalOverlay");
  const closeBtn = $("#modalCloseButton");
  const infoBtn = $("#infoButton");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  if (infoBtn) {
    infoBtn.addEventListener("click", openInfoModal);
  }
}

// ---------- KANAL SWITCHER ----------------------------------------------

function initKanalSwitcher() {
  const hint = $("#kanalHint");

  const updateHint = () => {
    if (state.currentKanal === "1") {
      hint.textContent = "Revolver oben · Kanal 1";
    } else {
      hint.textContent = "Revolver unten · Kanal 2";
    }
  };

  $$("#kanalSwitcher .kanal-option").forEach((el) => {
    el.addEventListener("click", () => {
      const kanal = el.dataset.kanal;
      if (!kanal || kanal === state.currentKanal) return;

      state.currentKanal = kanal;

      $$("#kanalSwitcher .kanal-option").forEach((opt) => {
        opt.classList.toggle(
          "active",
          opt.dataset.kanal === state.currentKanal
        );
      });

      updateHint();
      renderSlots();
      renderPlan();
      updatePlanViewSwitcherUI();
      touchState();
    });
  });

  updateHint();
}

// ---------- SLOTS (drag + picker + перестановка) ------------------------

function ensureSlotCount(kanal, count) {
  const kanalSlots = state.slots[kanal];
  while (kanalSlots.length < count) {
    kanalSlots.push(null);
  }
}

function renderSlots() {
  const list = $("#slotList");
  list.innerHTML = "";

  const kanalSlots = state.slots[state.currentKanal];
  const rowCount = Math.max(MIN_SLOTS, kanalSlots.length);

  for (let i = 0; i < rowCount; i++) {
    const rowNumber = i + 1;
    const container = document.createElement("div");
    container.className = "slot-row";
    container.dataset.index = String(i);

    container.addEventListener("dragover", onSlotDragOver);
    container.addEventListener("dragenter", onSlotDragEnter);
    container.addEventListener("dragleave", onSlotDragLeave);
    container.addEventListener("drop", onSlotDrop);

    const idx = document.createElement("div");
    idx.className = "slot-index";
    idx.textContent = rowNumber;

    const main = document.createElement("div");
    main.className = "slot-main";

    const opId = kanalSlots[i] ?? null;
    const op = opId ? getOperationById(opId) : null;

    if (op) {
      container.classList.add("filled");
      container.setAttribute("draggable", "true");

      container.addEventListener("dragstart", (e) => {
        const payload = { kind: "slot", index: i };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      });

      const title = document.createElement("div");
      title.className = "slot-title";
      title.textContent = formatOperationLabelDynamic(
        op,
        state.currentKanal,
        rowNumber
      );
      main.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "slot-meta";

      // Название инструмента как бейдж вместо "Kanal X"
      const toolName = (op.toolName || "").trim();
      if (toolName) {
        const toolLabel = document.createElement("span");
        toolLabel.className = "badge badge-tool";
        toolLabel.textContent = toolName;
        meta.appendChild(toolLabel);
      }

      const badgeSp = document.createElement("span");
      badgeSp.className =
        "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
      badgeSp.textContent = op.spindle;

      const badgeCat = document.createElement("span");
      badgeCat.className = "badge badge-soft";
      badgeCat.textContent = op.category;

      meta.append(badgeSp, badgeCat);

      if (op.doppelhalter) {
        const badgeD = document.createElement("span");
        badgeD.className = "badge badge-tag";
        badgeD.textContent = "Doppelhalter";
        meta.appendChild(badgeD);
      }

      main.appendChild(meta);

      container.addEventListener("click", (e) => {
        if (e.target.closest(".slot-actions")) return;
        openOperationEditor(opId);
      });
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "slot-placeholder";
      placeholder.textContent =
        "Operation hier ablegen (Drag & Drop oder Klick)";
      main.appendChild(placeholder);

      container.addEventListener("click", () => {
        openSlotOperationPicker(i);
      });
    }

    const actions = document.createElement("div");
    actions.className = "slot-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "icon-button";
    clearBtn.title = "Slot leeren";
    clearBtn.innerHTML =
      '<svg class="icon-svg"><use href="#icon-trash"></use></svg>';

    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      kanalSlots[i] = null;
      renderSlots();
      renderPlan();
      updatePlanViewSwitcherUI();
      touchState();
    });

    clearBtn.addEventListener("dragover", (e) => e.stopPropagation());
    clearBtn.addEventListener("drop", (e) => e.stopPropagation());

    actions.appendChild(clearBtn);

    container.append(idx, main, actions);
    list.appendChild(container);
  }
}

function onSlotDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.add("drag-over");
}

function onSlotDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
  this.classList.add("drag-over");
}

function onSlotDragLeave(e) {
  e.stopPropagation();
  this.classList.remove("drag-over");
}

function onSlotDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove("drag-over");

  const raw = e.dataTransfer.getData("text/plain");
  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const targetIndex = Number(this.dataset.index);
  if (Number.isNaN(targetIndex)) return;

  const kanalSlots = state.slots[state.currentKanal];

  if (payload.kind === "op") {
    const opId = payload.id;
    if (!opId) return;
    ensureSlotCount(state.currentKanal, targetIndex + 1);
    kanalSlots[targetIndex] = opId;
  } else if (payload.kind === "slot") {
    const fromIndex = Number(payload.index);
    if (
      Number.isNaN(fromIndex) ||
      fromIndex === targetIndex ||
      fromIndex < 0 ||
      fromIndex >= kanalSlots.length
    ) {
      return;
    }
    const [moved] = kanalSlots.splice(fromIndex, 1);
    kanalSlots.splice(targetIndex, 0, moved);
  } else {
    return;
  }

  renderSlots();
  renderPlan();
  updatePlanViewSwitcherUI();
  touchState();
}

function initAddSlotButton() {
  const btn = $("#addSlotBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const kanalSlots = state.slots[state.currentKanal];
    kanalSlots.push(null);
    renderSlots();
    renderPlan();
    updatePlanViewSwitcherUI();
    touchState();
  });
}

// ---------- LIBRARY FILTER HELPERS --------------------------------------

function getFilteredOperations() {
  let ops = state.library;

  if (state.activeCategory !== "Alle") {
    ops = ops.filter((op) => op.category === state.activeCategory);
  }

  if (state.spindleFilter === "SP3") {
    ops = ops.filter((op) => op.spindle === "SP3");
  } else if (state.spindleFilter === "SP4") {
    ops = ops.filter((op) => op.spindle === "SP4");
  }

  return ops;
}

// ---------- LIBRARY ------------------------------------------------------

function renderLibraryFilters() {
  const container = $("#libraryFilters");
  container.innerHTML = "";

  // Row 1: Kategorien
  const row1 = document.createElement("div");
  row1.className = "library-filters-row";

  state.categories.forEach((cat) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className =
      "filter-pill" + (state.activeCategory === cat ? " active" : "");
    pill.textContent =
      cat === "Alle" ? "Alle Kategorien" : `${cat} Bearbeitung`;
    pill.addEventListener("click", () => {
      state.activeCategory = cat;
      renderLibraryFilters();
      renderLibraryList();
      touchState();
    });
    row1.appendChild(pill);
  });

  container.appendChild(row1);

  // Row 2: Spindel Filter
  const row2 = document.createElement("div");
  row2.className = "library-spindle-row";

  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = "Spindel:";
  row2.appendChild(label);

  const spindleOptions = [
    { value: "ALL", label: "Alle" },
    { value: "SP4", label: "SP4 (grün)" },
    { value: "SP3", label: "SP3 (blau)" },
  ];

  spindleOptions.forEach((opt) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className =
      "filter-pill" + (state.spindleFilter === opt.value ? " active" : "");
    pill.textContent = opt.label;
    pill.addEventListener("click", () => {
      state.spindleFilter = opt.value;
      renderLibraryFilters();
      renderLibraryList();
      touchState();
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
    card.dataset.opId = op.id;
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      const payload = { kind: "op", id: op.id };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    });

    card.addEventListener("click", () => {
      openOperationEditor(op.id);
    });

    const title = document.createElement("div");
    title.className = "op-title";
    // В библиотеке: Name L-Code
    title.textContent = formatOperationLabel(op);

    const footer = document.createElement("div");
    footer.className = "op-footer";

    const meta = document.createElement("div");
    meta.className = "op-meta";

    const badgeSp = document.createElement("span");
    badgeSp.className =
      "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
    badgeSp.textContent = op.spindle;

    const badgeCat = document.createElement("span");
    badgeCat.className = "badge badge-soft";
    badgeCat.textContent = op.category;

    meta.append(badgeSp, badgeCat);

    if (op.doppelhalter) {
      const badgeD = document.createElement("span");
      badgeD.className = "badge badge-tag";
      badgeD.textContent = "Doppelhalter";
      meta.appendChild(badgeD);
    }

    // Бейдж Txx, если указан Werkzeug-Nr.
    const toolNo = (op.toolNo || "").trim();
    if (toolNo) {
      const badgeT = document.createElement("span");
      badgeT.className = "badge badge-soft";
      badgeT.textContent = toolNo;
      meta.appendChild(badgeT);
    }

    const btnWrap = document.createElement("div");

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-button";
    delBtn.title = "Löschen";
    delBtn.innerHTML =
      '<svg class="icon-svg"><use href="#icon-trash"></use></svg>';

    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteOperationModal(op.id);
    });

    btnWrap.append(delBtn);
    footer.append(meta, btnWrap);

    card.append(title, footer);
    list.appendChild(card);
  });
}

function initAddOperationButton() {
  const btn = $("#addOpButton");
  if (!btn) return;
  btn.addEventListener("click", () => openOperationEditor(null));
}

// ---------- SLOT PICKER FILTERS -----------------------------------------

function getSlotPickerFilteredOps() {
  let ops = state.library;

  if (state.slotPickerCategory !== "Alle") {
    ops = ops.filter((op) => op.category === state.slotPickerCategory);
  }

  if (state.slotPickerSpindle === "SP3") {
    ops = ops.filter((op) => op.spindle === "SP3");
  } else if (state.slotPickerSpindle === "SP4") {
    ops = ops.filter((op) => op.spindle === "SP4");
  }

  return ops;
}

// ---------- SLOT OPERATION PICKER (модалка для пустых слотов) -----------

function openSlotOperationPicker(slotIndex) {
  state.slotPickerCategory = "Alle";
  state.slotPickerSpindle = "ALL";

  openModalBase({
    title: "Operation auswählen",
    description:
      "Wähle eine Operation aus der Liste. Eigene Kategorie- und Spindel-Filter nur für diesen Slot.",
  });

  const body = $("#modalBody");

  const filtersContainer = document.createElement("div");
  filtersContainer.className = "library-filters";

  // Row 1: Kategorie
  const row1 = document.createElement("div");
  row1.className = "library-filters-row";

  const cats = ["Alle", "Außen", "Innen", "Radial", "Axial"];
  cats.forEach((cat) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className =
      "filter-pill" + (state.slotPickerCategory === cat ? " active" : "");
    pill.textContent =
      cat === "Alle" ? "Alle Kategorien" : `${cat} Bearbeitung`;
    pill.addEventListener("click", () => {
      state.slotPickerCategory = cat;
      renderOpsList();
      updatePickerFilterStyles();
    });
    pill.dataset.slotPickerCat = cat;
    row1.appendChild(pill);
  });

  filtersContainer.appendChild(row1);

  // Row 2: Spindel
  const row2 = document.createElement("div");
  row2.className = "library-spindle-row";

  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = "Spindel:";
  row2.appendChild(label);

  const spindleOptions = [
    { value: "ALL", label: "Alle" },
    { value: "SP4", label: "SP4 (grün)" },
    { value: "SP3", label: "SP3 (blau)" },
  ];

  spindleOptions.forEach((opt) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className =
      "filter-pill" +
      (state.slotPickerSpindle === opt.value ? " active" : "");
    pill.textContent = opt.label;
    pill.dataset.slotPickerSpindle = opt.value;
    pill.addEventListener("click", () => {
      state.slotPickerSpindle = opt.value;
      renderOpsList();
      updatePickerFilterStyles();
    });
    row2.appendChild(pill);
  });

  filtersContainer.appendChild(row2);

  const list = document.createElement("div");
  list.className = "slot-picker-list";

  body.append(filtersContainer, list);

  function updatePickerFilterStyles() {
    // Kategorie
    filtersContainer
      .querySelectorAll("[data-slot-picker-cat]")
      .forEach((el) => {
        const cat = el.dataset.slotPickerCat;
        el.classList.toggle("active", state.slotPickerCategory === cat);
      });
    // Spindel
    filtersContainer
      .querySelectorAll("[data-slot-picker-spindle]")
      .forEach((el) => {
        const v = el.dataset.slotPickerSpindle;
        el.classList.toggle("active", state.slotPickerSpindle === v);
      });
  }

  function renderOpsList() {
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
      // Picker: Name L-Code
      title.textContent = formatOperationLabel(op);

      const footer = document.createElement("div");
      footer.className = "op-footer";

      const meta = document.createElement("div");
      meta.className = "op-meta";

      const badgeSp = document.createElement("span");
      badgeSp.className =
        "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
      badgeSp.textContent = op.spindle;

      const badgeCat = document.createElement("span");
      badgeCat.className = "badge badge-soft";
      badgeCat.textContent = op.category;

      meta.append(badgeSp, badgeCat);

      if (op.doppelhalter) {
        const badgeD = document.createElement("span");
        badgeD.className = "badge badge-tag";
        badgeD.textContent = "Doppelhalter";
        meta.appendChild(badgeD);
      }

      const toolNo = (op.toolNo || "").trim();
      if (toolNo) {
        const badgeT = document.createElement("span");
        badgeT.className = "badge badge-soft";
        badgeT.textContent = toolNo;
        meta.appendChild(badgeT);
      }

      footer.append(meta);

      btn.append(title, footer);

      btn.addEventListener("click", () => {
        ensureSlotCount(state.currentKanal, slotIndex + 1);
        state.slots[state.currentKanal][slotIndex] = op.id;
        closeModal();
        renderSlots();
        renderPlan();
        updatePlanViewSwitcherUI();
        touchState();
      });

      list.appendChild(btn);
    });
  }

  updatePickerFilterStyles();
  renderOpsList();

  const footer = $("#modalFooter");
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", closeModal);
  footer.appendChild(cancelBtn);
}

// ---------- PLAN VIEW SWITCHER (Programmplan / Einrichteblatt) ---------

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

  // вставляем слева от кнопок PDF/JSON
  actions.prepend(container);

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".plan-view-pill");
    if (!btn) return;
    const view = btn.dataset.view;
    if (!view || view === state.planViewMode) return;
    state.planViewMode = view;
    updatePlanViewSwitcherUI();
    renderPlan();
    touchState();
  });

  updatePlanViewSwitcherUI();
}

function updatePlanViewSwitcherUI() {
  const pills = document.querySelectorAll(".plan-view-pill");
  pills.forEach((btn) => {
    const view = btn.dataset.view;
    const active = view === state.planViewMode;
    btn.classList.toggle("active", active);
  });
}

// ---------- PLAN DATA HELPERS -------------------------------------------

function buildEinrichteData() {
  // Словарь по Werkzeug-Nr.
  const map = {};

  function addFromKanal(kanal, isOben) {
    const slots = state.slots[kanal] || [];
    for (let i = 0; i < slots.length; i++) {
      const opId = slots[i];
      if (!opId) continue;
      const op = getOperationById(opId);
      if (!op) continue;

      const toolNo = (op.toolNo || "").trim();
      const toolName = (op.toolName || "").trim();
      if (!toolNo) continue; // без номера не попадает в Einrichteblatt

      if (!map[toolNo]) {
        map[toolNo] = {
          toolNo,
          oben: "",
          unten: "",
        };
      }

      const text = toolName || op.title || "";
      if (isOben) {
        if (!map[toolNo].oben) map[toolNo].oben = text;
      } else {
        if (!map[toolNo].unten) map[toolNo].unten = text;
      }
    }
  }

  // Kanal 1 = Revolver oben, Kanal 2 = unten
  addFromKanal("1", true);
  addFromKanal("2", false);

  const arr = Object.values(map);

  // сортируем по числу после 'T', если возможно
  arr.sort((a, b) => {
    const ta = a.toolNo || "";
    const tb = b.toolNo || "";
    const na =
      ta[0] === "T" ? parseInt(ta.slice(1), 10) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const nb =
      tb[0] === "T" ? parseInt(tb.slice(1), 10) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (na !== nb) return na - nb;
    return ta.localeCompare(tb);
  });

  return arr;
}

// ---------- PLAN (inkl. PDF via Print + Einrichteblatt) -----------------

function renderPlan() {
  const table = $("#planTable");
  if (!table) return;

  if (state.planViewMode === "EINRICHTE") {
    renderEinrichteblatt(table);
  } else {
    renderProgrammplan(table);
  }
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
  // Kanal 1: сперва Spindel 4, потом Spindel 3
  html += '<th class="sp4-head">Spindel 4</th>';
  html += '<th class="sp3-head">Spindel 3</th>';
  // Kanal 2: Sp3, Sp4 с жирной границей перед Sp3
  html += '<th class="sp3-head kanal-divider">Spindel 3</th>';
  html += '<th class="sp4-head">Spindel 4</th>';
  html += "</tr>";
  html += "</thead>";
  html += "<tbody>";

  for (let i = 0; i < rowCount; i++) {
    const rowNumber = i + 1;
    const op1Id = slots1[i] ?? null;
    const op2Id = slots2[i] ?? null;
    const op1 = op1Id ? getOperationById(op1Id) : null;
    const op2 = op2Id ? getOperationById(op2Id) : null;

    const label1 = op1
      ? formatOperationLabelDynamic(op1, "1", rowNumber)
      : "";
    const label2 = op2
      ? formatOperationLabelDynamic(op2, "2", rowNumber)
      : "";

    const c1sp3 = op1 && op1.spindle === "SP3" ? label1 : "";
    const c1sp4 = op1 && op1.spindle === "SP4" ? label1 : "";
    const c2sp3 = op2 && op2.spindle === "SP3" ? label2 : "";
    const c2sp4 = op2 && op2.spindle === "SP4" ? label2 : "";

    html += "<tr>";
    html += `<td class="plan-row-index">${rowNumber}</td>`;
    // Kanal 1: Sp4, Sp3
    html += `<td class="plan-cell">${c1sp4}</td>`;
    html += `<td class="plan-cell">${c1sp3}</td>`;
    // Kanal 2: Sp3 (с жирным разделителем), Sp4
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
  html += '<th class="plan-row-index">T</th>';
  html += '<th class="sp4-head">Werkzeug · Revolver oben (Kanal 1)</th>';
  html += '<th class="sp3-head kanal-divider">Werkzeug · Revolver unten (Kanal 2)</th>';
  html += "</tr>";
  html += "</thead>";
  html += "<tbody>";

  if (!data.length) {
    html += '<tr><td colspan="3" class="plan-cell">Keine Werkzeugdaten vorhanden.</td></tr>';
  } else {
    data.forEach((row) => {
      html += "<tr>";
      html += `<td class="plan-row-index">${row.toolNo || ""}</td>`;
      html += `<td class="plan-cell">${row.oben || ""}</td>`;
      html += `<td class="plan-cell kanal-divider">${row.unten || ""}</td>`;
      html += "</tr>";
    });
  }

  html += "</tbody>";
  table.innerHTML = html;
}

function initExportButton() {
  const btn = $("#exportPdfBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.print();
  });
}

// ---------- INIT --------------------------------------------------------

function init() {
  const loaded = loadFromLocal();
  if (!loaded) {
    applyLoadedState(DEFAULT_DATA);
    touchState();
  }

  initKanalSwitcher();
  initAddSlotButton();
  initAddOperationButton();
  initModalBaseEvents();
  initExportButton();
  initJsonExportImport();
  initPlanViewSwitcher();

  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
  updatePlanViewSwitcherUI();
}

document.addEventListener("DOMContentLoaded", init);
// ---------- STATE -------------------------------------------------------

const MIN_SLOTS = 5;
const STORAGE_KEY = "CitiTool_SyncOperator_v1";

const state = {
  currentKanal: "1",
  slots: {
    "1": Array(MIN_SLOTS).fill(null),
    "2": Array(MIN_SLOTS).fill(null),
  },
  // operations: {id, code, title, spindle, category, doppelhalter}
  library: [],
  categories: ["Alle", "Außen", "Innen", "Radial", "Axial"],
  activeCategory: "Alle",
  nextOpId: 1,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function getOperationById(id) {
  return state.library.find((op) => op.id === id) || null;
}

function formatOperationLabel(op) {
  if (!op) return "";
  const code = (op.code || "").trim();
  const title = (op.title || "").trim();
  if (code && title) return `${code} – ${title}`;
  return code || title;
}

// ---------- LOCAL STORAGE / EXPORT / IMPORT -----------------------------

function getSerializableState() {
  return {
    currentKanal: state.currentKanal,
    slots: state.slots,
    library: state.library,
    nextOpId: state.nextOpId,
    activeCategory: state.activeCategory,
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

  const newLib = lib
    .map((op) => ({
      id: op.id || "op_" + Math.random().toString(16).slice(2),
      code: op.code || "",
      title: op.title || "",
      spindle: op.spindle === "SP3" ? "SP3" : "SP4",
      category: ["Außen", "Innen", "Radial", "Axial"].includes(op.category)
        ? op.category
        : "Außen",
      doppelhalter: !!op.doppelhalter,
    }));

  state.currentKanal = raw.currentKanal === "2" ? "2" : "1";
  state.slots = newSlots;
  state.library = newLib;
  state.nextOpId = typeof raw.nextOpId === "number" && raw.nextOpId > 0
    ? raw.nextOpId
    : newLib.length + 1;
  state.activeCategory = raw.activeCategory || "Alle";

  return true;
}

function saveToLocal() {
  try {
    const payload = {
      version: 1,
      data: getSerializableState(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // игнорируем ошибки хранилища
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
    version: 1,
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
        } catch (_) {
          // битый файл — тихо игнорируем
        }
      };
      reader.readAsText(file);
    });
  }
}

// -------- DEMО: HauptSpindel Kanal 1 + GegenSpindel Kanal 2 -------------

function createDefaultLibrary() {
  const defs = [
    // HauptSpindel Bearbeitung / Kanal 1
    { code: "L0101", title: "Planen / Vordrehen", spindle: "SP4", category: "Außen" },
    { code: "L0102", title: "Bohren / Ausdrehen Ø31.5", spindle: "SP3", category: "Innen" },
    { code: "L0103", title: "Außen Schlichten", spindle: "SP4", category: "Außen" },
    { code: "L0104", title: "A–Gew M26×1", spindle: "SP4", category: "Außen" },
    { code: "L0105", title: "Lochkreis Bohren Radial Ø5", spindle: "SP3", category: "Radial" },
    { code: "L0106", title: "A–Nut Stechen Ø43", spindle: "SP3", category: "Radial" },
    { code: "L0107", title: "Lochkreis Entgr. mit Senker Ø6", spindle: "SP3", category: "Radial" },
    { code: "L0108", title: "6–Kant fräsen", spindle: "SP4", category: "Außen" },
    { code: "L0109", title: "I–Nut 2× Stechen Ø13 +0.04", spindle: "SP3", category: "Innen" },
    { code: "L0110", title: "Y-Abstechen", spindle: "SP4", category: "Axial" },

    // GegenSpindel Bearbeitung / Kanal 2
    { code: "L0201", title: "A– Planen / Vordrehen", spindle: "SP4", category: "Außen" },
    { code: "L0202", title: "A– Schlichten", spindle: "SP4", category: "Außen" },
    { code: "L0203", title: "I– Freistich Ø16 stechen", spindle: "SP3", category: "Innen" },
    { code: "L0204", title: "I– Bohrung Ø13 – Fertig drehen", spindle: "SP3", category: "Innen" },
    { code: "L0205", title: "I– Bohrungen Ø5 Bürsten", spindle: "SP3", category: "Innen" },
    { code: "L0206", title: "A– Gew M40 × 1.5", spindle: "SP4", category: "Außen" },
    { code: "L0207", title: "A– Gew – Entgraten / Fräsen", spindle: "SP4", category: "Außen" },
    { code: "L0208", title: "A– Bohrungen Ø5 Bürsten", spindle: "SP4", category: "Außen" },
    { code: "L0209", title: "A– Gew. Gang Wegfräsen", spindle: "SP4", category: "Außen" },
    { code: "L0210", title: "A– Gew. Gang Wegfräsen", spindle: "SP4", category: "Außen" },
    { code: "L0211", title: "I– Bohren Ø12.5", spindle: "SP3", category: "Innen" },
    { code: "L0212", title: "A– Gew M40 × 2", spindle: "SP4", category: "Außen" },

    // пара старых демо для библиотеки
    { code: "L1101", title: "Außen Schruppen", spindle: "SP4", category: "Außen" },
    { code: "L2101", title: "Einstechen", spindle: "SP3", category: "Radial" },
  ];

  state.library = defs.map((def) => ({
    ...def,
    doppelhalter: false,
    id: "op_" + state.nextOpId++,
  }));

  const ids = state.library.map((o) => o.id);

  // Kanal 1 – первые 10 операций
  const k1 = state.slots["1"];
  for (let i = 0; i < 10; i++) {
    if (i >= k1.length) k1.push(null);
    k1[i] = ids[i] || null;
  }

  // Kanal 2 – следующие 12 операций
  const k2 = state.slots["2"];
  for (let i = 0; i < 12; i++) {
    if (i >= k2.length) k2.push(null);
    k2[i] = ids[10 + i] || null;
  }
}

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
      "Links Programmplan pro Kanal, rechts Operation Library. Unten Plan pro Kanal/Spindel.",
  });

  const body = $("#modalBody");
  body.innerHTML = `
    <p class="text-muted">
      • Klick auf eine Operation öffnet den Editor (L-Code, Name, Spindel, Kategorie, Doppelhalter).<br>
      • Drag &amp; Drop aus der Library auf einen Slot belegt diesen.<br>
      • Programmplan-Slots lassen sich untereinander verschieben (Drag &amp; Drop).<br>
      • SP3 = blau, SP4 = grün.
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

// единый редактор: create + edit, L-Code + Doppelhalter

function openOperationEditor(opId = null) {
  const isEdit = !!opId;
  const existing = isEdit ? getOperationById(opId) : null;

  if (isEdit && !existing) return;

  openModalBase({
    title: isEdit ? "Operation bearbeiten" : "Neue Operation",
    description: "L-Code, Name, Spindel, Kategorie und Doppelhalter.",
  });

  const body = $("#modalBody");

  // Первая строка: L-Code + Name
  const row1 = document.createElement("div");
  row1.className = "form-row";

  const codeGroup = document.createElement("div");
  codeGroup.className = "form-group form-group--code";
  const codeLabel = document.createElement("div");
  codeLabel.className = "form-label";
  codeLabel.textContent = "L-Code";
  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.className = "field-input";
  codeInput.placeholder = "L2101";
  codeInput.value = existing ? (existing.code || "") : "";
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
  nameInput.value = existing ? (existing.title || "") : "";
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

  body.append(row1, row2, row3);

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

    if (isEdit) {
      existing.code = code;
      existing.title = title;
      existing.spindle = spindle;
      existing.category = category;
      existing.doppelhalter = doppelhalter;
    } else {
      const newOp = {
        id: "op_" + state.nextOpId++,
        code,
        title,
        spindle,
        category,
        doppelhalter,
      };
      state.library.push(newOp);
    }

    closeModal();
    renderLibraryList();
    renderSlots();
    renderPlan();
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
      touchState();
    });
  });

  updateHint();
}

// ---------- SLOTS (drag from library + перестановка слотов) -------------

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
    const container = document.createElement("div");
    container.className = "slot-row";
    container.dataset.index = String(i);

    container.addEventListener("dragover", onSlotDragOver);
    container.addEventListener("dragenter", onSlotDragEnter);
    container.addEventListener("dragleave", onSlotDragLeave);
    container.addEventListener("drop", onSlotDrop);

    const idx = document.createElement("div");
    idx.className = "slot-index";
    idx.textContent = i + 1;

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
      title.textContent = formatOperationLabel(op);
      main.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "slot-meta";

      const label = document.createElement("span");
      label.className = "slot-meta-label";
      label.textContent = `Kanal ${state.currentKanal}`;

      const badgeSp = document.createElement("span");
      badgeSp.className =
        "badge " + (op.spindle === "SP4" ? "badge-sp4" : "badge-sp3");
      badgeSp.textContent = op.spindle;

      const badgeCat = document.createElement("span");
      badgeCat.className = "badge badge-soft";
      badgeCat.textContent = op.category;

      meta.append(label, badgeSp, badgeCat);

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
        "Operation hier ablegen (Drag & Drop)";
      main.appendChild(placeholder);
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
      touchState();
    });

    // чтобы кнопка не воровала drop/dnd
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
  touchState();
}

function initAddSlotButton() {
  $("#addSlotBtn").addEventListener("click", () => {
    const kanalSlots = state.slots[state.currentKanal];
    kanalSlots.push(null);
    renderSlots();
    renderPlan();
    touchState();
  });
}

// ---------- LIBRARY ------------------------------------------------------

function renderLibraryFilters() {
  const container = $("#libraryFilters");
  container.innerHTML = "";

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
    container.appendChild(pill);
  });
}

function renderLibraryList() {
  const list = $("#libraryList");
  list.innerHTML = "";

  let ops = state.library;
  if (state.activeCategory !== "Alle") {
    ops = ops.filter((op) => op.category === state.activeCategory);
  }

  if (!ops.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "Keine Operationen in dieser Kategorie.";
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

// ---------- PLAN (inkl. PDF via Print) ----------------------------------

function renderPlan() {
  const table = $("#planTable");
  const slots1 = state.slots["1"];
  const slots2 = state.slots["2"];
  const rowCount = Math.max(slots1.length, slots2.length, MIN_SLOTS);

  let html = "";
  html += "<thead>";
  html += "<tr>";
  html += '<th class="plan-row-index"></th>';
  html += '<th colspan="2" class="th-group">Kanal 1 · 1000.MPF</th>';
  html += '<th colspan="2" class="th-group">Kanal 2 · 2000.MPF</th>';
  html += "</tr>";
  html += "<tr>";
  html += '<th class="plan-row-index"></th>';
  html += '<th class="sp3-head">Spindel 3</th>';
  html += '<th class="sp4-head">Spindel 4</th>';
  html += '<th class="sp3-head">Spindel 3</th>';
  html += '<th class="sp4-head">Spindel 4</th>';
  html += "</tr>";
  html += "</thead>";
  html += "<tbody>";

  for (let i = 0; i < rowCount; i++) {
    const op1Id = slots1[i] ?? null;
    const op2Id = slots2[i] ?? null;
    const op1 = op1Id ? getOperationById(op1Id) : null;
    const op2 = op2Id ? getOperationById(op2Id) : null;

    const label1 = formatOperationLabel(op1);
    const label2 = formatOperationLabel(op2);

    const c1sp3 = op1 && op1.spindle === "SP3" ? label1 : "";
    const c1sp4 = op1 && op1.spindle === "SP4" ? label1 : "";
    const c2sp3 = op2 && op2.spindle === "SP3" ? label2 : "";
    const c2sp4 = op2 && op2.spindle === "SP4" ? label2 : "";

    html += "<tr>";
    html += `<td class="plan-row-index">${i + 1}</td>`;
    html += `<td class="plan-cell">${c1sp3}</td>`;
    html += `<td class="plan-cell">${c1sp4}</td>`;
    html += `<td class="plan-cell">${c2sp3}</td>`;
    html += `<td class="plan-cell">${c2sp4}</td>`;
    html += "</tr>";
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
    createDefaultLibrary();
    touchState();
  }

  initKanalSwitcher();
  initAddSlotButton();
  initAddOperationButton();
  initModalBaseEvents();
  initExportButton();
  initJsonExportImport();
  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
}

document.addEventListener("DOMContentLoaded", init);
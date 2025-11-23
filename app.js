// ---------- STATE -------------------------------------------------------

const MIN_SLOTS = 5;

const state = {
  currentKanal: "1",
  slots: {
    "1": Array(MIN_SLOTS).fill(null),
    "2": Array(MIN_SLOTS).fill(null),
  },
  // operations: {id, code, title, spindle, category}
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

// 5 демо-операций + демо-раскладка
function createDefaultLibrary() {
  const defs = [
    {
      code: "L1101",
      title: "Außen Schruppen",
      spindle: "SP4",
      category: "Außen",
    },
    {
      code: "L1102",
      title: "Innen Schlichten",
      spindle: "SP3",
      category: "Innen",
    },
    {
      code: "L2101",
      title: "Einstechen",
      spindle: "SP3",
      category: "Radial",
    },
    {
      code: "L2104",
      title: "Scheibenfräsen",
      spindle: "SP4",
      category: "Axial",
    },
    {
      code: "L3001",
      title: "Probe Außendurchmesser",
      spindle: "SP3",
      category: "Radial",
    },
  ];

  state.library = defs.map((def) => ({
    ...def,
    id: "op_" + state.nextOpId++,
  }));

  const ids = state.library.map((o) => o.id);

  // Kanal 1
  state.slots["1"][0] = ids[0] || null;
  state.slots["1"][1] = ids[1] || null;
  state.slots["1"][2] = ids[2] || null;
  // Kanal 2
  state.slots["2"][0] = ids[3] || null;
  state.slots["2"][1] = ids[4] || null;
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
    title: "SyncOperator – Info",
    description:
      "Links Slots pro Kanal, rechts Operation Library. Unten Plan pro Kanal/Spindel.",
  });

  const body = $("#modalBody");
  body.innerHTML = `
    <p class="text-muted">
      • Klick auf eine Operation öffnet den Editor (L-Code, Name, Spindel, Kategorie).<br>
      • Drag &amp; Drop aus der Library auf einen Slot belegt diesen.<br>
      • Klick auf belegten Slot öffnet ebenfalls den Editor.<br>
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

// единый редактор: create + edit, с отдельным полем L-Code
function openOperationEditor(opId = null) {
  const isEdit = !!opId;
  const existing = isEdit ? getOperationById(opId) : null;

  if (isEdit && !existing) return;

  openModalBase({
    title: isEdit ? "Operation bearbeiten" : "Neue Operation",
    description: "L-Code, Name, Spindel und Kategorie einstellen.",
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

  body.append(row1, row2);

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

    if (isEdit) {
      existing.code = code;
      existing.title = title;
      existing.spindle = spindle;
      existing.category = category;
    } else {
      const newOp = {
        id: "op_" + state.nextOpId++,
        code,
        title,
        spindle,
        category,
      };
      state.library.push(newOp);
    }

    closeModal();
    renderLibraryList();
    renderSlots();
    renderPlan();
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
    // Remove from slots
    ["1", "2"].forEach((kanal) => {
      state.slots[kanal] = state.slots[kanal].map((id) =>
        id === opId ? null : id
      );
    });

    // Remove from library
    state.library = state.library.filter((o) => o.id !== opId);

    closeModal();
    renderLibraryList();
    renderSlots();
    renderPlan();
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
  const pill = $("#kanalPillBg");
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

      pill.classList.toggle("kanal-2", state.currentKanal === "2");
      updateHint();
      renderSlots();
      renderPlan();
    });
  });

  updateHint();
}

// ---------- SLOTS --------------------------------------------------------

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
      main.appendChild(meta);

      // Клик по заполненному слоту → редактор
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
    });

    actions.appendChild(clearBtn);

    container.append(idx, main, actions);
    list.appendChild(container);
  }
}

function onSlotDragOver(e) {
  e.preventDefault();
  this.classList.add("drag-over");
}

function onSlotDragLeave() {
  this.classList.remove("drag-over");
}

function onSlotDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");
  const opId = e.dataTransfer.getData("text/plain");
  if (!opId) return;

  const idx = Number(this.dataset.index);
  const kanalSlots = state.slots[state.currentKanal];
  ensureSlotCount(state.currentKanal, idx + 1);
  kanalSlots[idx] = opId;

  renderSlots();
  renderPlan();
}

function initAddSlotButton() {
  $("#addSlotBtn").addEventListener("click", () => {
    const kanalSlots = state.slots[state.currentKanal];
    kanalSlots.push(null);
    renderSlots();
    renderPlan();
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

    // Drag & Drop – перенос в слоты
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", op.id);
    });

    // Клик по карточке – открыть редактор
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
    // Браузерный print → пользователь выбирает "Als PDF speichern"
    window.print();
  });
}

// ---------- INIT --------------------------------------------------------

function init() {
  createDefaultLibrary();
  initKanalSwitcher();
  initAddSlotButton();
  initAddOperationButton();
  initModalBaseEvents();
  initExportButton();
  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
}

document.addEventListener("DOMContentLoaded", init);
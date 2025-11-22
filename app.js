// ---------- STATE -------------------------------------------------------

const MIN_SLOTS = 5;

const state = {
  currentKanal: "1",
  slots: {
    "1": Array(MIN_SLOTS).fill(null),
    "2": Array(MIN_SLOTS).fill(null),
  },
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

// 5 демо-операций
function createDefaultLibrary() {
  const defs = [
    {
      name: "L1101 – Außen Schruppen",
      spindle: "SP4",
      category: "Außen",
    },
    {
      name: "L1102 – Innen Schlichten",
      spindle: "SP3",
      category: "Innen",
    },
    {
      name: "L2101 – Einstechen",
      spindle: "SP3",
      category: "Radial",
    },
    {
      name: "L2104 – Scheibenfräsen",
      spindle: "SP4",
      category: "Axial",
    },
    {
      name: "Probe – Außendurchmesser",
      spindle: "SP3",
      category: "Radial",
    },
  ];

  state.library = defs.map((def) => ({
    ...def,
    id: "op_" + state.nextOpId++,
  }));

  // Демо-раскладка в слотах
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
      "Links Slots pro Kanal, rechts Operation Library. Unten wird automatisch der Plan pro Kanal/Spindel aufgebaut.",
  });

  const body = $("#modalBody");
  body.innerHTML = `
    <p class="text-muted">
      • Klick auf eine Operation öffnet den Editor (Name, Spindel, Kategorie).<br>
      • Drag &amp; Drop auf einen Slot belegt diesen.<br>
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

function openEditOperationModal(opId) {
  const op = getOperationById(opId);
  if (!op) return;

  openModalBase({
    title: "Operation bearbeiten",
    description: "Name, Spindel und Kategorie anpassen.",
  });

  const body = $("#modalBody");

  // Name
  const nameGroup = document.createElement("div");
  nameGroup.style.marginBottom = "6px";
  const nameLabel = document.createElement("div");
  nameLabel.textContent = "Name";
  nameLabel.style.fontSize = "11px";
  nameLabel.style.marginBottom = "2px";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "field-input";
  nameInput.value = op.name;
  nameGroup.append(nameLabel, nameInput);

  // Spindle
  const spindleGroup = document.createElement("div");
  spindleGroup.style.marginBottom = "6px";
  const spindleLabel = document.createElement("div");
  spindleLabel.textContent = "Spindel";
  spindleLabel.style.fontSize = "11px";
  spindleLabel.style.marginBottom = "2px";
  const spindleSelect = document.createElement("select");
  spindleSelect.className = "field-select";
  spindleSelect.innerHTML = `
    <option value="SP4">SP4 (grün)</option>
    <option value="SP3">SP3 (blau)</option>
  `;
  spindleSelect.value = op.spindle;
  spindleGroup.append(spindleLabel, spindleSelect);

  // Category
  const catGroup = document.createElement("div");
  catGroup.style.marginBottom = "2px";
  const catLabel = document.createElement("div");
  catLabel.textContent = "Kategorie";
  catLabel.style.fontSize = "11px";
  catLabel.style.marginBottom = "2px";
  const catSelect = document.createElement("select");
  catSelect.className = "field-select";
  catSelect.innerHTML = `
    <option value="Außen">Außen Bearbeitung</option>
    <option value="Innen">Innen Bearbeitung</option>
    <option value="Radial">Radial Bearbeitung</option>
    <option value="Axial">Axial</option>
  `;
  catSelect.value = op.category;
  catGroup.append(catLabel, catSelect);

  body.append(nameGroup, spindleGroup, catGroup);

  const footer = $("#modalFooter");

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "Speichern";
  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    op.name = name;
    op.spindle = spindleSelect.value;
    op.category = catSelect.value;

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
      <strong>${op.name}</strong><br>
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
  deleteBtn.innerHTML = '<span class="btn-icon">🗑</span><span>Löschen</span>';
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
      title.textContent = op.name;
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
    clearBtn.innerHTML = '<span class="btn-icon">🗑</span>';
    clearBtn.addEventListener("click", () => {
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

    // Drag & Drop – только перенос в слоты
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", op.id);
    });

    // Клик по карточке – открыть модалку-редактор (как ты просил)
    card.addEventListener("click", () => {
      openEditOperationModal(op.id);
    });

    const title = document.createElement("div");
    title.className = "op-title";
    title.textContent = op.name;

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
    delBtn.innerHTML = '<span class="btn-icon">🗑</span>';
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

function initAddOperationForm() {
  const form = $("#addOpForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = $("#opNameInput");
    const spindleSelect = $("#opSpindleSelect");
    const categorySelect = $("#opCategorySelect");

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const spindle = spindleSelect.value;
    const category = categorySelect.value;

    state.library.push({
      id: "op_" + state.nextOpId++,
      name,
      spindle,
      category,
    });

    form.reset();
    spindleSelect.value = "SP4";
    categorySelect.value = "Außen";

    renderLibraryList();
  });
}

// ---------- PLAN --------------------------------------------------------

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

    const c1sp3 = op1 && op1.spindle === "SP3" ? op1.name : "";
    const c1sp4 = op1 && op1.spindle === "SP4" ? op1.name : "";
    const c2sp3 = op2 && op2.spindle === "SP3" ? op2.name : "";
    const c2sp4 = op2 && op2.spindle === "SP4" ? op2.name : "";

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

// ---------- INIT --------------------------------------------------------

function init() {
  createDefaultLibrary();
  initKanalSwitcher();
  initAddSlotButton();
  initAddOperationForm();
  initModalBaseEvents();
  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
}

document.addEventListener("DOMContentLoaded", init);

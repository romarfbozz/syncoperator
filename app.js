// app.js

const MIN_SLOTS = 5;
const STORAGE_KEY = "CitiTool_SyncOperator_v1";

const state = {
  currentKanal: "1",
  slots: { "1": Array(MIN_SLOTS).fill(null), "2": Array(MIN_SLOTS).fill(null) },
  library: [],
  categories: ["Alle", "Außen", "Innen", "Radial", "Axial"],
  activeCategory: "Alle",
  spindleFilter: "ALL",
  nextOpId: 1,
  slotPickerCategory: "Alle",
  slotPickerSpindle: "ALL",
  planViewMode: "PLAN",
  libraryCollapsed: false,
  // DESKTOP sidebar
  librarySidebarOpen: false,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOperationById(id) {
  return state.library.find((o) => o.id === id) || null;
}

function formatOperationName(op) {
  return (op.title || "").trim() || (op.code || "").trim() || "";
}

function getDynamicLCode(kanal, row) {
  const n = String(Math.max(1, row | 0)).padStart(2, "0");
  if (kanal === "1") return "L11" + n;
  if (kanal === "2") return "L21" + n;
  return "";
}

function formatPlanCellHtml(op, kanal, row) {
  if (!op) return "";
  const name = escapeHtml(formatOperationName(op));
  const l = escapeHtml(getDynamicLCode(kanal, row));
  const t = escapeHtml((op.toolNo || "").trim());
  let html = name;
  if (l) html += ` <span class="plan-l">${l}</span>`;
  if (t) html += ` <span class="plan-t">${t}</span>`;
  return html;
}

function formatSlotTitleText(op, kanal, row) {
  const name = formatOperationName(op);
  const l = getDynamicLCode(kanal, row);
  return l ? `${name} ${l}` : name;
}

/* ---------- Storage ---------- */

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
    librarySidebarOpen: state.librarySidebarOpen,
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
  state.slots = {
    "1": Array.isArray(slots["1"]) ? [...slots["1"]] : Array(MIN_SLOTS).fill(null),
    "2": Array.isArray(slots["2"]) ? [...slots["2"]] : Array(MIN_SLOTS).fill(null),
  };
  ["1", "2"].forEach((k) => {
    while (state.slots[k].length < MIN_SLOTS) state.slots[k].push(null);
  });

  state.library = Array.isArray(raw.library) ? raw.library.map(normalizeOperation) : [];
  state.nextOpId = typeof raw.nextOpId === "number" ? raw.nextOpId : state.library.length + 1;
  state.currentKanal = raw.currentKanal === "2" ? "2" : "1";
  state.activeCategory = raw.activeCategory || "Alle";
  state.spindleFilter = raw.spindleFilter || "ALL";
  state.planViewMode = raw.planViewMode === "EINRICHTE" ? "EINRICHTE" : "PLAN";
  state.libraryCollapsed = !!raw.libraryCollapsed;
  state.librarySidebarOpen = !!raw.librarySidebarOpen;

  return true;
}

function saveToLocal() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 3, data: getSerializableState() })
    );
  } catch {}
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? applyLoadedState(parsed.data) : false;
  } catch {
    return false;
  }
}

function touchState() {
  saveToLocal();
}

/* ---------- Desktop sidebar ---------- */

function isDesktop() {
  return window.matchMedia("(min-width: 900px)").matches;
}

function applyLibrarySidebarState() {
  const layout = document.querySelector(".layout-main");
  if (!layout) return;
  if (!isDesktop()) {
    layout.classList.remove("lib-open");
    return;
  }
  layout.classList.toggle("lib-open", !!state.librarySidebarOpen);
}

function toggleLibrarySidebar() {
  if (!isDesktop()) return;
  state.librarySidebarOpen = !state.librarySidebarOpen;
  applyLibrarySidebarState();
  touchState();
}

function initLibrarySidebarToggle() {
  const slotsHeader = document.querySelector(".slots-card .section-header");
  if (!slotsHeader) return;

  let actions = slotsHeader.querySelector(".section-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "section-actions";
    slotsHeader.appendChild(actions);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-outline btn-small library-sidebar-toggle";
  btn.textContent = "Library";
  btn.addEventListener("click", toggleLibrarySidebar);

  actions.prepend(btn);

  applyLibrarySidebarState();
  window.addEventListener("resize", applyLibrarySidebarState);
}

/* ---------- UI ---------- */

function initKanalSwitcher() {
  const hint = $("#kanalHint");
  const updateHint = () => {
    hint.textContent =
      state.currentKanal === "1" ? "Revolver oben · Kanal 1" : "Revolver unten · Kanal 2";
  };
  $$("#kanalSwitcher .kanal-option").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.kanal;
      if (!k || k === state.currentKanal) return;
      state.currentKanal = k;
      $$("#kanalSwitcher .kanal-option").forEach((x) =>
        x.classList.toggle("active", x.dataset.kanal === k)
      );
      updateHint();
      touchState();
      renderAll();
    });
  });
  updateHint();
}

function ensureSlotCount(kanal, count) {
  while (state.slots[kanal].length < count) state.slots[kanal].push(null);
}

function renderSlots() {
  const list = $("#slotList");
  list.innerHTML = "";
  const slots = state.slots[state.currentKanal];
  const rows = Math.max(MIN_SLOTS, slots.length);

  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.className = "slot-row";
    row.dataset.index = i;

    const idx = document.createElement("div");
    idx.className = "slot-index";
    idx.textContent = i + 1;

    const main = document.createElement("div");
    main.className = "slot-main";

    const id = slots[i];
    const op = id ? getOperationById(id) : null;

    if (op) {
      row.classList.add("filled");
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "slot", index: i }));
      });

      const title = document.createElement("div");
      title.className = "slot-title";
      title.textContent = formatSlotTitleText(op, state.currentKanal, i + 1);
      main.appendChild(title);
    } else {
      const p = document.createElement("div");
      p.className = "slot-placeholder";
      p.textContent = "Operation hier ablegen (Drag & Drop oder Klick)";
      main.appendChild(p);
      row.addEventListener("click", () => openSlotOperationPicker(i));
    }

    const actions = document.createElement("div");
    actions.className = "slot-actions";
    const clear = document.createElement("button");
    clear.className = "icon-button";
    clear.innerHTML = `<svg class="icon-svg"><use href="#icon-trash"></use></svg>`;
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      slots[i] = null;
      touchState();
      renderAll();
    });
    actions.appendChild(clear);

    row.append(idx, main, actions);
    list.appendChild(row);
  }
}

function getFilteredOperations() {
  let ops = state.library;
  if (state.activeCategory !== "Alle")
    ops = ops.filter((o) => o.category === state.activeCategory);
  if (state.spindleFilter === "SP3") ops = ops.filter((o) => o.spindle === "SP3");
  if (state.spindleFilter === "SP4") ops = ops.filter((o) => o.spindle === "SP4");
  return ops;
}

function renderLibraryFilters() {
  const c = $("#libraryFilters");
  c.innerHTML = "";
  const r1 = document.createElement("div");
  r1.className = "library-filters-row";
  state.categories.forEach((cat) => {
    const b = document.createElement("button");
    b.className = "filter-pill" + (state.activeCategory === cat ? " active" : "");
    b.textContent = cat === "Alle" ? "Alle Kategorien" : `${cat} Bearbeitung`;
    b.onclick = () => {
      state.activeCategory = cat;
      touchState();
      renderLibraryFilters();
      renderLibraryList();
    };
    r1.appendChild(b);
  });
  c.appendChild(r1);
}

function renderLibraryList() {
  const list = $("#libraryList");
  list.innerHTML = "";
  const ops = getFilteredOperations();
  if (!ops.length) {
    const e = document.createElement("div");
    e.className = "library-empty";
    e.textContent = "Keine Operationen.";
    list.appendChild(e);
    return;
  }
  ops.forEach((op) => {
    const card = document.createElement("div");
    card.className = "op-card";
    card.textContent = formatOperationName(op);
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) =>
      e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "op", id: op.id }))
    );
    list.appendChild(card);
  });
}

/* ---------- Plan ---------- */

function renderPlan() {
  const table = $("#planTable");
  if (!table) return;
  if (state.planViewMode === "EINRICHTE") {
    table.innerHTML = "<tbody><tr><td>Einrichteblatt</td></tr></tbody>";
    return;
  }
  const s1 = state.slots["1"];
  const s2 = state.slots["2"];
  const rows = Math.max(s1.length, s2.length, MIN_SLOTS);
  let html = "<tbody>";
  for (let i = 0; i < rows; i++) {
    html += "<tr>";
    html += `<td class="plan-row-index">${i + 1}</td>`;
    const o1 = s1[i] ? getOperationById(s1[i]) : null;
    const o2 = s2[i] ? getOperationById(s2[i]) : null;
    html += `<td class="plan-cell">${o1 ? formatPlanCellHtml(o1, "1", i + 1) : ""}</td>`;
    html += `<td class="plan-cell kanal-divider">${
      o2 ? formatPlanCellHtml(o2, "2", i + 1) : ""
    }</td>`;
    html += "</tr>";
  }
  html += "</tbody>";
  table.innerHTML = html;
}

function renderAll() {
  renderSlots();
  renderLibraryFilters();
  renderLibraryList();
  renderPlan();
}

/* ---------- INIT ---------- */

function init() {
  if (!loadFromLocal()) touchState();
  initKanalSwitcher();
  initLibrarySidebarToggle();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
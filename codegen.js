// codegen.js

const state = {
  activeMpf: "1000", // "1000" | "2000"
  openGroups: new Set(), // group ids that are open
};

const $ = (sel) => document.querySelector(sel);

const DEMO = {
  "1000": {
    label: "1000.MPF",
    groups: [
      {
        id: "k1_g001",
        n: "N240",
        title: '001: Schruppen',
        s: "S4",
        lines: [
          { n: "91", txt: ';Id=019aba5e-72b9-7279-9e48-84a6ab75' },
          { n: "92", txt: '6d5d' },
          { n: "93", txt: 'WAITM(5,1,2)' },
          { n: "94", txt: 'STOPRE' },
          { n: "95", txt: 'IF RG703==105' },
          { n: "96", txt: ' L1101' },
          { n: "97", txt: ' STOPRE' },
          { n: "98", txt: ' RG703=106' },
          { n: "99", txt: 'ELSE' },
          { n: "100", txt: ' ;DUMMY("1101")' },
          { n: "101", txt: 'ENDIF' },
        ],
      },
      {
        id: "k1_g004",
        n: "N530",
        title: '004: Einstich',
        s: "S3",
        lines: [
          { n: "93", txt: ';Id=019a0168-d2d5-760d-af2e-b43d99a1af58' },
          { n: "94", txt: 'WAITM(4,1,2)' },
          { n: "95", txt: 'STOPRE' },
          { n: "96", txt: 'IF RG703==104' },
          { n: "97", txt: ' L1104' },
          { n: "98", txt: ' STOPRE' },
          { n: "99", txt: ' RG703=105' },
          { n: "100", txt: 'ELSE' },
          { n: "101", txt: ' ;DUMMY("1104")' },
          { n: "102", txt: 'ENDIF' },
        ],
      },
    ],
  },

  "2000": {
    label: "2000.MPF",
    groups: [
      {
        id: "k2_g005",
        n: "N620",
        title: '005: Bohr_D13 Kopieren',
        s: "S3",
        lines: [
          { n: "93", txt: ';Id=019aba5e-72b9-7279-9e48-84a6ab75' },
          { n: "94", txt: '6d5d' },
          { n: "95", txt: 'WAITM(5,1,2)' },
          { n: "96", txt: 'STOPRE' },
          { n: "97", txt: 'IF RG703==105' },
          { n: "98", txt: ' L2105' },
          { n: "99", txt: ' STOPRE' },
          { n: "100", txt: ' RG703=106' },
          { n: "101", txt: 'ENDIF' },
        ],
      },
      {
        id: "k2_g006",
        n: "N710",
        title: '006: A-Stechen',
        s: "S4",
        lines: [
          { n: "110", txt: ';Id=019a1111-aaaa-bbbb-cccc-1234567890ab' },
          { n: "111", txt: 'WAITM(4,1,2)' },
          { n: "112", txt: 'STOPRE' },
          { n: "113", txt: 'IF RG703==106' },
          { n: "114", txt: ' L2106' },
          { n: "115", txt: ' STOPRE' },
          { n: "116", txt: ' RG703=107' },
          { n: "117", txt: 'ELSE' },
          { n: "118", txt: ' ;DUMMY("2106")' },
          { n: "119", txt: 'ENDIF' },
        ],
      },
    ],
  },
};

function badgeClassForS(s) {
  const v = String(s || "").toUpperCase().trim();
  if (v === "S3") return "cg-badge cg-badge--s3";
  if (v === "S4") return "cg-badge cg-badge--s4";
  return "cg-badge";
}

function renderSide(listEl, mpfKey, side) {
  const data = DEMO[mpfKey];
  if (!data) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = "";

  // keep it deterministic per side: open state stored by group id
  data.groups.forEach((g) => {
    const wrap = document.createElement("div");
    wrap.className = "cg-group" + (state.openGroups.has(g.id) ? " is-open" : "");
    wrap.dataset.groupId = g.id;

    const head = document.createElement("div");
    head.className = "cg-group-head";
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", state.openGroups.has(g.id) ? "true" : "false");

    const left = document.createElement("div");
    left.className = "cg-group-left";

    const titleRow = document.createElement("div");
    titleRow.className = "cg-group-title";

    const n = document.createElement("div");
    n.className = "cg-n";
    n.textContent = g.n || "";

    const name = document.createElement("div");
    name.className = "cg-name";
    name.textContent = g.title || "(ohne Bezeichnung)";

    titleRow.append(n, name);

    const tags = document.createElement("div");
    tags.className = "cg-tags";

    const bMpf = document.createElement("span");
    bMpf.className = "cg-badge cg-badge--mpf";
    bMpf.textContent = data.label;

    const bS = document.createElement("span");
    bS.className = badgeClassForS(g.s);
    bS.textContent = String(g.s || "").toUpperCase().trim() || "—";

    tags.append(bMpf, bS);

    left.append(titleRow, tags);

    const caret = document.createElement("div");
    caret.className = "cg-caret";
    caret.textContent = "▾";

    head.append(left, caret);

    const body = document.createElement("div");
    body.className = "cg-group-body";

    const lines = document.createElement("div");
    lines.className = "cg-lines";

    (g.lines || []).forEach((ln) => {
      const row = document.createElement("div");
      row.className = "cg-line";

      const lnN = document.createElement("div");
      lnN.className = "cg-line-n";
      lnN.textContent = ln.n || "";

      const lnT = document.createElement("div");
      lnT.className = "cg-line-txt";
      lnT.textContent = ln.txt || "";

      row.append(lnN, lnT);
      lines.appendChild(row);
    });

    body.appendChild(lines);

    function toggle() {
      const open = state.openGroups.has(g.id);
      if (open) state.openGroups.delete(g.id);
      else state.openGroups.add(g.id);

      wrap.classList.toggle("is-open", !open);
      head.setAttribute("aria-expanded", !open ? "true" : "false");
    }

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    wrap.append(head, body);
    listEl.appendChild(wrap);
  });
}

function render() {
  const left = $("#cgListLeft");
  const right = $("#cgListRight");
  const hintLeft = $("#cgPaneHintLeft");
  const hintRight = $("#cgPaneHintRight");

  // left pane shows active MPF, right pane shows the other MPF (split view)
  const mpfLeft = state.activeMpf;
  const mpfRight = state.activeMpf === "1000" ? "2000" : "1000";

  hintLeft.textContent = DEMO[mpfLeft]?.label || "";
  hintRight.textContent = DEMO[mpfRight]?.label || "";

  renderSide(left, mpfLeft, "left");
  renderSide(right, mpfRight, "right");

  document.querySelectorAll(".cg-switch-pill").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.mpf === state.activeMpf);
  });
}

function initSwitch() {
  document.querySelectorAll(".cg-switch-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.mpf;
      if (v !== "1000" && v !== "2000") return;
      if (state.activeMpf === v) return;
      state.activeMpf = v;
      render();
    });
  });
}

function buildPlainTextView() {
  const mpfLeft = state.activeMpf;
  const mpfRight = state.activeMpf === "1000" ? "2000" : "1000";

  function part(mpfKey) {
    const d = DEMO[mpfKey];
    if (!d) return "";
    const out = [];
    out.push(`=== ${d.label} ===`);
    d.groups.forEach((g) => {
      out.push(`${g.n} ${g.title} ${String(g.s || "").toUpperCase()}`.trim());
      (g.lines || []).forEach((ln) => {
        out.push(`${ln.n} ${ln.txt}`.trimEnd());
      });
      out.push("");
    });
    return out.join("\n");
  }

  return [part(mpfLeft), part(mpfRight)].join("\n");
}

function initCopy() {
  const btn = $("#cgCopyBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const text = buildPlainTextView();
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add("is-copied");
      btn.querySelector("span:last-child").textContent = "Copied";
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.querySelector("span:last-child").textContent = "Copy";
      }, 900);
    } catch (_) {
      // silent
    }
  });
}

function init() {
  initSwitch();
  initCopy();

  // open first group on both sides by default for a “wow it works” feel
  const firstK1 = DEMO["1000"]?.groups?.[0]?.id;
  const firstK2 = DEMO["2000"]?.groups?.[0]?.id;
  if (firstK1) state.openGroups.add(firstK1);
  if (firstK2) state.openGroups.add(firstK2);

  render();
}

document.addEventListener("DOMContentLoaded", init);
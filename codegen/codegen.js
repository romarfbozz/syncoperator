// codegen.js — отдельная страница. Ничего в другом модуле не трогает.

// ------------------------------------------------------------
// DEMO: вырезки из твоих 1000.MPF / 2000.MPF после GENERATED_CODE_START
// (первые ~8 операций, чтобы сразу было “как на скрине”)
const DEMO_1000 = `
###_GENERATED_CODE_START_###
GROUP_BEGIN(0,"001: Aussen Schruppen S3",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af58
WAITM(4,1,2)
STOPRE
IF RG703==101
 L1101
 STOPRE
 RG703=102
ELSE
 ;DUMMY("1101")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"002: Bohren Ø12,5 S3",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af59
WAITM(4,1,2)
STOPRE
IF RG703==102
 L1102
 STOPRE
 RG703=103
ELSE
 ;DUMMY("1102")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"003: NOP_OP S4",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af60
WAITM(4,1,2)
STOPRE
IF RG703==103
 L1103
 STOPRE
 RG703=104
ELSE
 ;DUMMY("1103")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"004: Einstich S3",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af58
WAITM(4,1,2)
STOPRE
IF RG703==104
 L1104
 STOPRE
 RG703=105
ELSE
 ;DUMMY("1104")
ENDIF
GROUP_END(0,2)

GROUP_BEGIN(0,"005: Bohr_D13 Kopieren S3",2,0)
;Id=019aba5e-72b9-7279-9e48-84a6ab756d5d
WAITM(5,1,2)
STOPRE
IF RG703==105
 L1105
 STOPRE
 RG703=106
ENDIF
GROUP_END(0,2)

GROUP_BEGIN(0,"006: I-Einstich kopi S4",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af61
WAITM(4,1,2)
STOPRE
IF RG703==106
 L1106
 STOPRE
 RG703=107
ELSE
 ;DUMMY("1106")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"007: A-Gewinde M40x2 S3",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af62
WAITM(4,1,2)
STOPRE
IF RG703==107
 L1107
 STOPRE
 RG703=108
ELSE
 ;DUMMY("1107")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"008: NOP_OP S3",2,0)
;Id=019a0168-d2d5-760d-af2e-b43d99a1af63
WAITM(4,1,2)
STOPRE
IF RG703==108
 L1108
 STOPRE
 RG703=109
ELSE
 ;DUMMY("1108")
ENDIF
GROUP_END(0,1)
`.trim();

const DEMO_2000 = `
###_GENERATED_CODE_START_###
GROUP_BEGIN(0,"001:Schruppen_S4",1,0)
;Id=019a0168-e5b4-7573-8c33-xxxxxxxxxxxx
WAITM(5,1,2)
STOPRE
IF RG703==101
 L2101
 STOPRE
 RG703=102
ELSE
 ;DUMMY("2101")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"002:NOP_OP_S3",1,0)
;Id=019a0168-e5b4-7573-8c33-yyyyyyyyyyyy
WAITM(5,1,2)
STOPRE
IF RG703==102
 L2102
 STOPRE
 RG703=103
ELSE
 ;DUMMY("2102")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"003:Bohren+vord_S3",1,0)
;Id=019a0168-e5b4-7573-8c33-zzzzzzzzzzzz
WAITM(5,1,2)
STOPRE
IF RG703==103
 L2103
 STOPRE
 RG703=104
ELSE
 ;DUMMY("2103")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"004:Stirnfraesen_S4",1,0)
;Id=019a0168-e5b4-7573-8c33-aaaaaaaaaaaa
WAITM(5,1,2)
STOPRE
IF RG703==104
 L2104
 STOPRE
 RG703=105
ELSE
 ;DUMMY("2104")
ENDIF
GROUP_END(0,1)

GROUP_BEGIN(0,"005: Bohr_D13 Kopieren S3",1,0)
;Id=019aba5e-72b9-7279-9e48-84a6ab756d5d
WAITM(5,1,2)
STOPRE
IF RG703==105
 L2105
 STOPRE
 RG703=106
ENDIF
GROUP_END(0,2)
`.trim();

// ------------------------------------------------------------

const state = {
  mpf: "1000",
  parsed: {
    "1000": [],
    "2000": [],
  },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseGroups(mpfText) {
  const lines = mpfText.split(/\r?\n/);
  const startIdx = Math.max(0, lines.findIndex((l) => l.includes("###_GENERATED_CODE_START_###")));
  const src = lines.slice(startIdx).join("\n");

  const out = [];
  const all = src.split(/\r?\n/);

  let i = 0;
  while (i < all.length) {
    const line = all[i];
    if (!line.includes("GROUP_BEGIN")) {
      i++;
      continue;
    }

    const begin = line;
    const titleMatch = begin.match(/GROUP_BEGIN\([^,]*,"([^"]+)"[^)]*\)/);
    const title = (titleMatch ? titleMatch[1] : "Operation").trim();

    let j = i;
    while (j < all.length && !all[j].includes("GROUP_END")) j++;
    if (j < all.length) j++;

    const blockLines = all.slice(i, j);
    const raw = blockLines.join("\n").trim();

    // spindle guess: S3/S4
    const spindle =
      /(^|\W)S3(\W|$)/i.test(title) || /(^|\W)S3(\W|$)/i.test(raw) ? "S3"
      : /(^|\W)S4(\W|$)/i.test(title) || /(^|\W)S4(\W|$)/i.test(raw) ? "S4"
      : "";

    // op number "001:" from title
    const noMatch = title.match(/^(\d{3})\s*:/);
    const opNo = noMatch ? noMatch[1] : "";

    out.push({
      opNo,
      title,
      spindle,
      raw,
      open: false,
    });

    i = j;
  }

  return out;
}

function setMpf(mpf) {
  state.mpf = mpf;

  $$("#opsList").forEach(() => {});
  $$("#mpfTitle").forEach(() => {});

  const title = mpf === "1000" ? "CHAN1 · 1000.MPF" : "CHAN2 · 2000.MPF";
  $("#mpfTitle").textContent = title;

  // buttons UI
  $$(".cg-switch-btn").forEach((b) => {
    const on = b.dataset.mpf === mpf;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  render();
}

function render() {
  const list = $("#opsList");
  list.innerHTML = "";

  const ops = state.parsed[state.mpf] || [];
  if (!ops.length) {
    const empty = document.createElement("div");
    empty.className = "cg-op";
    empty.innerHTML = `
      <div class="cg-op-head">
        <div class="cg-op-left">
          <div class="cg-op-n">---</div>
          <div class="cg-op-title">Keine Gruppen gefunden</div>
        </div>
      </div>
      <div class="cg-op-body" style="display:block;padding:0 12px 12px">
        <pre class="cg-code">Prüfe, ob GROUP_BEGIN/GROUP_END vorhanden sind und ob ###_GENERATED_CODE_START_### existiert.</pre>
      </div>
    `;
    list.appendChild(empty);
    return;
  }

  ops.forEach((op, idx) => {
    const card = document.createElement("div");
    card.className = "cg-op" + (op.open ? " open" : "");

    const nLabel = op.opNo ? `${op.opNo}` : String(idx + 1).padStart(3, "0");
    const spindleBadge = op.spindle
      ? `<span class="cg-badge ${op.spindle === "S3" ? "s3" : "s4"}">${op.spindle}</span>`
      : "";

    card.innerHTML = `
      <div class="cg-op-head" role="button" tabindex="0" aria-expanded="${op.open ? "true" : "false"}">
        <div class="cg-op-left">
          <div class="cg-op-n">N${escapeHtml(nLabel)}</div>
          <div class="cg-op-title">${escapeHtml(op.title)}</div>
        </div>
        <div class="cg-badges">
          ${spindleBadge}
          <div class="cg-caret">${op.open ? "–" : "+"}</div>
        </div>
      </div>
      <div class="cg-op-body">
        <pre class="cg-code">${escapeHtml(op.raw)}</pre>
      </div>
    `;

    const head = card.querySelector(".cg-op-head");
    const toggle = () => {
      op.open = !op.open;
      render();
    };

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    list.appendChild(card);
  });
}

function setAll(open) {
  const ops = state.parsed[state.mpf] || [];
  ops.forEach((o) => (o.open = !!open));
  render();
}

function init() {
  // parse demo
  state.parsed["1000"] = parseGroups(DEMO_1000);
  state.parsed["2000"] = parseGroups(DEMO_2000);

  // switch
  $$(".cg-switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMpf(btn.dataset.mpf));
  });

  // expand/collapse all
  $("#collapseAllBtn").addEventListener("click", () => setAll(false));
  $("#expandAllBtn").addEventListener("click", () => setAll(true));

  setMpf("1000");
}

document.addEventListener("DOMContentLoaded", init);

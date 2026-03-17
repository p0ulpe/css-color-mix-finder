function setSwatchColor(el, hex) {
  if (!el) return;
  if (typeof el === "string") el = document.getElementById(el);
  if (!el) return;
  el.style.backgroundColor = hex;
  el.dataset.tooltip = hex.toUpperCase();
}
function setText(el, text) {
  if (typeof el === "string") el = document.getElementById(el);
  if (el) el.textContent = text;
}
function parseFigmaPaste(raw) {
  const match = raw.trim().match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
  return match ? "#" + match[1] : null;
}
function syncColorInputs(textInput, pickerInput, preview) {
  const update = (hex) => {
    if (!isValidHex(hex)) return;
    const n = normalizeHex(hex);
    textInput.value = n;
    pickerInput.value = n;
    if (preview) preview.style.backgroundColor = n;
  };
  textInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    const hex = parseFigmaPaste(pasted);
    if (hex) update(hex);
  });
  textInput.addEventListener("input", () => {
    const v = textInput.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) update(v);
    else if (isValidHex(v)) {
      const n = normalizeHex(v);
      pickerInput.value = n;
      if (preview) preview.style.backgroundColor = n;
    }
  });
  textInput.addEventListener("blur", () => {
    if (isValidHex(textInput.value)) update(textInput.value);
  });
  pickerInput.addEventListener("input", () => update(pickerInput.value));
  update(textInput.value);
}

// ── Dynamic set rendering ────────────────────────────────────────────────────

let setCounter = 0;

const TAG_CLASSES = ["tag--hover", "tag--active", "tag--t3", "tag--t4", "tag--t5"];

function tagClass(i) {
  return TAG_CLASSES[i] || "tag--t5";
}

// Adds a target color column to a set row
function addTargetCol(row, targetHex, targetIdx) {
  const idx = row.dataset.setIdx;
  const col = document.createElement("div");
  col.className = "set-color-col set-target-col";

  const tc = tagClass(targetIdx);
  const label = `target color <span class="tag ${tc}">${targetIdx + 1}</span>`;
  const hex = normalizeHex(targetHex || "#c20017");

  col.innerHTML = `
    <div class="set-col-label-row">
      <span class="set-col-label">${label}</span>
      <button class="target-remove-btn" title="Remove target" aria-label="Remove target" tabindex="-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="color-input-group compact">
      <input type="color" class="set-target-picker" value="${hex}">
      <input type="text" class="set-target-text" value="${hex}" placeholder="#hex">
    </div>
    <div class="color-preview set-target-preview"></div>
  `;

  syncColorInputs(
    col.querySelector(".set-target-text"),
    col.querySelector(".set-target-picker"),
    col.querySelector(".set-target-preview"),
  );

  col.querySelector(".target-remove-btn").addEventListener("click", () => {
    col.remove();
    refreshTargetLabels(row);
    updateFixPctInputs();
    updateAddTargetButtons();
    updatePerfWarning();
  });

  // Insert before the add-target button and remove-set button
  const addBtn = row.querySelector(".set-add-target-btn");
  row.insertBefore(col, addBtn);

  refreshTargetLabels(row);
  updateFixPctInputs();
  updateAddTargetButtons();
  updatePerfWarning();
}

// Re-numbers target column labels after add/remove
function refreshTargetLabels(row) {
  const cols = row.querySelectorAll(".set-target-col");
  cols.forEach((col, i) => {
    const tc = tagClass(i);
    col.querySelector(".set-col-label").innerHTML =
      `target color <span class="tag ${tc}">${i + 1}</span>`;
  });
}

// Max targets across all rows, used to render fix-% inputs
function getMaxTargets() {
  let max = 1;
  document.querySelectorAll(".set-row").forEach((row) => {
    const n = row.querySelectorAll(".set-target-col").length;
    if (n > max) max = n;
  });
  return max;
}

const MAX_TARGETS = 5;

function updateAddTargetButtons() {
  document.querySelectorAll(".set-row").forEach((row) => {
    const n = row.querySelectorAll(".set-target-col").length;
    const btn = row.querySelector(".set-add-target-btn");
    if (btn) btn.style.display = n >= MAX_TARGETS ? "none" : "";
    // Target remove buttons: hide if only 1 target
    row.querySelectorAll(".target-remove-btn").forEach((b) => {
      b.style.visibility = n > 1 ? "visible" : "hidden";
    });
  });
}

function updateFixPctInputs() {
  const container = document.getElementById("fixPctContainer");
  if (!container) return;
  const n = getMaxTargets();
  // Keep existing values
  const existing = [];
  container.querySelectorAll(".fix-pct-input").forEach((inp) => {
    existing.push(inp.value);
  });

  container.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const tc = tagClass(i);
    const grp = document.createElement("div");
    grp.className = "ctrl-group";
    grp.innerHTML = `
      <label class="fix-percent-label">Fix % <span class="tag ${tc}">${i + 1}</span></label>
      <input type="number" class="fix-percent-input fix-pct-input" data-target-idx="${i}" min="1" max="100" placeholder="auto" value="${existing[i] || ""}">
    `;
    container.appendChild(grp);
  }
}

function createSetRow(data) {
  const idx = setCounter++;
  const name =
    (data && data.name) ||
    `Set ${document.querySelectorAll(".set-row").length + 1}`;
  const baseVal = (data && data.baseHex) || "#e0001a";

  // Support both legacy {hoverTargetHex, activeTargetHex} and new {targets:[]}
  let targets;
  if (data && Array.isArray(data.targets) && data.targets.length > 0) {
    targets = data.targets;
  } else if (data && data.hoverTargetHex) {
    targets = [data.hoverTargetHex];
    if (data.activeTargetHex) targets.push(data.activeTargetHex);
  } else {
    targets = ["#c20017"];
  }

  const row = document.createElement("div");
  row.className = "set-row";
  row.dataset.setIdx = idx;
  row.innerHTML = `
    <div class="set-name-col">
      <input type="text" id="set-label-${idx}" name="set-label-${idx}" class="set-label-input" value="${name}" placeholder="label" spellcheck="false" autocomplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" data-bwignore role="presentation">
    </div>
    <div class="set-color-col">
      <span class="set-col-label">base color <span class="tag">default</span></span>
      <div class="color-input-group compact">
        <input type="color" class="set-base-picker" value="${normalizeHex(baseVal)}">
        <input type="text" class="set-base-text" value="${normalizeHex(baseVal)}" placeholder="#hex">
      </div>
      <div class="color-preview set-base-preview"></div>
    </div>
    <button class="set-add-target-btn" title="Add target color" aria-label="Add target color">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
    </button>
    <button class="set-remove-btn" title="Remove set" aria-label="Remove set">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  `;

  syncColorInputs(
    row.querySelector(".set-base-text"),
    row.querySelector(".set-base-picker"),
    row.querySelector(".set-base-preview"),
  );

  row.querySelector(".set-add-target-btn").addEventListener("click", () => {
    addTargetCol(row, "#c20017", row.querySelectorAll(".set-target-col").length);
  });

  row.querySelector(".set-remove-btn").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons();
    updateFixPctInputs();
    updateAddTargetButtons();
  });

  // Add initial target columns (without triggering updateFixPctInputs each time)
  for (let i = 0; i < targets.length; i++) {
    const col = document.createElement("div");
    col.className = "set-color-col set-target-col";
    const tc = tagClass(i);
    const hex = normalizeHex(targets[i] || "#c20017");
    col.innerHTML = `
      <div class="set-col-label-row">
        <span class="set-col-label">target color <span class="tag ${tc}">${i + 1}</span></span>
        <button class="target-remove-btn" title="Remove target" aria-label="Remove target" tabindex="-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="color-input-group compact">
        <input type="color" class="set-target-picker" value="${hex}">
        <input type="text" class="set-target-text" value="${hex}" placeholder="#hex">
      </div>
      <div class="color-preview set-target-preview"></div>
    `;
    syncColorInputs(
      col.querySelector(".set-target-text"),
      col.querySelector(".set-target-picker"),
      col.querySelector(".set-target-preview"),
    );
    col.querySelector(".target-remove-btn").addEventListener("click", () => {
      col.remove();
      refreshTargetLabels(row);
      updateFixPctInputs();
      updateAddTargetButtons();
      updatePerfWarning();
    });
    const addBtn = row.querySelector(".set-add-target-btn");
    row.insertBefore(col, addBtn);
  }

  return row;
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll(".set-row");
  rows.forEach((r) => {
    r.querySelector(".set-remove-btn").style.visibility =
      rows.length > 1 ? "visible" : "hidden";
  });
  updatePerfWarning();
}

function updatePerfWarning() {
  const warn = document.getElementById("perfWarning");
  if (!warn) return;
  const rows = document.querySelectorAll(".set-row");
  const setCount = rows.length;
  const maxTargets = Math.max(...Array.from(rows).map(r => r.querySelectorAll(".set-target-col").length), 0);
  const manySets = setCount >= 3;
  const manyTargets = maxTargets >= 4;
  warn.hidden = !manySets && !manyTargets;
  if (warn.hidden) return;
  const txt = document.getElementById("perfWarningText");
  if (!txt) return;
  const reasons = [];
  if (manySets) reasons.push(setCount + " sets");
  if (manyTargets) reasons.push(maxTargets + " targets per set");
  txt.textContent = "With " + reasons.join(" and ") + " and no fixed %, calculation may take longer. Fixing some target percentages will significantly speed things up.";
}

function addSet(data) {
  const container = document.getElementById("setsContainer");
  container.appendChild(createSetRow(data));
  updateRemoveButtons();
  updateFixPctInputs();
  updateAddTargetButtons();
}

function getSetsFromUI() {
  const rows = document.querySelectorAll(".set-row");
  const sets = [];
  for (const row of rows) {
    const baseHex = normalizeHex(row.querySelector(".set-base-text").value.trim());
    const targetCols = row.querySelectorAll(".set-target-col");
    const targets = Array.from(targetCols).map((col) =>
      normalizeHex(col.querySelector(".set-target-text").value.trim()),
    );
    const name = row.querySelector(".set-label-input").value.trim() || "set";
    // Map to solver keys: targets[0]=hoverTargetHex, targets[1]=activeTargetHex
    sets.push({
      name,
      baseHex,
      targets,
      hoverTargetHex: targets[0] || baseHex,
      activeTargetHex: targets[1] || targets[0] || baseHex,
    });
  }
  return sets;
}

function getFixedPctsFromUI() {
  const inputs = document.querySelectorAll(".fix-pct-input");
  const pcts = Array.from(inputs).map((inp) => {
    const v = parseInt(inp.value, 10);
    return isNaN(v) || v < 1 || v > 100 ? null : v;
  });
  return {
    fixedHoverPct: pcts[0] ?? null,
    fixedActivePct: pcts[1] ?? null,
    fixedPcts: pcts,
  };
}

function restoreSetsToUI(setsData, scroll) {
  const container = document.getElementById("setsContainer");
  container.innerHTML = "";
  setCounter = 0;
  for (const s of setsData) {
    const row = createSetRow(s);
    container.appendChild(row);
  }
  updateRemoveButtons();
  updateFixPctInputs();
  updateAddTargetButtons();
  if (scroll) {
    document
      .querySelector(".input-section")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector(".input-section").classList.add("hist-restored");
    setTimeout(
      () =>
        document
          .querySelector(".input-section")
          .classList.remove("hist-restored"),
      800,
    );
  }
}

// ── Results rendering ────────────────────────────────────────────────────────

function formatDeltaE(value) {
  const text = value.toFixed(2);
  const cls = value > 5 ? "bad" : value > 2 ? "ok" : "good";
  return { text, cls };
}

const _COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

function renderResults(data) {
  const mode = data.mode || "shared";
  const { sets } = data;

  // ── Shared blend / shared % header card ─────────────────────────────────
  const blendCard = document.querySelector(".blend-color-card");
  const blendSwatchEl = document.getElementById("blendSwatch");
  const blendInfoEl = document.querySelector(".blend-info");
  const cssBadge = document.querySelector(".result-header .color-space-badge");

  if (mode === "shared") {
    blendCard.hidden = false;
    blendCard.querySelector("h3").textContent = "Shared blend values";
    blendSwatchEl.hidden = false;
    blendInfoEl.hidden = false;
    cssBadge.hidden = false;
    setSwatchColor("blendSwatch", data.blendHex);
    setText("blendHex", data.blendHex.toUpperCase());
    document.getElementById("copyBlendBtn").dataset.copy =
      data.blendHex.toUpperCase();
    setText("colorSpaceValue", data.colorSpace);
    const pctBadgesEl1 = blendCard.querySelector(".blend-pct-badges");
    if (pctBadgesEl1) {
      const percents = data.percents || [data.hoverPercent, data.activePercent].filter((p) => p != null);
      pctBadgesEl1.innerHTML = percents.map((pct, i) => `
        <div class="blend-pct-badge">
          <span class="badge-label"><span class="tag ${tagClass(i)}">${i + 1}</span></span>
          <span class="badge-value">${pct}%</span>
        </div>`).join("");
    }
  } else if (mode === "per-set-blend") {
    blendCard.hidden = false;
    blendCard.querySelector("h3").textContent = "Shared percentages";
    blendSwatchEl.hidden = true;
    blendInfoEl.hidden = true;
    cssBadge.hidden = false;
    setText("colorSpaceValue", data.colorSpace);
    const pctBadgesEl2 = blendCard.querySelector(".blend-pct-badges");
    if (pctBadgesEl2) {
      const percents = data.percents || [data.hoverPercent, data.activePercent].filter((p) => p != null);
      pctBadgesEl2.innerHTML = percents.map((pct, i) => `
        <div class="blend-pct-badge">
          <span class="badge-label"><span class="tag ${tagClass(i)}">${i + 1}</span></span>
          <span class="badge-value">${pct}%</span>
        </div>`).join("");
    }
  } else {
    blendCard.hidden = true;
    cssBadge.hidden = true;
  }

  // ── Per-set result groups ────────────────────────────────────────────────
  const container = document.getElementById("resultsContainer");
  container.innerHTML = "";

  sets.forEach((s) => {
    const blendHex = mode === "shared" ? data.blendHex : s.blendHex;
    const colorSpace = mode === "independent" ? s.colorSpace : data.colorSpace;
    const percents = mode === "independent"
      ? (s.percents || [s.hoverPercent, s.activePercent].filter((p) => p != null))
      : (data.percents || [data.hoverPercent, data.activePercent].filter((p) => p != null));

    const setDiv = document.createElement("div");
    setDiv.className = "result-set-group";

    if (mode === "shared") {
      setDiv.innerHTML = `<div class="result-set-label">${s.name}</div>`;
    } else {
      const pctBadges = mode === "independent"
        ? `<span class="result-set-pcts">${percents.map((p, i) => `${i + 1}: ${p}%`).join(" · ")}</span>`
        : "";
      const spaceBadge = mode === "independent"
        ? `<span class="hist-space-badge">${colorSpace}</span>`
        : "";
      setDiv.innerHTML = `
        <div class="result-set-label-row">
          <span class="result-set-label">${s.name}</span>
          <div class="result-set-blend-row">
            <div class="tiny-swatch" style="background:${blendHex}"></div>
            <span class="result-blend-hex">${blendHex.toUpperCase()}</span>
            <button class="copy-btn" data-copy="${blendHex.toUpperCase()}" title="Copy blend hex">${_COPY_SVG}</button>
            ${pctBadges}${spaceBadge}
          </div>
        </div>`;
    }

    const grid = document.createElement("div");
    grid.className = "states-grid";

    const stateResults = s.stateResults || [
      s.hoverTargetHex ? { targetHex: s.hoverTargetHex, percent: percents[0], computed: s.hoverComputed, deltaE: s.hoverDeltaE } : null,
      s.activeTargetHex ? { targetHex: s.activeTargetHex, percent: percents[1], computed: s.activeComputed, deltaE: s.activeDeltaE } : null,
    ].filter(Boolean);

    stateResults.forEach((sr, i) => {
      grid.appendChild(
        createStateCard({
          tag: `target ${i + 1}`,
          tagClass: tagClass(i),
          baseHex: s.baseHex,
          blendHex,
          colorSpace,
          targetHex: sr.targetHex,
          percent: sr.percent,
          computed: sr.computed,
          deltaE: sr.deltaE,
        }),
      );
    });

    setDiv.appendChild(grid);
    container.appendChild(setDiv);
  });

  document.getElementById("resultsSection").hidden = false;
}

function createStateCard(opts) {
  const {
    tag,
    tagClass: tCls,
    baseHex,
    blendHex,
    colorSpace,
    targetHex,
    percent,
    computed,
    deltaE: dE,
  } = opts;
  const d = formatDeltaE(dE);
  const cssVal = `color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${percent}%)`;

  const card = document.createElement("div");
  card.className = "state-card card";
  card.innerHTML = `
        <div class="state-label"><span class="tag ${tCls}">${tag}</span></div>
        <div class="state-mix-preview">
            <div class="mix-swatch" style="background:${baseHex}" data-tooltip="${baseHex.toUpperCase()}"></div>
            <div class="mix-arrow">+</div>
            <div class="mix-swatch blend-indicator" style="background:${blendHex}" data-tooltip="${blendHex.toUpperCase()}"></div>
            <div class="mix-arrow">=</div>
            <div class="mix-compare-wrap">
                <div class="mix-compare-labels">
                    <span class="mix-swatch-label">Result</span>
                    <span class="mix-swatch-label">Target</span>
                </div>
                <div class="mix-compare-swatches">
                    <div class="mix-swatch result-swatch mix-copyable" style="background:color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${percent}%)" data-tooltip="Result ${computed.toUpperCase()}" data-copy="${computed.toUpperCase()}"></div><div class="mix-swatch target-compare-swatch mix-copyable" style="background:${targetHex}" data-tooltip="Target ${targetHex.toUpperCase()}" data-copy="${targetHex.toUpperCase()}"></div>
                </div>
            </div>
        </div>
        <div class="state-details">
            <div class="detail-row">
                <span class="detail-label">Percentage</span>
                <span class="detail-value">${percent}%</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Target</span>
                <div class="detail-color">
                    <div class="tiny-swatch" style="background:${targetHex}"></div>
                    <span>${targetHex.toUpperCase()}</span>
                </div>
            </div>
            <div class="detail-row">
                <span class="detail-label">Result</span>
                <div class="detail-color">
                    <div class="tiny-swatch" style="background:${computed}"></div>
                    <span>${computed.toUpperCase()}</span>
                </div>
            </div>
            <div class="detail-row">
                <span class="detail-label" data-tooltip="ΔE: color accuracy. 0 = perfect, <2 imperceptible, <5 slight, ≥5 noticeable">Delta E</span>
                <span class="detail-value delta-e ${d.cls}">${d.text}</span>
            </div>
        </div>
        <div class="css-snippet">${cssVal}
            <button class="copy-btn copy-snippet-btn" data-copy="${cssVal}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
        </div>
    `;
  return card;
}

function showLoading(isLoading) {
  const btn = document.getElementById("calculateBtn");
  if (isLoading) {
    btn.textContent = "Calculating...";
    btn.disabled = true;
  } else {
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Find blend color`;
    btn.disabled = false;
  }
}

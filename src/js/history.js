// ─── History module ────────────────────────────────────────────────────────
// Stores the last 10 calculations in localStorage and renders a scrollable
// history section.  Each item is clickable to restore all inputs.
// Supports multi-set entries (array of color sets per entry).

const HISTORY_KEY = 'blend-finder-history';
const HISTORY_MAX = 10;

// ── Storage helpers ─────────────────────────────────────────────────────────

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(entries) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

// ── Public API ───────────────────────────────────────────────────────────────

function addHistoryEntry(data) {
    const entries = loadHistory();
    entries.unshift({ id: Date.now(), pinned: false, ...data });
    while (entries.length > HISTORY_MAX) {
        const lastUnpinned = entries.findLastIndex(e => !e.pinned);
        if (lastUnpinned === -1) break;
        entries.splice(lastUnpinned, 1);
    }
    saveHistory(entries);
    renderHistory();
}

function deleteHistoryEntry(id) {
    saveHistory(loadHistory().filter(e => e.id !== id));
    renderHistory();
}

function togglePinEntry(id) {
    const entries = loadHistory();
    const entry = entries.find(e => e.id === id);
    if (entry) entry.pinned = !entry.pinned;
    saveHistory(entries);
    renderHistory();
}

function clearHistory() {
    saveHistory(loadHistory().filter(e => e.pinned));
    renderHistory();
}

// ── Rendering ────────────────────────────────────────────────────────────────

function deltaEClass(v) { return v > 5 ? 'bad' : v > 2 ? 'ok' : 'good'; }

function createHistoryItemHTML(e) {
    const mode = e.mode || 'shared';
    const pinCls = e.pinned ? ' pinned' : '';
    const setsArr = e.sets || [{
        name: 'set',
        baseHex: e.baseHex,
        hoverTargetHex: e.hoverTargetHex,
        activeTargetHex: e.activeTargetHex,
        hoverComputed: e.hoverComputed,
        hoverDeltaE: e.hoverDeltaE,
        activeComputed: e.activeComputed,
        activeDeltaE: e.activeDeltaE,
    }];

    const hPct = e.hoverPercent || (setsArr[0] && setsArr[0].hoverPercent) || '?';
    const aPct = e.activePercent || (setsArr[0] && setsArr[0].activePercent) || '?';

    // Top-row blend column
    const blendColHTML = mode === 'shared'
        ? `<div class="hist-blend-col">
      <div class="hist-swatch hist-swatch--blend" style="background:${e.blendHex}" data-tooltip="${e.blendHex ? e.blendHex.toUpperCase() : ''}"></div>
      <span class="hist-swatch-lbl">${e.blendHex ? e.blendHex.toUpperCase() : ''}</span>
    </div>`
        : `<div class="hist-blend-col">
      <div class="hist-multi-blends">${setsArr.map(s => `<div class="hist-swatch hist-swatch--blend" style="background:${s.blendHex || ''}" data-tooltip="${s.blendHex ? s.blendHex.toUpperCase() : ''}"></div>`).join('')}</div>
      <span class="hist-swatch-lbl hist-swatch-lbl--muted">per-set</span>
    </div>`;

    const pctHTML = mode === 'independent'
        ? `<span class="hist-pct" style="opacity:0.4"><span class="tag tag--hover">1</span>—</span>
    <span class="hist-pct" style="opacity:0.4"><span class="tag tag--active">2</span>—</span>`
        : `<span class="hist-pct"><span class="tag tag--hover">1</span>${hPct}%</span>
    <span class="hist-pct"><span class="tag tag--active">2</span>${aPct}%</span>`;

    const spaceHTML = mode === 'independent'
        ? `<div class="hist-space-badge">per-set</div>`
        : `<div class="hist-space-badge">${e.colorSpace || '—'}</div>`;

    const setLines = setsArr.map(s => {
        const setBlendSwatch = (mode === 'per-set-blend' || mode === 'independent') && s.blendHex
            ? `<div class="hist-swatch hist-swatch--blend" style="background:${s.blendHex}" data-tooltip="Blend ${s.blendHex.toUpperCase()}"></div>`
            : '';
        const setPercentBadges = mode === 'independent'
            ? `<span class="hist-set-pct-badge"><span class="tag tag--hover">1</span>${s.hoverPercent || '?'}%</span><span class="hist-set-pct-badge"><span class="tag tag--active">2</span>${s.activePercent || '?'}%</span>`
            : '';

        // Build target state rows from stateResults (new) or legacy fallback
        const stateResults = s.stateResults || [
            s.hoverTargetHex ? { targetHex: s.hoverTargetHex, computed: s.hoverComputed, deltaE: s.hoverDeltaE, tagCls: 'tag--hover', idx: 1 } : null,
            s.activeTargetHex ? { targetHex: s.activeTargetHex, computed: s.activeComputed, deltaE: s.activeDeltaE, tagCls: 'tag--active', idx: 2 } : null,
        ].filter(Boolean);

        const tagClasses = ['tag--hover', 'tag--active', 'tag--t3', 'tag--t4', 'tag--t5'];
        const stateHTML = stateResults.map((sr, i) => {
            const tc = sr.tagCls || tagClasses[i] || 'tag--t5';
            const n = sr.idx || (i + 1);
            return `
            <div class="hist-state-col">
                <div class="hist-state-row">
                    <div class="hist-overlay-wrap">
                        <div class="hist-swatch hist-swatch--state" style="background:${sr.targetHex}" data-tooltip="Target ${n} ${sr.targetHex ? sr.targetHex.toUpperCase() : ''}"></div><div class="hist-swatch hist-swatch--result" style="background:${sr.computed}" data-tooltip="Result ${sr.computed ? sr.computed.toUpperCase() : ''}"></div>
                    </div>
                    <div class="hist-tag-col">
                        <span class="tag ${tc}">${n}</span>
                        <span class="hist-delta ${deltaEClass(sr.deltaE)}">${sr.deltaE != null ? sr.deltaE.toFixed(1) : '?'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="hist-set-line">
            ${setBlendSwatch}
            <span class="hist-set-name">${s.name}</span>
            ${setPercentBadges}
            <div class="hist-swatch" style="background:${s.baseHex}" data-tooltip="Base ${s.baseHex ? s.baseHex.toUpperCase() : ''}"></div>
            ${stateHTML}
        </div>`;
    }).join('');

    return `
<div class="hist-item${pinCls}" data-id="${e.id}">
  <div class="hist-top-row">
    ${blendColHTML}
    ${pctHTML}
    ${spaceHTML}
    <button class="hist-pin${e.pinned ? ' pinned' : ''}" data-id="${e.id}" aria-label="${e.pinned ? 'Unpin' : 'Pin'} entry">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${e.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1l.3-.15a2 2 0 0 0 .7-2.85h-10a2 2 0 0 0 .7 2.85L8 4a1 1 0 0 1 1 1z"/></svg>
    </button>
    <button class="hist-delete" data-id="${e.id}" aria-label="Remove entry">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  </div>
  <div class="hist-sets">${setLines}</div>
</div>`;
}

function renderHistory() {
    const entries = loadHistory();
    const section  = document.getElementById('historySection');
    const list     = document.getElementById('historyList');
    const countEl  = document.getElementById('historyCount');

    if (!section) return;

    if (entries.length === 0) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    if (countEl) countEl.textContent = `${entries.length} / ${HISTORY_MAX}`;
    const sorted = [...entries.filter(e => e.pinned), ...entries.filter(e => !e.pinned)];
    list.innerHTML = sorted.map(createHistoryItemHTML).join('');
}

// ── Event delegation ─────────────────────────────────────────────────────────

function initHistory() {
    renderHistory();
    restoreLastEntry();

    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    document.getElementById('historyList').addEventListener('click', (e) => {
        const delBtn = e.target.closest('.hist-delete');
        if (delBtn) {
            e.stopPropagation();
            deleteHistoryEntry(Number(delBtn.dataset.id));
            return;
        }

        const pinBtn = e.target.closest('.hist-pin');
        if (pinBtn) {
            e.stopPropagation();
            togglePinEntry(Number(pinBtn.dataset.id));
            return;
        }

        const item = e.target.closest('.hist-item');
        if (!item) return;

        const id = Number(item.dataset.id);
        const entry = loadHistory().find(e => e.id === id);
        if (!entry) return;

        restoreFromHistory(entry);
    });
}

function restoreFromHistory(entry) {
    const setsData = (entry.sets || [{
        name: 'primary',
        baseHex: entry.baseHex,
        targets: [entry.hoverTargetHex, entry.activeTargetHex].filter(Boolean),
        hoverTargetHex: entry.hoverTargetHex,
        activeTargetHex: entry.activeTargetHex,
    }]).map(s => ({
        ...s,
        // Ensure targets array is populated from legacy keys if missing
        targets: s.targets || [s.hoverTargetHex, s.activeTargetHex].filter(Boolean),
    }));
    restoreSetsToUI(setsData, true);
    // Restore solve mode
    const restoredMode = entry.mode || 'shared';
    const sharedBlendCb = document.getElementById('sharedBlendColor');
    const sharedPctCb = document.getElementById('sharedPct');
    if (sharedBlendCb) sharedBlendCb.checked = restoredMode === 'shared';
    if (sharedPctCb) sharedPctCb.checked = restoredMode === 'shared' || restoredMode === 'per-set-blend';
    // Restore fixed pct if it was stored
    const pctInput = document.getElementById('fixBlendPct');
    if (pctInput) pctInput.value = entry.fixedPct != null ? entry.fixedPct : '';
}

function restoreLastEntry() {
    const entries = loadHistory();
    if (entries.length === 0) return;
    const last = entries[0];
    const setsData = (last.sets || [{
        name: 'primary',
        baseHex: last.baseHex,
        targets: [last.hoverTargetHex, last.activeTargetHex].filter(Boolean),
        hoverTargetHex: last.hoverTargetHex,
        activeTargetHex: last.activeTargetHex,
    }]).map(s => ({
        ...s,
        targets: s.targets || [s.hoverTargetHex, s.activeTargetHex].filter(Boolean),
    }));
    restoreSetsToUI(setsData, false);
}

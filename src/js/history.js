// ─── History module ────────────────────────────────────────────────────────
// Stores the last 10 calculations in localStorage and renders a scrollable
// history section.  Each item is clickable to restore all inputs.
// Supports multi-set entries (array of color sets per entry).

const HISTORY_KEY = 'blend-finder-history';
const HISTORY_MAX = 10;

// ── Security helpers ────────────────────────────────────────────────────────

function _escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function _sanitizeHex(hex) {
    if (typeof hex !== 'string') return '#000000';
    const clean = hex.trim().replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#000000';
    return '#' + full.toLowerCase();
}
function _sanitizeName(name) {
    if (typeof name !== 'string') return 'set';
    return name.slice(0, 64);
}
function _sanitizeColorSpace(cs) {
    return ['oklab', 'lab', 'srgb'].includes(cs) ? cs : 'oklab';
}
function _sanitizeEntry(e) {
    if (typeof e !== 'object' || e === null) return null;
    if (typeof e.id !== 'number') return null;
    return {
        id: e.id,
        pinned: Boolean(e.pinned),
        mode: ['shared', 'per-set-blend', 'independent'].includes(e.mode) ? e.mode : 'shared',
        blendHex: e.blendHex ? _sanitizeHex(e.blendHex) : undefined,
        colorSpace: _sanitizeColorSpace(e.colorSpace),
        hoverPercent: typeof e.hoverPercent === 'number' ? e.hoverPercent : undefined,
        activePercent: typeof e.activePercent === 'number' ? e.activePercent : undefined,
        fixedHoverPct: typeof e.fixedHoverPct === 'number' ? e.fixedHoverPct : null,
        fixedActivePct: typeof e.fixedActivePct === 'number' ? e.fixedActivePct : null,
        fixedSpace: e.fixedSpace ? _sanitizeColorSpace(e.fixedSpace) : null,
        percents: Array.isArray(e.percents) ? e.percents.filter(p => typeof p === 'number') : undefined,
        sets: Array.isArray(e.sets) ? e.sets.map(s => {
            if (typeof s !== 'object' || s === null) return null;
            return {
                name: _sanitizeName(s.name),
                baseHex: _sanitizeHex(s.baseHex),
                blendHex: s.blendHex ? _sanitizeHex(s.blendHex) : undefined,
                colorSpace: s.colorSpace ? _sanitizeColorSpace(s.colorSpace) : undefined,
                targets: Array.isArray(s.targets) ? s.targets.map(_sanitizeHex) : [],
                hoverTargetHex: s.hoverTargetHex ? _sanitizeHex(s.hoverTargetHex) : undefined,
                activeTargetHex: s.activeTargetHex ? _sanitizeHex(s.activeTargetHex) : undefined,
                hoverComputed: s.hoverComputed ? _sanitizeHex(s.hoverComputed) : undefined,
                activeComputed: s.activeComputed ? _sanitizeHex(s.activeComputed) : undefined,
                hoverPercent: typeof s.hoverPercent === 'number' ? s.hoverPercent : undefined,
                activePercent: typeof s.activePercent === 'number' ? s.activePercent : undefined,
                hoverDeltaE: typeof s.hoverDeltaE === 'number' ? s.hoverDeltaE : 0,
                activeDeltaE: typeof s.activeDeltaE === 'number' ? s.activeDeltaE : 0,
                stateResults: Array.isArray(s.stateResults) ? s.stateResults.map(r => {
                    if (typeof r !== 'object' || r === null) return null;
                    return {
                        targetHex: _sanitizeHex(r.targetHex),
                        computed: _sanitizeHex(r.computed),
                        deltaE: typeof r.deltaE === 'number' ? r.deltaE : 0,
                        percent: typeof r.percent === 'number' ? r.percent : null,
                    };
                }).filter(Boolean) : undefined,
            };
        }).filter(Boolean) : [],
    };
}

// ── Storage helpers ─────────────────────────────────────────────────────────

function loadHistory() {
    try {
        const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.map(_sanitizeEntry).filter(Boolean);
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

    const firstSet = setsArr[0] || {};
    const targetCount = firstSet.stateResults
        ? firstSet.stateResults.length
        : [firstSet.hoverTargetHex, firstSet.activeTargetHex].filter(Boolean).length;

    // Top-row blend column — removed, blend moved to body
    const spaceHTML = mode === 'shared' || mode === 'independent' || mode === 'per-set-blend'
        ? ''
        : `<div class="hist-space-badge">${_escapeHTML(e.colorSpace || '—')}</div>`;

    // Shared pct values used in header row
    // For independent mode: fixed targets show their value, variable targets show null (value goes per-set)
    const fixedPctsArr = [e.fixedHoverPct, e.fixedActivePct];
    const allPercents = e.percents || [hPct, aPct];
    const sharedPcts = mode === 'independent'
        ? Array.from({ length: targetCount }, (_, i) => fixedPctsArr[i] != null ? fixedPctsArr[i] : null)
        : allPercents.slice(0, targetCount);

    const setLines = setsArr.map(s => {
        const setBlendPart = (mode === 'per-set-blend' || mode === 'independent') && s.blendHex
            ? `<div class="hist-swatch hist-swatch--blend" style="background:${_sanitizeHex(s.blendHex)}" data-color="${_escapeHTML(s.blendHex.toUpperCase())}" data-tooltip="Blend ${_escapeHTML(s.blendHex.toUpperCase())}"></div><span class="hist-set-arrow">→</span>`
            : '';
        const setSpaceBadge = `<div class="hist-space-badge-wrap"><div class="hist-space-badge hist-space-badge--inline">${_escapeHTML(s.colorSpace || e.colorSpace || 'srgb')}</div></div>`;
        const setTargetCount = s.stateResults
            ? s.stateResults.length
            : [s.hoverTargetHex, s.activeTargetHex].filter(Boolean).length;
        const setPercentBadges = ''; // % moved: fixed values in header row, variable values in state columns

        // Resolve blend hex + color space for this set
        const setBlendHex = s.blendHex || e.blendHex || '';
        const setColorSpace = s.colorSpace || e.colorSpace || 'srgb';

        // Build target state rows from stateResults (new) or legacy fallback
        const stateResults = s.stateResults || [
            s.hoverTargetHex ? { targetHex: s.hoverTargetHex, computed: s.hoverComputed, deltaE: s.hoverDeltaE, tagCls: 'tag--hover', idx: 1, percent: s.hoverPercent } : null,
            s.activeTargetHex ? { targetHex: s.activeTargetHex, computed: s.activeComputed, deltaE: s.activeDeltaE, tagCls: 'tag--active', idx: 2, percent: s.activePercent } : null,
        ].filter(Boolean);

        const tagClasses = ['tag--hover', 'tag--active', 'tag--t3', 'tag--t4', 'tag--t5'];
        const stateHTML = stateResults.map((sr, i) => {
            const tc = sr.tagCls || tagClasses[i] || 'tag--t5';
            const n = sr.idx || (i + 1);
            const resultBg = (s.baseHex && setBlendHex && sr.percent != null)
                ? `color-mix(in ${_escapeHTML(setColorSpace)}, ${_sanitizeHex(s.baseHex)} 100%, ${_sanitizeHex(setBlendHex)} ${sr.percent}%)`
                : (_sanitizeHex(sr.computed) || '');
            // For independent mode: show per-set % only for variable (non-fixed) targets
            const isVarPct = mode === 'independent' && fixedPctsArr[i] == null;
            const pctVal = isVarPct ? (sr.percent != null ? sr.percent : (i === 0 ? s.hoverPercent : s.activePercent)) : null;
            const pctLabel = pctVal != null ? `<span class="hist-pct-inline">${pctVal}%</span>` : '';
            return `
            <div class="hist-state-col">
                <div class="hist-state-row">
                    <div class="hist-overlay-wrap">
                        <span class="hist-state-badge tag ${_escapeHTML(tc)}">${n}</span><div class="hist-swatch hist-swatch--state" style="background:${_sanitizeHex(sr.targetHex)}" data-color="${_escapeHTML(sr.targetHex ? sr.targetHex.toUpperCase() : '')}" data-tooltip="Target ${n} ${_escapeHTML(sr.targetHex ? sr.targetHex.toUpperCase() : '')}"></div><div class="hist-swatch hist-swatch--result" style="background:${resultBg}" data-color="${_escapeHTML(sr.computed ? sr.computed.toUpperCase() : '')}" data-tooltip="Result ${_escapeHTML(sr.computed ? sr.computed.toUpperCase() : '')}"></div>
                    </div>
                    <div class="hist-tag-col">
                        <span class="hist-delta ${deltaEClass(sr.deltaE)}">${sr.deltaE != null ? sr.deltaE.toFixed(1) : '?'}</span>
                        ${pctLabel}
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="hist-set-line">
            ${setBlendPart}
            <span class="hist-set-name">${_escapeHTML(s.name)}</span>
            ${setSpaceBadge}
            ${setPercentBadges}
            <div class="hist-swatch" style="background:${_sanitizeHex(s.baseHex)}" data-color="${_escapeHTML(s.baseHex ? s.baseHex.toUpperCase() : '')}" data-tooltip="Base ${_escapeHTML(s.baseHex ? s.baseHex.toUpperCase() : '')}"></div>
            ${stateHTML}
        </div>`;
    }).join('');

    // Pct header row: ghost elements mirror left-side of set-line for alignment
    const tagClsList = ['tag--hover', 'tag--active', 'tag--t3', 'tag--t4', 'tag--t5'];
    let pctHeaderRowHTML = '';
    if (sharedPcts) {
        // Ghost left columns mirror the set-line left side
        // For tree mode, padding-left on the header row handles tree-root+trunk offset via CSS
        // ghostLeft mirrors the left-side items of a set-line (before the state cols)
        // All modes: [set-name][space-badge][base-swatch]
        // per-set-blend adds: [blend-swatch][→] before set-name
        let ghostLeft;
        if (mode === 'per-set-blend' || (mode === 'independent' && setsArr.some(s => s.blendHex))) {
            ghostLeft = `<div class="hist-swatch hist-ghost" aria-hidden="true"></div><span class="hist-set-arrow hist-ghost" aria-hidden="true">\u2192</span><span class="hist-set-name hist-ghost" aria-hidden="true"></span><div class="hist-space-badge-wrap hist-ghost" aria-hidden="true"></div><div class="hist-swatch hist-ghost" aria-hidden="true"></div>`;
        } else {
            ghostLeft = `<span class="hist-set-name hist-ghost" aria-hidden="true"></span><div class="hist-space-badge-wrap hist-ghost" aria-hidden="true"></div><div class="hist-swatch hist-ghost" aria-hidden="true"></div>`;
        }
        // Each pct col uses a ghost state-row (height:0) to match state-col width exactly
        // For variable-pct cols (p===null, independent mode) also ghost the pct-inline span
        const pctItems = sharedPcts.map((p, i) => {
            const ghostPctInline = p === null ? `<span class="hist-pct-inline hist-ghost" aria-hidden="true">00%</span>` : '';
            return `<div class="hist-pct-header-col"><div class="hist-state-row hist-ghost" aria-hidden="true"><div class="hist-overlay-wrap"><div class="hist-swatch hist-swatch--state"></div><div class="hist-swatch hist-swatch--result"></div></div><div class="hist-tag-col"><span class="hist-delta">0.0</span>${ghostPctInline}</div></div><span class="hist-pct-header"><span class="tag ${tagClsList[i] || 'tag--t5'}">${i + 1}</span>${p != null ? p + '%' : ''}</span></div>`;
        }).join('');
        pctHeaderRowHTML = `<div class="hist-pct-header-row">${ghostLeft}${pctItems}</div>`;
    }

    // Body: tree layout for shared mode, flat for per-set modes
    // For tree mode, pct header row goes OUTSIDE hist-tree-inner so hist-tree-root
    // only stretches against the actual set lines (not the header).
    const isTree = mode === 'shared';
    const bodyHTML = isTree
        ? `<div class="hist-body hist-body--tree">
    ${pctHeaderRowHTML}
    <div class="hist-tree-inner">
      <div class="hist-tree-root">
        <div class="hist-swatch hist-swatch--blend" style="background:${_sanitizeHex(e.blendHex)}" data-color="${_escapeHTML(e.blendHex ? e.blendHex.toUpperCase() : '')}" data-tooltip="${_escapeHTML(e.blendHex ? e.blendHex.toUpperCase() : '')}"></div>
        <span class="hist-swatch-lbl">${_escapeHTML(e.blendHex ? e.blendHex.toUpperCase() : '')}</span>
      </div>
      <div class="hist-sets hist-sets--tree">${setLines}</div>
    </div>
  </div>`
        : `<div class="hist-sets">${pctHeaderRowHTML}${setLines}</div>`;

    // Summary badges: summarise what was fixed/shared during the search
    const tagClsListBadge = ['tag--hover', 'tag--active', 'tag--t3', 'tag--t4', 'tag--t5'];
    const summaryBadges = [];
    if (mode === 'shared') summaryBadges.push(`<span class="hist-summary-badge">Shared blend color</span>`);
    if (mode === 'shared' || mode === 'per-set-blend') summaryBadges.push(`<span class="hist-summary-badge">Shared %</span>`);
    if (e.fixedSpace) summaryBadges.push(`<span class="hist-summary-badge">Fixed color space</span>`);
    // Fixed % per target index (fixedHoverPct = index 0, fixedActivePct = index 1; generalise via percents array)
    const fixedPcts = [e.fixedHoverPct, e.fixedActivePct];
    fixedPcts.forEach((fp, i) => {
        if (fp != null && fp !== '' && fp !== false) {
            const tc = tagClsListBadge[i] || 'tag--t5';
            summaryBadges.push(`<span class="hist-summary-badge">Fixed % <span class="tag ${tc}">${i + 1}</span></span>`);
        }
    });
    const summaryHTML = summaryBadges.length
        ? `<div class="hist-summary-row">${summaryBadges.join('')}</div>`
        : '';

    return `
<div class="hist-item${pinCls}" data-id="${e.id}" data-mode="${mode}">
  <div class="hist-top-row">
    ${spaceHTML}
    <button class="hist-reuse" data-id="${e.id}" aria-label="Reuse these settings">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      Reuse
    </button>
    <button class="hist-pin${e.pinned ? ' pinned' : ''}" data-id="${e.id}" aria-label="${e.pinned ? 'Unpin' : 'Pin'} entry">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${e.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1l.3-.15a2 2 0 0 0 .7-2.85h-10a2 2 0 0 0 .7 2.85L8 4a1 1 0 0 1 1 1z"/></svg>
    </button>
    <button class="hist-delete" data-id="${e.id}" aria-label="Remove entry">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  </div>
  <div class="hist-scroll-body">
    ${summaryHTML}
    ${bodyHTML}
  </div>
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

        const reuseBtn = e.target.closest('.hist-reuse');
        if (reuseBtn) {
            e.stopPropagation();
            const id = Number(reuseBtn.dataset.id);
            const entry = loadHistory().find(en => en.id === id);
            if (entry) restoreFromHistory(entry);
            return;
        }

        const swatch = e.target.closest('.hist-swatch');
        if (swatch) {
            e.stopPropagation();
            const color = swatch.dataset.color;
            if (color && navigator.clipboard) {
                navigator.clipboard.writeText(color).then(() => {
                    const original = swatch.dataset.tooltip;
                    swatch.dataset.tooltip = 'Copied!';
                    swatch.classList.add('hist-swatch--copied');
                    setTimeout(() => {
                        swatch.dataset.tooltip = original;
                        swatch.classList.remove('hist-swatch--copied');
                    }, 1500);
                });
            }
            return;
        }
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

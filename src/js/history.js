// ─── History module ────────────────────────────────────────────────────────
// Stores the last 10 calculations in localStorage and renders a scrollable
// history section.  Each item is clickable to restore all inputs.

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
    // Evict oldest unpinned entries beyond HISTORY_MAX
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
    const pinCls = e.pinned ? ' pinned' : '';
    return `
<div class="hist-item${pinCls}" data-id="${e.id}">
  <div class="hist-base-col">
    <div class="hist-swatch" style="background:${e.baseHex}" data-tooltip="${e.baseHex.toUpperCase()}"></div>
    <span class="hist-swatch-lbl">base</span>
  </div>

  <div class="hist-blend-col">
    <div class="hist-swatch hist-swatch--blend" style="background:${e.blendHex}" data-tooltip="${e.blendHex.toUpperCase()}"></div>
    <span class="hist-swatch-lbl">${e.blendHex.toUpperCase()}</span>
  </div>

  <div class="hist-space-badge">${e.colorSpace}</div>

  <div class="hist-sep"></div>

  <div class="hist-state-col">
    <div class="hist-state-row">
      <div class="hist-overlay-wrap">
        <div class="hist-swatch hist-swatch--state" style="background:${e.hoverTargetHex}" data-tooltip="Target ${e.hoverTargetHex.toUpperCase()}"></div><div class="hist-swatch hist-swatch--result" style="background:${e.hoverComputed}" data-tooltip="Result ${e.hoverComputed.toUpperCase()}"></div>
      </div>
      <span class="hist-pct">${e.hoverPercent}%</span>
    </div>
    <div class="hist-tag-row">
      <span class="tag tag--hover">hover</span>
      <span class="hist-delta ${deltaEClass(e.hoverDeltaE)}">${e.hoverDeltaE.toFixed(1)}</span>
    </div>
  </div>

  <div class="hist-state-col">
    <div class="hist-state-row">
      <div class="hist-overlay-wrap">
        <div class="hist-swatch hist-swatch--state" style="background:${e.activeTargetHex}" data-tooltip="Target ${e.activeTargetHex.toUpperCase()}"></div><div class="hist-swatch hist-swatch--result" style="background:${e.activeComputed}" data-tooltip="Result ${e.activeComputed.toUpperCase()}"></div>
      </div>
      <span class="hist-pct">${e.activePercent}%</span>
    </div>
    <div class="hist-tag-row">
      <span class="tag tag--active">active</span>
      <span class="hist-delta ${deltaEClass(e.activeDeltaE)}">${e.activeDeltaE.toFixed(1)}</span>
    </div>
  </div>

  <button class="hist-pin${e.pinned ? ' pinned' : ''}" data-id="${e.id}" aria-label="${e.pinned ? 'Unpin' : 'Pin'} entry">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${e.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1l.3-.15a2 2 0 0 0 .7-2.85h-10a2 2 0 0 0 .7 2.85L8 4a1 1 0 0 1 1 1z"/></svg>
  </button>

  <button class="hist-delete" data-id="${e.id}" aria-label="Remove entry">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </button>
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
        // Delete button
        const delBtn = e.target.closest('.hist-delete');
        if (delBtn) {
            e.stopPropagation();
            deleteHistoryEntry(Number(delBtn.dataset.id));
            return;
        }

        // Pin button
        const pinBtn = e.target.closest('.hist-pin');
        if (pinBtn) {
            e.stopPropagation();
            togglePinEntry(Number(pinBtn.dataset.id));
            return;
        }

        // Click anywhere else on the item → restore inputs
        const item = e.target.closest('.hist-item');
        if (!item) return;

        const id = Number(item.dataset.id);
        const entry = loadHistory().find(e => e.id === id);
        if (!entry) return;

        restoreInputs(entry);
    });
}

function restoreInputs(entry, scroll = true) {
    // Helper: set text + picker + preview for a color field
    function setColor(textId, pickerId, previewId, hex) {
        const n = normalizeHex(hex);
        document.getElementById(textId).value  = n;
        document.getElementById(pickerId).value = n;
        const prev = document.getElementById(previewId);
        if (prev) prev.style.backgroundColor = n;
        // Trigger input event so syncColorInputs listeners stay in sync
        document.getElementById(textId).dispatchEvent(new Event('input'));
    }

    setColor('baseColor',  'baseColorPicker',  'basePreview',  entry.baseHex);
    setColor('hoverColor', 'hoverColorPicker', 'hoverPreview', entry.hoverTargetHex);
    setColor('activeColor','activeColorPicker','activePreview', entry.activeTargetHex);

    const hFixed = document.getElementById('hoverFixedPct');
    const aFixed = document.getElementById('activeFixedPct');
    hFixed.value = entry.fixedHoverPct  != null ? entry.fixedHoverPct  : '';
    aFixed.value = entry.fixedActivePct != null ? entry.fixedActivePct : '';

    // Scroll to top and briefly highlight the input card
    if (scroll) {
        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelector('.input-section').classList.add('hist-restored');
        setTimeout(() => document.querySelector('.input-section').classList.remove('hist-restored'), 800);
    }
}

function restoreLastEntry() {
    const entries = loadHistory();
    if (entries.length === 0) return;
    const last = entries[0];
    restoreInputs(last, false);
}

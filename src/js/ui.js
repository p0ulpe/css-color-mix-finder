function setSwatchColor(el, hex) {
    if (!el) return;
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.style.backgroundColor = hex;
    el.dataset.tooltip = hex.toUpperCase();
}
function setText(el, text) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.textContent = text;
}
function parseFigmaPaste(raw) {
    const match = raw.trim().match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    return match ? '#' + match[1] : null;
}
function syncColorInputs(textInput, pickerInput, preview) {
    const update = (hex) => {
        if (!isValidHex(hex)) return;
        const n = normalizeHex(hex);
        textInput.value = n;
        pickerInput.value = n;
        if (preview) preview.style.backgroundColor = n;
    };
    textInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const hex = parseFigmaPaste(pasted);
        if (hex) update(hex);
    });
    textInput.addEventListener('input', () => {
        const v = textInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) update(v);
        else if (isValidHex(v)) {
            const n = normalizeHex(v);
            pickerInput.value = n;
            if (preview) preview.style.backgroundColor = n;
        }
    });
    textInput.addEventListener('blur', () => { if (isValidHex(textInput.value)) update(textInput.value); });
    pickerInput.addEventListener('input', () => update(pickerInput.value));
    update(textInput.value);
}

// ── Dynamic set rendering ────────────────────────────────────────────────────

let setCounter = 0;

const DEFAULT_SET_NAMES = ['primary', 'secondary', 'tertiary', 'quaternary'];

function createSetRow(data) {
    const idx = setCounter++;
    const name = (data && data.name) || DEFAULT_SET_NAMES[document.querySelectorAll('.set-row').length] || 'set ' + (document.querySelectorAll('.set-row').length + 1);
    const baseVal = (data && data.baseHex) || '#e0001a';
    const hoverVal = (data && data.hoverTargetHex) || '#c20017';
    const activeVal = (data && data.activeTargetHex) || '#940011';

    const row = document.createElement('div');
    row.className = 'set-row';
    row.dataset.setIdx = idx;
    row.innerHTML = `
        <div class="set-name-col">
            <input type="text" class="set-name-input" value="${name}" placeholder="name" spellcheck="false">
        </div>
        <div class="set-color-col">
            <span class="set-col-label">base <span class="tag">default</span></span>
            <div class="color-input-group compact">
                <input type="color" class="set-base-picker" value="${normalizeHex(baseVal)}">
                <input type="text" class="set-base-text" value="${normalizeHex(baseVal)}" placeholder="#hex">
            </div>
            <div class="color-preview set-base-preview"></div>
        </div>
        <div class="set-color-col">
            <span class="set-col-label">target <span class="tag tag--hover">hover</span></span>
            <div class="color-input-group compact">
                <input type="color" class="set-hover-picker" value="${normalizeHex(hoverVal)}">
                <input type="text" class="set-hover-text" value="${normalizeHex(hoverVal)}" placeholder="#hex">
            </div>
            <div class="color-preview set-hover-preview"></div>
        </div>
        <div class="set-color-col">
            <span class="set-col-label">target <span class="tag tag--active">active</span></span>
            <div class="color-input-group compact">
                <input type="color" class="set-active-picker" value="${normalizeHex(activeVal)}">
                <input type="text" class="set-active-text" value="${normalizeHex(activeVal)}" placeholder="#hex">
            </div>
            <div class="color-preview set-active-preview"></div>
        </div>
        <button class="set-remove-btn" title="Remove set" aria-label="Remove set">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
    `;

    // Sync color inputs
    syncColorInputs(row.querySelector('.set-base-text'), row.querySelector('.set-base-picker'), row.querySelector('.set-base-preview'));
    syncColorInputs(row.querySelector('.set-hover-text'), row.querySelector('.set-hover-picker'), row.querySelector('.set-hover-preview'));
    syncColorInputs(row.querySelector('.set-active-text'), row.querySelector('.set-active-picker'), row.querySelector('.set-active-preview'));

    // Remove button
    row.querySelector('.set-remove-btn').addEventListener('click', () => {
        row.remove();
        updateRemoveButtons();
    });

    return row;
}

function updateRemoveButtons() {
    const rows = document.querySelectorAll('.set-row');
    rows.forEach(r => {
        r.querySelector('.set-remove-btn').style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
    const warn = document.getElementById('perfWarning');
    if (warn) warn.hidden = rows.length < 3;
}

function addSet(data) {
    const container = document.getElementById('setsContainer');
    container.appendChild(createSetRow(data));
    updateRemoveButtons();
}

function getSetsFromUI() {
    const rows = document.querySelectorAll('.set-row');
    const sets = [];
    for (const row of rows) {
        const baseHex = normalizeHex(row.querySelector('.set-base-text').value.trim());
        const hoverTargetHex = normalizeHex(row.querySelector('.set-hover-text').value.trim());
        const activeTargetHex = normalizeHex(row.querySelector('.set-active-text').value.trim());
        const name = row.querySelector('.set-name-input').value.trim() || 'set';
        sets.push({ name, baseHex, hoverTargetHex, activeTargetHex });
    }
    return sets;
}

function getFixedPctsFromUI() {
    const hInput = document.getElementById('fixHoverPct');
    const aInput = document.getElementById('fixActivePct');
    const hv = hInput ? parseInt(hInput.value, 10) : NaN;
    const av = aInput ? parseInt(aInput.value, 10) : NaN;
    return {
        fixedHoverPct: (isNaN(hv) || hv < 1 || hv > 100) ? null : hv,
        fixedActivePct: (isNaN(av) || av < 1 || av > 100) ? null : av,
    };
}

function restoreSetsToUI(setsData, scroll) {
    const container = document.getElementById('setsContainer');
    container.innerHTML = '';
    setCounter = 0;
    for (const s of setsData) addSet(s);
    if (scroll) {
        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelector('.input-section').classList.add('hist-restored');
        setTimeout(() => document.querySelector('.input-section').classList.remove('hist-restored'), 800);
    }
}

// ── Results rendering ────────────────────────────────────────────────────────

function formatDeltaE(value) {
    const text = value.toFixed(2);
    const cls = value > 5 ? 'bad' : value > 2 ? 'ok' : 'good';
    return { text, cls };
}

function renderResults(data) {
    const { blendHex, colorSpace, hoverPercent, activePercent, sets } = data;

    setSwatchColor('blendSwatch', blendHex);
    setText('blendHex', blendHex.toUpperCase());
    document.getElementById('copyBlendBtn').dataset.copy = blendHex.toUpperCase();
    setText('colorSpaceValue', colorSpace);
    setText('blendHoverPctValue', hoverPercent + '%');
    setText('blendActivePctValue', activePercent + '%');

    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    sets.forEach((s, i) => {
        const setDiv = document.createElement('div');
        setDiv.className = 'result-set-group';
        setDiv.innerHTML = `<div class="result-set-label">${s.name}</div>`;

        const grid = document.createElement('div');
        grid.className = 'states-grid';

        // Hover card
        grid.appendChild(createStateCard({
            tag: 'hover', tagClass: 'tag--hover',
            baseHex: s.baseHex, blendHex, colorSpace,
            targetHex: s.hoverTargetHex, percent: hoverPercent,
            computed: s.hoverComputed, deltaE: s.hoverDeltaE,
        }));

        // Active card
        grid.appendChild(createStateCard({
            tag: 'active', tagClass: 'tag--active',
            baseHex: s.baseHex, blendHex, colorSpace,
            targetHex: s.activeTargetHex, percent: activePercent,
            computed: s.activeComputed, deltaE: s.activeDeltaE,
        }));

        setDiv.appendChild(grid);
        container.appendChild(setDiv);
    });

    document.getElementById('resultsSection').hidden = false;
}

function createStateCard(opts) {
    const { tag, tagClass, baseHex, blendHex, colorSpace, targetHex, percent, computed, deltaE: dE } = opts;
    const d = formatDeltaE(dE);
    const cssVal = `color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${percent}%)`;

    const card = document.createElement('div');
    card.className = 'state-card card';
    card.innerHTML = `
        <div class="state-label"><span class="tag ${tagClass}">${tag}</span></div>
        <div class="state-mix-preview">
            <div class="mix-swatch" style="background:${baseHex}" data-tooltip="${baseHex.toUpperCase()}"></div>
            <div class="mix-arrow">+</div>
            <div class="mix-swatch blend-indicator" style="background:${blendHex}" data-tooltip="${blendHex.toUpperCase()}"></div>
            <div class="mix-arrow">=</div>
            <div class="mix-swatch-labeled">
                <span class="mix-swatch-label">Result</span>
                <div class="mix-swatch result-swatch" style="background:color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${percent}%)" data-tooltip="${computed.toUpperCase()}"></div>
            </div>
            <div class="mix-arrow compare-arrow">vs</div>
            <div class="mix-swatch-labeled">
                <span class="mix-swatch-label">Target</span>
                <div class="mix-swatch target-compare-swatch" style="background:${targetHex}" data-tooltip="${targetHex.toUpperCase()}"></div>
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
                <span class="detail-label">Delta E</span>
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
    const btn = document.getElementById('calculateBtn');
    if (isLoading) {
        btn.textContent = 'Calculating...';
        btn.disabled = true;
    } else {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Find blend color`;
        btn.disabled = false;
    }
}
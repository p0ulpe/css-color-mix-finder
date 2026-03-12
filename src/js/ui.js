function setSwatchColor(id, hex) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.backgroundColor = hex;
    el.dataset.tooltip = hex.toUpperCase();
}
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
function parseFigmaPaste(raw) {
    // Figma copies "940011     100" (hex + spaces + opacity) — extract just the hex
    const match = raw.trim().match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    return match ? '#' + match[1] : null;
}
function syncColorInputs(textId, pickerId, previewId) {
    const textInput = document.getElementById(textId);
    const pickerInput = document.getElementById(pickerId);
    const preview = document.getElementById(previewId);
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
        // Only auto-sync while typing when the value is already a complete 6-digit hex.
        // 3-digit shorthands are resolved on blur to avoid premature normalisation
        // (e.g. typing #ff0abc would otherwise snap to #ffff00 after #ff0).
        const v = textInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) update(v);
        else if (isValidHex(v)) {
            // keep picker/preview in sync without rewriting the text field
            const n = normalizeHex(v);
            pickerInput.value = n;
            if (preview) preview.style.backgroundColor = n;
        }
    });
    textInput.addEventListener('blur', () => { if (isValidHex(textInput.value)) update(textInput.value); });
    pickerInput.addEventListener('input', () => update(pickerInput.value));
    update(textInput.value);
}
function formatDeltaE(value) {
    const text = value.toFixed(2);
    const cls = value > 5 ? 'bad' : value > 2 ? 'ok' : 'good';
    return { text, cls };
}
function renderResults(data) {
    const { blendHex, colorSpace, hoverPercent, hoverComputed, hoverDeltaE,
            activePercent, activeComputed, activeDeltaE, baseHex, hoverTargetHex, activeTargetHex,
            fixedHoverPct, fixedActivePct } = data;

    setSwatchColor('blendSwatch', blendHex);
    setText('blendHex', blendHex.toUpperCase());
    document.getElementById('copyBlendBtn').dataset.copy = blendHex.toUpperCase();
    setText('colorSpaceValue', colorSpace);

    setSwatchColor('hoverBaseSwatch', baseHex);
    setSwatchColor('hoverBlendSwatch', blendHex);
    const hoverResultEl = document.getElementById('hoverResultSwatch');
    hoverResultEl.style.backgroundColor = `color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${hoverPercent}%)`;
    hoverResultEl.dataset.tooltip = hoverComputed.toUpperCase();
    setSwatchColor('hoverTargetCompareSwatch', hoverTargetHex);
    setSwatchColor('hoverTargetSwatch', hoverTargetHex);
    setSwatchColor('hoverComputedSwatch', hoverComputed);
    setText('hoverPercent', hoverPercent + '%');
    const hFixedBadge = document.getElementById('hoverPctFixed');
    if (hFixedBadge) hFixedBadge.hidden = (fixedHoverPct == null);
    setText('hoverTargetHex', hoverTargetHex.toUpperCase());
    setText('hoverComputedHex', hoverComputed.toUpperCase());
    const hd = formatDeltaE(hoverDeltaE);
    const hEl = document.getElementById('hoverDeltaE');
    hEl.textContent = hd.text;
    hEl.className = 'detail-value delta-e ' + hd.cls;
    const hoverCssVal = 'color-mix(in ' + colorSpace + ', ' + baseHex + ' 100%, ' + blendHex + ' ' + hoverPercent + '%)';
    const hoverCssEl = document.getElementById('hoverCss');
    if (hoverCssEl.firstChild && hoverCssEl.firstChild.nodeType === 3) { hoverCssEl.firstChild.textContent = hoverCssVal; } else { hoverCssEl.insertBefore(document.createTextNode(hoverCssVal), hoverCssEl.firstChild); }
    document.getElementById('copyHoverCssBtn').dataset.copy = hoverCssVal;

    setSwatchColor('activeBaseSwatch', baseHex);
    setSwatchColor('activeBlendSwatch', blendHex);
    const activeResultEl = document.getElementById('activeResultSwatch');
    activeResultEl.style.backgroundColor = `color-mix(in ${colorSpace}, ${baseHex} 100%, ${blendHex} ${activePercent}%)`;
    activeResultEl.dataset.tooltip = activeComputed.toUpperCase();
    setSwatchColor('activeTargetCompareSwatch', activeTargetHex);
    setSwatchColor('activeTargetSwatch', activeTargetHex);
    setSwatchColor('activeComputedSwatch', activeComputed);
    setText('activePercent', activePercent + '%');
    const aFixedBadge = document.getElementById('activePctFixed');
    if (aFixedBadge) aFixedBadge.hidden = (fixedActivePct == null);
    setText('activeTargetHex', activeTargetHex.toUpperCase());
    setText('activeComputedHex', activeComputed.toUpperCase());
    const ad = formatDeltaE(activeDeltaE);
    const aEl = document.getElementById('activeDeltaE');
    aEl.textContent = ad.text;
    aEl.className = 'detail-value delta-e ' + ad.cls;
    const activeCssVal = 'color-mix(in ' + colorSpace + ', ' + baseHex + ' 100%, ' + blendHex + ' ' + activePercent + '%)';
    const activeCssEl = document.getElementById('activeCss');
    if (activeCssEl.firstChild && activeCssEl.firstChild.nodeType === 3) { activeCssEl.firstChild.textContent = activeCssVal; } else { activeCssEl.insertBefore(document.createTextNode(activeCssVal), activeCssEl.firstChild); }
    document.getElementById('copyActiveCssBtn').dataset.copy = activeCssVal;

    document.getElementById('resultsSection').hidden = false;
}
function showLoading(isLoading) {
    const btn = document.getElementById('calculateBtn');
    btn.textContent = isLoading ? 'Calculating...' : 'Find blend color';
    btn.disabled = isLoading;
}
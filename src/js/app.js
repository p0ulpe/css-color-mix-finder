document.addEventListener('DOMContentLoaded', () => {
    syncColorInputs('baseColor', 'baseColorPicker', 'basePreview');
    syncColorInputs('hoverColor', 'hoverColorPicker', 'hoverPreview');
    syncColorInputs('activeColor', 'activeColorPicker', 'activePreview');

    initHistory();
    initTheme();

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-btn');
        if (!btn) return;
        if (btn.dataset.copy) {
            copyToClipboard(btn.dataset.copy, btn);
        }
    });

    document.getElementById('calculateBtn').addEventListener('click', calculate);
});

function initTheme() {
    const btn = document.getElementById('themeToggle');
    const SVG_SUN  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
    const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    const isLight = localStorage.getItem('theme') === 'light';
    const apply = (light) => {
        document.documentElement.classList.toggle('light', light);
        btn.innerHTML = light ? SVG_MOON : SVG_SUN;
        btn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
    };
    apply(isLight);
    btn.addEventListener('click', () => {
        const light = !document.documentElement.classList.contains('light');
        apply(light);
        localStorage.setItem('theme', light ? 'light' : 'dark');
    });
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
    });
}

function getHex(id) {
    return normalizeHex(document.getElementById(id).value.trim());
}

function getFixedPct(id) {
    const val = parseInt(document.getElementById(id).value, 10);
    if (isNaN(val) || val < 1 || val > 100) return null;
    return val;
}

function calculate() {
    const baseHex = getHex('baseColor');
    const hoverTargetHex = getHex('hoverColor');
    const activeTargetHex = getHex('activeColor');
    const fixedHoverPct = getFixedPct('hoverFixedPct');
    const fixedActivePct = getFixedPct('activeFixedPct');
    const spaceSelect = document.getElementById('colorSpaceSelect').value;
    const forcedSpace = spaceSelect === 'auto' ? null : spaceSelect;

    if (!isValidHex(baseHex) || !isValidHex(hoverTargetHex) || !isValidHex(activeTargetHex)) {
        alert('Please enter valid hex colors for all three fields.');
        return;
    }

    showLoading(true);

    setTimeout(() => {
        try {
            const best = findBestColorSpace(baseHex, hoverTargetHex, activeTargetHex, fixedHoverPct, fixedActivePct, forcedSpace);
            if (!best) {
                alert('Could not find a suitable blend color. Try different target colors.');
                return;
            }
            const resultData = {
                blendHex: best.result.blendHex,
                colorSpace: best.space,
                hoverPercent: best.result.hoverPercent,
                hoverComputed: best.result.hoverComputed,
                hoverDeltaE: best.result.hoverDeltaE,
                activePercent: best.result.activePercent,
                activeComputed: best.result.activeComputed,
                activeDeltaE: best.result.activeDeltaE,
                baseHex,
                hoverTargetHex,
                activeTargetHex,
                fixedHoverPct,
                fixedActivePct,
            };
            renderResults(resultData);
            addHistoryEntry(resultData);
            // If auto mode, reflect the winning space in the badge but leave select on "auto"
        } catch(err) {
            console.error(err);
            alert('An error occurred. Check the console for details.');
        } finally {
            showLoading(false);
        }
    }, 50);
}
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHistory();

    // If history didn't restore any sets, add a default one
    if (document.querySelectorAll('.set-row').length === 0) {
        addSet();
    }

    document.getElementById('addSetBtn').addEventListener('click', () => addSet());

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

function calculate() {
    const sets = getSetsFromUI();
    const spaceSelect = document.getElementById('colorSpaceSelect').value;
    const forcedSpace = spaceSelect === 'auto' ? null : spaceSelect;

    for (const s of sets) {
        if (!isValidHex(s.baseHex) || !isValidHex(s.hoverTargetHex) || !isValidHex(s.activeTargetHex)) {
            alert('Please enter valid hex colors for all fields.');
            return;
        }
    }

    showLoading(true);

    const { fixedHoverPct, fixedActivePct } = getFixedPctsFromUI();
    const sharedBlend = document.getElementById('sharedBlendColor').checked;
    const sharedPct = document.getElementById('sharedPct').checked;
    const mode = sharedBlend ? 'shared' : sharedPct ? 'per-set-blend' : 'independent';
    const worker = new Worker('js/solver-worker.js');

    worker.onmessage = function(e) {
        worker.terminate();
        showLoading(false);
        const { ok, result: best, error } = e.data;
        if (!ok) {
            console.error(error);
            alert('An error occurred. Check the console for details.');
            return;
        }
        if (!best) {
            alert('Could not find a suitable blend color. Try different target colors.');
            return;
        }
        let resultData;
        if (mode === 'per-set-blend') {
            const percents = [best.result.hoverPercent, best.result.activePercent];
            resultData = {
                mode,
                colorSpace: best.space,
                hoverPercent: best.result.hoverPercent,
                activePercent: best.result.activePercent,
                percents,
                fixedHoverPct,
                fixedActivePct,
                sets: sets.map((s, i) => ({
                    name: s.name,
                    baseHex: s.baseHex,
                    targets: s.targets,
                    hoverTargetHex: s.hoverTargetHex,
                    activeTargetHex: s.activeTargetHex,
                    blendHex: best.result.sets[i].blendHex,
                    hoverComputed: best.result.sets[i].hoverComputed,
                    hoverDeltaE: best.result.sets[i].hoverDeltaE,
                    activeComputed: best.result.sets[i].activeComputed,
                    activeDeltaE: best.result.sets[i].activeDeltaE,
                    stateResults: s.targets.map((tHex, ti) => ({
                        targetHex: tHex,
                        percent: percents[ti] || percents[percents.length - 1],
                        computed: ti === 0 ? best.result.sets[i].hoverComputed : best.result.sets[i].activeComputed,
                        deltaE: ti === 0 ? best.result.sets[i].hoverDeltaE : best.result.sets[i].activeDeltaE,
                    })),
                })),
            };
        } else if (mode === 'independent') {
            resultData = {
                mode,
                fixedHoverPct,
                fixedActivePct,
                sets: sets.map((s, i) => {
                    const percents = [best.sets[i].hoverPercent, best.sets[i].activePercent];
                    return {
                        name: s.name,
                        baseHex: s.baseHex,
                        targets: s.targets,
                        hoverTargetHex: s.hoverTargetHex,
                        activeTargetHex: s.activeTargetHex,
                        blendHex: best.sets[i].blendHex,
                        colorSpace: best.sets[i].space,
                        hoverPercent: best.sets[i].hoverPercent,
                        activePercent: best.sets[i].activePercent,
                        percents,
                        hoverComputed: best.sets[i].hoverComputed,
                        hoverDeltaE: best.sets[i].hoverDeltaE,
                        activeComputed: best.sets[i].activeComputed,
                        activeDeltaE: best.sets[i].activeDeltaE,
                        stateResults: s.targets.map((tHex, ti) => ({
                            targetHex: tHex,
                            percent: percents[ti] || percents[percents.length - 1],
                            computed: ti === 0 ? best.sets[i].hoverComputed : best.sets[i].activeComputed,
                            deltaE: ti === 0 ? best.sets[i].hoverDeltaE : best.sets[i].activeDeltaE,
                        })),
                    };
                }),
            };
        } else {
            const percents = [best.result.hoverPercent, best.result.activePercent];
            resultData = {
                mode: 'shared',
                blendHex: best.result.blendHex,
                colorSpace: best.space,
                hoverPercent: best.result.hoverPercent,
                activePercent: best.result.activePercent,
                percents,
                fixedHoverPct,
                fixedActivePct,
                sets: sets.map((s, i) => ({
                    name: s.name,
                    baseHex: s.baseHex,
                    targets: s.targets,
                    hoverTargetHex: s.hoverTargetHex,
                    activeTargetHex: s.activeTargetHex,
                    hoverComputed: best.result.sets[i].hoverComputed,
                    hoverDeltaE: best.result.sets[i].hoverDeltaE,
                    activeComputed: best.result.sets[i].activeComputed,
                    activeDeltaE: best.result.sets[i].activeDeltaE,
                    stateResults: s.targets.map((tHex, ti) => ({
                        targetHex: tHex,
                        percent: percents[ti] || percents[percents.length - 1],
                        computed: ti === 0 ? best.result.sets[i].hoverComputed : best.result.sets[i].activeComputed,
                        deltaE: ti === 0 ? best.result.sets[i].hoverDeltaE : best.result.sets[i].activeDeltaE,
                    })),
                })),
            };
        }
        renderResults(resultData);
        addHistoryEntry(resultData);
    };

    worker.onerror = function(err) {
        worker.terminate();
        showLoading(false);
        console.error(err);
        alert('An error occurred. Check the console for details.');
    };

    worker.postMessage({ mode, sets, forcedSpace, fixedHoverPct, fixedActivePct });
}
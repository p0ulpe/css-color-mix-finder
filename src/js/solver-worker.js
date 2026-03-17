// Runs the solver in a background thread so the UI stays responsive.
self.importScripts('./color-math.js', './color-solver.js');

self.onmessage = function(e) {
    const { mode, sets, forcedSpace, fixedPcts, fixedHoverPct, fixedActivePct } = e.data;
    // Use fixedPcts array if provided, otherwise build from legacy hover/active params
    const pcts = fixedPcts || [fixedHoverPct, fixedActivePct];
    try {
        let result;
        if (mode === 'per-set-blend') {
            result = findBestColorSpacePerSetBlend(sets, forcedSpace, pcts);
        } else if (mode === 'independent') {
            result = solveIndependent(sets, forcedSpace, pcts);
        } else {
            result = findBestColorSpaceMultiSet(sets, forcedSpace, pcts);
        }
        self.postMessage({ ok: true, result });
    } catch(err) {
        self.postMessage({ ok: false, error: err.message });
    }
};

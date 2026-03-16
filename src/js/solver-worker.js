// Runs the solver in a background thread so the UI stays responsive.
self.importScripts('./color-math.js', './color-solver.js');

self.onmessage = function(e) {
    const { mode, sets, forcedSpace, fixedHoverPct, fixedActivePct } = e.data;
    try {
        let result;
        if (mode === 'per-set-blend') {
            result = findBestColorSpacePerSetBlend(sets, forcedSpace, fixedHoverPct, fixedActivePct);
        } else if (mode === 'independent') {
            result = solveIndependent(sets, forcedSpace, fixedHoverPct, fixedActivePct);
        } else {
            result = findBestColorSpaceMultiSet(sets, forcedSpace, fixedHoverPct, fixedActivePct);
        }
        self.postMessage({ ok: true, result });
    } catch(err) {
        self.postMessage({ ok: false, error: err.message });
    }
};

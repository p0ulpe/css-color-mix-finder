// Runs the solver in a background thread so the UI stays responsive.
self.importScripts('./color-math.js', './color-solver.js');

self.onmessage = function(e) {
    const { mode, sets, forcedSpace, fixedPcts, fixedHoverPct, fixedActivePct } = e.data;
    // Use fixedPcts array if provided, otherwise build from legacy hover/active params
    const pcts = fixedPcts || [fixedHoverPct, fixedActivePct];
    // iOS Safari kills workers that run too long; budget to ~8s so we return a partial result
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const timeLimitMs = isIOS ? 8000 : 28000;
    const deadline = Date.now() + timeLimitMs;
    try {
        let result;
        if (mode === 'per-set-blend') {
            result = findBestColorSpacePerSetBlend(sets, forcedSpace, pcts, deadline);
        } else if (mode === 'independent') {
            result = solveIndependent(sets, forcedSpace, pcts, deadline);
        } else {
            result = findBestColorSpaceMultiSet(sets, forcedSpace, pcts, deadline);
        }
        self.postMessage({ ok: true, result });
    } catch(err) {
        self.postMessage({ ok: false, error: err.message });
    }
};

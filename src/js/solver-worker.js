// Runs findBestColorSpaceMultiSet in a background thread so the UI stays responsive.
self.importScripts('./color-math.js', './color-solver.js');

self.onmessage = function(e) {
    const { sets, forcedSpace, fixedHoverPct, fixedActivePct } = e.data;
    try {
        const result = findBestColorSpaceMultiSet(sets, forcedSpace, fixedHoverPct, fixedActivePct);
        self.postMessage({ ok: true, result });
    } catch(err) {
        self.postMessage({ ok: false, error: err.message });
    }
};

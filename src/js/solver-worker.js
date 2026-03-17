// Runs the solver in a background thread so the UI stays responsive.
self.importScripts('./color-math.js', './color-solver.js');

self.onmessage = function(e) {
    const { mode, sets, forcedSpace, fixedPcts, fixedHoverPct, fixedActivePct } = e.data;
    // Use fixedPcts array if provided, otherwise build from legacy hover/active params
    const pcts = fixedPcts || [fixedHoverPct, fixedActivePct];
    // Detect mobile to use a lean fast-mode solver (fewer candidates, one color space)
    // This avoids the iOS WKWebView Jetsam kill that happens with long-running workers
    const ua = (typeof self.navigator !== 'undefined' && self.navigator.userAgent) || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua) ||
        (typeof self.navigator !== 'undefined' && self.navigator.maxTouchPoints > 1);
    const timeLimitMs = isMobile ? 6000 : 28000;
    const deadline = Date.now() + timeLimitMs;
    try {
        let result;
        if (mode === 'per-set-blend') {
            result = findBestColorSpacePerSetBlend(sets, forcedSpace, pcts, deadline, isMobile);
        } else if (mode === 'independent') {
            result = solveIndependent(sets, forcedSpace, pcts, deadline, isMobile);
        } else {
            result = findBestColorSpaceMultiSet(sets, forcedSpace, pcts, deadline, isMobile);
        }
        self.postMessage({ ok: true, result });
    } catch(err) {
        self.postMessage({ ok: false, error: err.message });
    }
};

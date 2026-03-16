function findBestPercent(baseHex, targetHex, blendHex, space) {
    let best = null, bestDelta = Infinity;
    for (let pct = 1; pct <= 100; pct++) {
        const computed = colorMix(baseHex, blendHex, pct, space);
        const dE = deltaE(computed, targetHex);
        if (dE < bestDelta) {
            bestDelta = dE;
            best = { percent: pct, computedHex: computed, deltaE: dE };
        }
    }
    return best;
}

function solveBlendColor(baseHex, targetHex, space) {
    space = space || 'oklab';
    const rgb1 = hexToRgb(baseHex);
    const rgb2 = hexToRgb(targetHex);
    let best = null, bestDelta = Infinity;

    // pct is the CSS blend% in color-mix(base 100%, blend pct%)
    // effective blend fraction: t = pct / (100 + pct)
    // CSS requires both percentages in [0%, 100%], so pct max is 100
    for (let pct = 2; pct <= 100; pct++) {
        const t = pct / (100 + pct);
        let blendRgb;
        try {
            if (space === 'srgb') {
                blendRgb = {
                    r: (rgb2.r - rgb1.r*(1-t)) / t,
                    g: (rgb2.g - rgb1.g*(1-t)) / t,
                    b: (rgb2.b - rgb1.b*(1-t)) / t,
                };
            } else if (space === 'lab') {
                const lab1 = xyzToLab(rgbToXyz(rgb1)), lab2 = xyzToLab(rgbToXyz(rgb2));
                blendRgb = xyzToRgb(labToXyz({
                    l: (lab2.l - lab1.l*(1-t)) / t,
                    a: (lab2.a - lab1.a*(1-t)) / t,
                    b: (lab2.b - lab1.b*(1-t)) / t,
                }));
            } else if (space === 'oklab') {
                const ok1 = rgbToOklab(rgb1), ok2 = rgbToOklab(rgb2);
                blendRgb = oklabToRgb({
                    l: (ok2.l - ok1.l*(1-t)) / t,
                    a: (ok2.a - ok1.a*(1-t)) / t,
                    b: (ok2.b - ok1.b*(1-t)) / t,
                });
            }
        } catch(e) { continue; }

        const gamutError = Math.abs(blendRgb.r - Math.max(0,Math.min(255,Math.round(blendRgb.r))))
            + Math.abs(blendRgb.g - Math.max(0,Math.min(255,Math.round(blendRgb.g))))
            + Math.abs(blendRgb.b - Math.max(0,Math.min(255,Math.round(blendRgb.b))));
        if (gamutError > 30) continue;

        const blendHex = rgbToHex({
            r: Math.max(0,Math.min(255,Math.round(blendRgb.r))),
            g: Math.max(0,Math.min(255,Math.round(blendRgb.g))),
            b: Math.max(0,Math.min(255,Math.round(blendRgb.b))),
        });
        const computed = colorMix(baseHex, blendHex, pct, space);
        const dE = deltaE(computed, targetHex);
        if (dE < bestDelta) {
            bestDelta = dE;
            best = { blendHex, percent: pct, computedHex: computed, deltaE: dE };
        }
    }
    return best;
}

function generateBlendCandidates(hexA, hexB) {
    const candidates = new Set();
    const rgbA = hexToRgb(hexA), rgbB = hexToRgb(hexB);
    for (let t = 0; t <= 1; t += 0.05) {
        candidates.add(rgbToHex({
            r: Math.round(rgbA.r*(1-t)+rgbB.r*t),
            g: Math.round(rgbA.g*(1-t)+rgbB.g*t),
            b: Math.round(rgbA.b*(1-t)+rgbB.b*t),
        }));
    }
    candidates.add(hexA);
    candidates.add(hexB);
    for (const hex of [...candidates]) {
        const rgb = hexToRgb(hex);
        for (let dr = -15; dr <= 15; dr += 5)
            for (let dg = -15; dg <= 15; dg += 5)
                for (let db = -15; db <= 15; db += 5)
                    candidates.add(rgbToHex({
                        r: Math.max(0,Math.min(255,rgb.r+dr)),
                        g: Math.max(0,Math.min(255,rgb.g+dg)),
                        b: Math.max(0,Math.min(255,rgb.b+db)),
                    }));
    }
    return [...candidates];
}

function solveSharedBlendColor(baseHex, hoverTargetHex, activeTargetHex, space) {
    space = space || 'oklab';
    const hoverSol = solveBlendColor(baseHex, hoverTargetHex, space);
    const activeSol = solveBlendColor(baseHex, activeTargetHex, space);
    if (!hoverSol || !activeSol) return null;

    let best = null, bestScore = Infinity;
    const candidates = generateBlendCandidates(hoverSol.blendHex, activeSol.blendHex);

    for (const candidateHex of candidates) {
        const hFit = findBestPercent(baseHex, hoverTargetHex, candidateHex, space);
        const aFit = findBestPercent(baseHex, activeTargetHex, candidateHex, space);
        if (!hFit || !aFit) continue;
        const total = hFit.deltaE + aFit.deltaE;
        if (total < bestScore) {
            bestScore = total;
            best = {
                blendHex: candidateHex,
                hoverPercent: hFit.percent,
                activePercent: aFit.percent,
                hoverComputed: hFit.computedHex,
                activeComputed: aFit.computedHex,
                hoverDeltaE: hFit.deltaE,
                activeDeltaE: aFit.deltaE,
                totalDeltaE: total,
            };
        }
    }
    return best;
}

function findBestColorSpace(baseHex, hoverTargetHex, activeTargetHex, fixedHoverPct, fixedActivePct, forcedSpace) {
    const spaces = forcedSpace ? [forcedSpace] : ['oklab', 'lab', 'srgb'];
    let best = null, bestScore = Infinity;
    for (const space of spaces) {
        try {
            const result = solveWithConstraints(baseHex, hoverTargetHex, activeTargetHex, space,
                fixedHoverPct != null ? fixedHoverPct : null,
                fixedActivePct != null ? fixedActivePct : null);
            if (result && result.totalDeltaE < bestScore) {
                bestScore = result.totalDeltaE;
                best = { space, result };
            }
        } catch(e) {}
    }
    return best;
}

// ── Multi-set solver (shared blend color + shared hover% + shared active%) ──
// sets: array of { baseHex, hoverTargetHex, activeTargetHex }
// fixedHoverPct / fixedActivePct: null (auto) or number 1-100 (lock that state's %)
// Returns { blendHex, hoverPercent, activePercent, totalDeltaE,
//           sets: [{ hoverComputed, hoverDeltaE, activeComputed, activeDeltaE }] }
function solveMultiSet(sets, space, fixedHoverPct, fixedActivePct) {
    space = space || 'oklab';

    // 1. Gather seed blend colors from each set's individual solution
    const seeds = [];
    for (const s of sets) {
        const hSeed = solveBlendColor(s.baseHex, s.hoverTargetHex, space);
        const aSeed = solveBlendColor(s.baseHex, s.activeTargetHex, space);
        if (hSeed) seeds.push(hSeed.blendHex);
        if (aSeed) seeds.push(aSeed.blendHex);
    }
    if (seeds.length === 0) return null;

    // 2. Build candidate pool from all pairs of seeds + centroid
    const allCandidates = new Set();
    for (const hex of seeds) allCandidates.add(hex);

    // Add centroid (average of all seeds)
    const seedRgbs = seeds.map(h => hexToRgb(h));
    const centroid = rgbToHex({
        r: Math.round(seedRgbs.reduce((s, c) => s + c.r, 0) / seedRgbs.length),
        g: Math.round(seedRgbs.reduce((s, c) => s + c.g, 0) / seedRgbs.length),
        b: Math.round(seedRgbs.reduce((s, c) => s + c.b, 0) / seedRgbs.length),
    });
    allCandidates.add(centroid);

    // Pair-wise interpolation + neighborhood
    for (let i = 0; i < seeds.length; i++) {
        for (let j = i + 1; j < seeds.length; j++) {
            for (const c of generateBlendCandidates(seeds[i], seeds[j])) {
                allCandidates.add(c);
            }
        }
    }
    // Also interpolate each seed with the centroid
    for (const hex of seeds) {
        for (const c of generateBlendCandidates(hex, centroid)) {
            allCandidates.add(c);
        }
    }
    if (seeds.length === 1) {
        for (const c of generateBlendCandidates(seeds[0], seeds[0])) {
            allCandidates.add(c);
        }
    }

    // Helper: evaluate a candidate, returns { hPct, aPct, worstDE, setResults, totalDeltaE }
    const fineHover = fixedHoverPct != null ? [fixedHoverPct] : Array.from({ length: 100 }, (_, i) => i + 1);
    const fineActive = fixedActivePct != null ? [fixedActivePct] : Array.from({ length: 100 }, (_, i) => i + 1);

    function evaluateCandidate(candidateHex) {
        let bestHPct = null, bestHWorst = Infinity;
        for (const hPct of fineHover) {
            let worstDE = 0;
            for (const s of sets) { const dE = deltaE(colorMix(s.baseHex, candidateHex, hPct, space), s.hoverTargetHex); if (dE > worstDE) worstDE = dE; }
            if (worstDE < bestHWorst) { bestHWorst = worstDE; bestHPct = hPct; }
        }
        let bestAPct = null, bestAWorst = Infinity;
        for (const aPct of fineActive) {
            let worstDE = 0;
            for (const s of sets) { const dE = deltaE(colorMix(s.baseHex, candidateHex, aPct, space), s.activeTargetHex); if (dE > worstDE) worstDE = dE; }
            if (worstDE < bestAWorst) { bestAWorst = worstDE; bestAPct = aPct; }
        }
        const worstDE = Math.max(bestHWorst, bestAWorst);
        const setResults = [];
        let totalDeltaE = 0;
        for (const s of sets) {
            const hComp = colorMix(s.baseHex, candidateHex, bestHPct, space);
            const aComp = colorMix(s.baseHex, candidateHex, bestAPct, space);
            const hDE = deltaE(hComp, s.hoverTargetHex);
            const aDE = deltaE(aComp, s.activeTargetHex);
            totalDeltaE += hDE + aDE;
            setResults.push({ hoverComputed: hComp, hoverDeltaE: hDE, activeComputed: aComp, activeDeltaE: aDE });
        }
        return { hPct: bestHPct, aPct: bestAPct, worstDE, setResults, totalDeltaE };
    }

    // ── Phase 1: coarse scan to rank candidates ──
    const coarseHover = fixedHoverPct != null ? [fixedHoverPct] : [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100];
    const coarseActive = fixedActivePct != null ? [fixedActivePct] : [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100];

    const candidates = [...allCandidates];
    const coarseScores = [];
    for (const candidateHex of candidates) {
        let bestH = Infinity, bestA = Infinity;
        for (const hPct of coarseHover) {
            let worstDE = 0;
            for (const s of sets) { const dE = deltaE(colorMix(s.baseHex, candidateHex, hPct, space), s.hoverTargetHex); if (dE > worstDE) worstDE = dE; }
            if (worstDE < bestH) bestH = worstDE;
        }
        for (const aPct of coarseActive) {
            let worstDE = 0;
            for (const s of sets) { const dE = deltaE(colorMix(s.baseHex, candidateHex, aPct, space), s.activeTargetHex); if (dE > worstDE) worstDE = dE; }
            if (worstDE < bestA) bestA = worstDE;
        }
        coarseScores.push({ hex: candidateHex, score: Math.max(bestH, bestA) });
    }
    coarseScores.sort((a, b) => a.score - b.score);
    const finalists = coarseScores.slice(0, 80);

    // ── Phase 2: fine scan on top candidates ──
    let best = null, bestScore = Infinity;
    for (const { hex: candidateHex } of finalists) {
        const ev = evaluateCandidate(candidateHex);
        if (ev.worstDE < bestScore) {
            bestScore = ev.worstDE;
            best = { blendHex: candidateHex, hoverPercent: ev.hPct, activePercent: ev.aPct, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
        }
    }

    // ── Phase 3: iterative hill-climbing refinement ──
    // Multiple rounds: each round explores ±8 around the current best,
    // then narrows to ±3 for fine-tuning. This "walks" toward the optimum.
    if (best) {
        const radii = [10, 6, 3];  // progressively tighter
        for (const radius of radii) {
            const rgb = hexToRgb(best.blendHex);
            const step = radius > 6 ? 2 : 1;
            const refinedCandidates = new Set();
            for (let dr = -radius; dr <= radius; dr += step)
                for (let dg = -radius; dg <= radius; dg += step)
                    for (let db = -radius; db <= radius; db += step)
                        refinedCandidates.add(rgbToHex({
                            r: Math.max(0, Math.min(255, rgb.r + dr)),
                            g: Math.max(0, Math.min(255, rgb.g + dg)),
                            b: Math.max(0, Math.min(255, rgb.b + db)),
                        }));
            for (const candidateHex of refinedCandidates) {
                const ev = evaluateCandidate(candidateHex);
                if (ev.worstDE < bestScore) {
                    bestScore = ev.worstDE;
                    best = { blendHex: candidateHex, hoverPercent: ev.hPct, activePercent: ev.aPct, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                }
            }
        }

        // Also explore around top-5 finalists (may find a different basin)
        const topHexes = finalists.slice(0, 5).map(f => f.hex);
        for (const hex of topHexes) {
            if (hex === best.blendHex) continue;
            const rgb = hexToRgb(hex);
            const refinedCandidates = new Set();
            for (let dr = -6; dr <= 6; dr += 1)
                for (let dg = -6; dg <= 6; dg += 1)
                    for (let db = -6; db <= 6; db += 1)
                        refinedCandidates.add(rgbToHex({
                            r: Math.max(0, Math.min(255, rgb.r + dr)),
                            g: Math.max(0, Math.min(255, rgb.g + dg)),
                            b: Math.max(0, Math.min(255, rgb.b + db)),
                        }));
            for (const candidateHex of refinedCandidates) {
                const ev = evaluateCandidate(candidateHex);
                if (ev.worstDE < bestScore) {
                    bestScore = ev.worstDE;
                    best = { blendHex: candidateHex, hoverPercent: ev.hPct, activePercent: ev.aPct, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                }
            }
        }

        // Final tight pass around the winner
        {
            const rgb = hexToRgb(best.blendHex);
            for (let dr = -3; dr <= 3; dr++)
                for (let dg = -3; dg <= 3; dg++)
                    for (let db = -3; db <= 3; db++) {
                        const candidateHex = rgbToHex({
                            r: Math.max(0, Math.min(255, rgb.r + dr)),
                            g: Math.max(0, Math.min(255, rgb.g + dg)),
                            b: Math.max(0, Math.min(255, rgb.b + db)),
                        });
                        const ev = evaluateCandidate(candidateHex);
                        if (ev.worstDE < bestScore) {
                            bestScore = ev.worstDE;
                            best = { blendHex: candidateHex, hoverPercent: ev.hPct, activePercent: ev.aPct, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                        }
                    }
        }
    }

    return best;
}

function findBestColorSpaceMultiSet(sets, forcedSpace, fixedHoverPct, fixedActivePct) {
    const spaces = forcedSpace ? [forcedSpace] : ['oklab', 'lab', 'srgb'];
    let best = null, bestWorst = Infinity;
    for (const space of spaces) {
        try {
            const result = solveMultiSet(sets, space, fixedHoverPct, fixedActivePct);
            if (!result) continue;
            // Compare by worst individual deltaE (minimax across spaces too)
            const worstDE = Math.max(...result.sets.map(s => Math.max(s.hoverDeltaE, s.activeDeltaE)));
            if (worstDE < bestWorst) {
                bestWorst = worstDE;
                best = { space, result };
            }
        } catch(e) {}
    }
    return best;
}

// Evaluate a fixed pct without searching
function fitAtFixedPct(baseHex, targetHex, blendHex, pct, space) {
    const computedHex = colorMix(baseHex, blendHex, pct, space);
    return { percent: pct, computedHex, deltaE: deltaE(computedHex, targetHex) };
}

// Analytically invert colorMix at a specific pct to find ideal blend color
function solveBlendColorAtPct(baseHex, targetHex, pct, space) {
    const t = pct / (100 + pct);
    const rgb1 = hexToRgb(baseHex), rgb2 = hexToRgb(targetHex);
    let blendRgb;
    try {
        if (space === 'srgb') {
            blendRgb = { r: (rgb2.r - rgb1.r*(1-t))/t, g: (rgb2.g - rgb1.g*(1-t))/t, b: (rgb2.b - rgb1.b*(1-t))/t };
        } else if (space === 'lab') {
            const lab1 = xyzToLab(rgbToXyz(rgb1)), lab2 = xyzToLab(rgbToXyz(rgb2));
            blendRgb = xyzToRgb(labToXyz({ l: (lab2.l-lab1.l*(1-t))/t, a: (lab2.a-lab1.a*(1-t))/t, b: (lab2.b-lab1.b*(1-t))/t }));
        } else {
            const ok1 = rgbToOklab(rgb1), ok2 = rgbToOklab(rgb2);
            blendRgb = oklabToRgb({ l: (ok2.l-ok1.l*(1-t))/t, a: (ok2.a-ok1.a*(1-t))/t, b: (ok2.b-ok1.b*(1-t))/t });
        }
    } catch(e) { return null; }
    const blendHex = rgbToHex({
        r: Math.max(0,Math.min(255,Math.round(blendRgb.r))),
        g: Math.max(0,Math.min(255,Math.round(blendRgb.g))),
        b: Math.max(0,Math.min(255,Math.round(blendRgb.b))),
    });
    const computedHex = colorMix(baseHex, blendHex, pct, space);
    return { blendHex, percent: pct, computedHex, deltaE: deltaE(computedHex, targetHex) };
}

// Solve with optional fixed percentages (null = free, number = locked)
function solveWithConstraints(baseHex, hoverTargetHex, activeTargetHex, space, fixedHoverPct, fixedActivePct) {
    space = space || 'oklab';
    const hoverSeed = fixedHoverPct !== null
        ? solveBlendColorAtPct(baseHex, hoverTargetHex, fixedHoverPct, space)
        : solveBlendColor(baseHex, hoverTargetHex, space);
    const activeSeed = fixedActivePct !== null
        ? solveBlendColorAtPct(baseHex, activeTargetHex, fixedActivePct, space)
        : solveBlendColor(baseHex, activeTargetHex, space);
    if (!hoverSeed || !activeSeed) return null;

    const candidates = generateBlendCandidates(hoverSeed.blendHex, activeSeed.blendHex);
    let best = null, bestScore = Infinity;

    for (const candidateHex of candidates) {
        const hFit = fixedHoverPct !== null
            ? fitAtFixedPct(baseHex, hoverTargetHex, candidateHex, fixedHoverPct, space)
            : findBestPercent(baseHex, hoverTargetHex, candidateHex, space);
        const aFit = fixedActivePct !== null
            ? fitAtFixedPct(baseHex, activeTargetHex, candidateHex, fixedActivePct, space)
            : findBestPercent(baseHex, activeTargetHex, candidateHex, space);
        if (!hFit || !aFit) continue;
        const total = hFit.deltaE + aFit.deltaE;
        if (total < bestScore) {
            bestScore = total;
            best = {
                blendHex: candidateHex,
                hoverPercent: hFit.percent,
                activePercent: aFit.percent,
                hoverComputed: hFit.computedHex,
                activeComputed: aFit.computedHex,
                hoverDeltaE: hFit.deltaE,
                activeDeltaE: aFit.deltaE,
                totalDeltaE: total,
            };
        }
    }
    return best;
}
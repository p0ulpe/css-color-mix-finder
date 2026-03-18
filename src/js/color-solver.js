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

function generateBlendCandidates(hexA, hexB, fastMode) {
    const candidates = new Set();
    const rgbA = hexToRgb(hexA), rgbB = hexToRgb(hexB);
    if (fastMode) {
        // Lean: 11-step lerp + small neighbourhood around each endpoint only
        // ~250 candidates per pair vs ~7000 for full search
        for (let t = 0; t <= 10; t++) {
            candidates.add(rgbToHex({
                r: Math.round(rgbA.r*(1-t/10)+rgbB.r*(t/10)),
                g: Math.round(rgbA.g*(1-t/10)+rgbB.g*(t/10)),
                b: Math.round(rgbA.b*(1-t/10)+rgbB.b*(t/10)),
            }));
        }
        for (const hex of [hexA, hexB]) {
            const rgb = hexToRgb(hex);
            for (let dr = -10; dr <= 10; dr += 5)
                for (let dg = -10; dg <= 10; dg += 5)
                    for (let db = -10; db <= 10; db += 5)
                        candidates.add(rgbToHex({
                            r: Math.max(0,Math.min(255,rgb.r+dr)),
                            g: Math.max(0,Math.min(255,rgb.g+dg)),
                            b: Math.max(0,Math.min(255,rgb.b+db)),
                        }));
        }
    } else {
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

function findBestColorSpace(baseHex, targets, fixedPcts, forcedSpace, fastMode) {
    fixedPcts = fixedPcts || [];
    const spaces = forcedSpace ? [forcedSpace] : (fastMode ? ['oklab'] : ['oklab', 'lab', 'srgb']);
    let best = null, bestScore = Infinity;
    for (const space of spaces) {
        try {
            const result = solveWithConstraints(baseHex, targets, space, fixedPcts, fastMode);
            if (!result) continue;
            const worstDE = Math.max(...result.stateResults.map(r => r.deltaE));
            if (worstDE < bestScore) {
                bestScore = worstDE;
                best = { space, result };
            }
        } catch(e) {}
    }
    return best;
}

// ── Multi-set solver (shared blend color + shared % per target index) ────────
// sets: array of { baseHex, targets: [hex, …] }
// fixedPcts: array where fixedPcts[i] locks target-i's %  (null = auto)
// Returns { blendHex, percents: [...], totalDeltaE,
//           sets: [{ stateResults: [{ targetHex, computed, deltaE, percent }] }] }
function solveMultiSet(sets, space, fixedPcts, deadline, fastMode) {
    space = space || 'oklab';
    fixedPcts = fixedPcts || [];
    const numTargets = Math.max(...sets.map(s => s.targets.length));

    // 1. Gather seed blend colors from each set's targets
    const seeds = [];
    for (const s of sets) {
        for (const target of s.targets) {
            const seed = solveBlendColor(s.baseHex, target, space);
            if (seed) seeds.push(seed.blendHex);
        }
    }
    if (seeds.length === 0) return null;

    // 2. Build candidate pool from all pairs of seeds + centroid
    const allCandidates = new Set();
    for (const hex of seeds) allCandidates.add(hex);

    const seedRgbs = seeds.map(h => hexToRgb(h));
    const centroid = rgbToHex({
        r: Math.round(seedRgbs.reduce((s, c) => s + c.r, 0) / seedRgbs.length),
        g: Math.round(seedRgbs.reduce((s, c) => s + c.g, 0) / seedRgbs.length),
        b: Math.round(seedRgbs.reduce((s, c) => s + c.b, 0) / seedRgbs.length),
    });
    allCandidates.add(centroid);

    for (let i = 0; i < seeds.length; i++) {
        for (let j = i + 1; j < seeds.length; j++) {
            for (const c of generateBlendCandidates(seeds[i], seeds[j], fastMode)) {
                allCandidates.add(c);
            }
        }
    }
    for (const hex of seeds) {
        for (const c of generateBlendCandidates(hex, centroid, fastMode)) {
            allCandidates.add(c);
        }
    }
    if (seeds.length === 1) {
        for (const c of generateBlendCandidates(seeds[0], seeds[0], fastMode)) {
            allCandidates.add(c);
        }
    }

    // Helper: evaluate a candidate across all sets × all targets
    const COARSE_PCTS = [1, 7, 14, 21, 28, 36, 44, 53, 62, 71, 80, 89, 97, 100];

    function evaluateCandidate(candidateHex) {
        const pctResults = [];
        let worstDE = 0;
        for (let ti = 0; ti < numTargets; ti++) {
            const fixed = fixedPcts[ti] != null ? fixedPcts[ti] : null;
            const coarse = fixed != null ? [fixed] : COARSE_PCTS;
            let coarseBest = 1, coarseBestWorst = Infinity;
            for (const p of coarse) {
                let worst = 0;
                for (const s of sets) {
                    const target = s.targets[ti] || s.targets[s.targets.length - 1];
                    const dE = deltaE(colorMix(s.baseHex, candidateHex, p, space), target);
                    if (dE > worst) worst = dE;
                }
                if (worst < coarseBestWorst) { coarseBestWorst = worst; coarseBest = p; }
            }
            if (fixed != null) {
                pctResults.push({ pct: coarseBest, worst: coarseBestWorst });
            } else {
                let bestWorst = Infinity, bestPct = coarseBest;
                const lo = Math.max(1, coarseBest - 8), hi = Math.min(100, coarseBest + 8);
                for (let p = lo; p <= hi; p++) {
                    let worst = 0;
                    for (const s of sets) {
                        const target = s.targets[ti] || s.targets[s.targets.length - 1];
                        const dE = deltaE(colorMix(s.baseHex, candidateHex, p, space), target);
                        if (dE > worst) worst = dE;
                    }
                    if (worst < bestWorst) { bestWorst = worst; bestPct = p; }
                }
                pctResults.push({ pct: bestPct, worst: bestWorst });
            }
            if (pctResults[ti].worst > worstDE) worstDE = pctResults[ti].worst;
        }

        const percents = pctResults.map(r => r.pct);
        const setResults = [];
        let totalDeltaE = 0;
        for (const s of sets) {
            const stateResults = [];
            for (let ti = 0; ti < numTargets; ti++) {
                const target = s.targets[ti] || s.targets[s.targets.length - 1];
                const comp = colorMix(s.baseHex, candidateHex, percents[ti], space);
                const dE = deltaE(comp, target);
                totalDeltaE += dE;
                stateResults.push({ targetHex: target, computed: comp, deltaE: dE, percent: percents[ti] });
            }
            setResults.push({
                stateResults,
                hoverComputed: stateResults[0]?.computed,
                hoverDeltaE: stateResults[0]?.deltaE || 0,
                activeComputed: (stateResults[1] || stateResults[0])?.computed,
                activeDeltaE: (stateResults[1] || stateResults[0])?.deltaE || 0,
            });
        }
        return { percents, worstDE, setResults, totalDeltaE };
    }

    // ── Phase 1: coarse scan to rank candidates ──
    const COARSE_SCAN = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100];
    const candidates = [...allCandidates];
    const coarseScores = [];
    for (const candidateHex of candidates) {
        let maxWorst = 0;
        for (let ti = 0; ti < numTargets; ti++) {
            const coarsePcts = fixedPcts[ti] != null ? [fixedPcts[ti]] : COARSE_SCAN;
            let bestForTarget = Infinity;
            for (const p of coarsePcts) {
                let worst = 0;
                for (const s of sets) {
                    const target = s.targets[ti] || s.targets[s.targets.length - 1];
                    const dE = deltaE(colorMix(s.baseHex, candidateHex, p, space), target);
                    if (dE > worst) worst = dE;
                }
                if (worst < bestForTarget) bestForTarget = worst;
            }
            if (bestForTarget > maxWorst) maxWorst = bestForTarget;
        }
        coarseScores.push({ hex: candidateHex, score: maxWorst });
    }
    coarseScores.sort((a, b) => a.score - b.score);
    const finalists = coarseScores.slice(0, fastMode ? 20 : 80);

    // ── Phase 2: fine scan on top candidates ──
    let best = null, bestScore = Infinity;
    for (const { hex: candidateHex } of finalists) {
        if ((deadline && Date.now() > deadline && best) || (fastMode && bestScore < 1.0)) break;
        const ev = evaluateCandidate(candidateHex);
        if (ev.worstDE < bestScore) {
            bestScore = ev.worstDE;
            best = { blendHex: candidateHex, percents: ev.percents, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
        }
    }

    // ── Phase 3: iterative hill-climbing refinement ──
    if (best) {
        if (!fastMode) {
            const radii = [10, 6, 3];
            for (const radius of radii) {
                if (bestScore < 0.5 || (deadline && Date.now() > deadline)) break;
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
                        best = { blendHex: candidateHex, percents: ev.percents, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                        if (bestScore < 0.5) break;
                    }
                }
            }

            const topHexes = finalists.slice(0, 5).map(f => f.hex);
            for (const hex of topHexes) {
                if (bestScore < 0.5 || (deadline && Date.now() > deadline)) break;
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
                        best = { blendHex: candidateHex, percents: ev.percents, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                        if (bestScore < 0.5) break;
                    }
                }
            }
        }

        // Final tight pass around the winner (all modes)
        if (!(deadline && Date.now() > deadline)) {
            const rgb = hexToRgb(best.blendHex);
            const finalR = fastMode ? 2 : 3;
            for (let dr = -finalR; dr <= finalR; dr++)
                for (let dg = -finalR; dg <= finalR; dg++)
                    for (let db = -finalR; db <= finalR; db++) {
                        const candidateHex = rgbToHex({
                            r: Math.max(0, Math.min(255, rgb.r + dr)),
                            g: Math.max(0, Math.min(255, rgb.g + dg)),
                            b: Math.max(0, Math.min(255, rgb.b + db)),
                        });
                        const ev = evaluateCandidate(candidateHex);
                        if (ev.worstDE < bestScore) {
                            bestScore = ev.worstDE;
                            best = { blendHex: candidateHex, percents: ev.percents, totalDeltaE: ev.totalDeltaE, sets: ev.setResults };
                        }
                    }
        }
    }

    // Backward compat
    if (best) {
        best.hoverPercent = best.percents[0];
        best.activePercent = best.percents[1] || best.percents[0];
    }

    return best;
}

function findBestColorSpaceMultiSet(sets, forcedSpace, fixedPcts, deadline, fastMode) {
    const spaces = forcedSpace ? [forcedSpace] : (fastMode ? ['oklab'] : ['oklab', 'lab', 'srgb']);
    let best = null, bestWorst = Infinity;
    for (const space of spaces) {
        if (deadline && Date.now() > deadline && best) break;
        try {
            const result = solveMultiSet(sets, space, fixedPcts, deadline, fastMode);
            if (!result) continue;
            const worstDE = Math.max(...result.sets.map(s => Math.max(...s.stateResults.map(r => r.deltaE))));
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

// Solve with optional fixed percentages for N targets
function solveWithConstraints(baseHex, targets, space, fixedPcts, fastMode) {
    space = space || 'oklab';
    fixedPcts = fixedPcts || [];

    // Get seed blends from each target
    const seedHexes = [];
    for (let ti = 0; ti < targets.length; ti++) {
        const fixed = fixedPcts[ti] != null ? fixedPcts[ti] : null;
        const seed = fixed !== null
            ? solveBlendColorAtPct(baseHex, targets[ti], fixed, space)
            : solveBlendColor(baseHex, targets[ti], space);
        if (seed) seedHexes.push(seed.blendHex);
    }
    if (seedHexes.length === 0) return null;

    // Build candidates from seed pairs
    const cs = new Set();
    if (seedHexes.length === 1) {
        for (const c of generateBlendCandidates(seedHexes[0], seedHexes[0], fastMode)) cs.add(c);
    } else {
        for (let i = 0; i < seedHexes.length; i++) {
            for (let j = i + 1; j < seedHexes.length; j++) {
                for (const c of generateBlendCandidates(seedHexes[i], seedHexes[j], fastMode)) cs.add(c);
            }
        }
        const rgbs = seedHexes.map(h => hexToRgb(h));
        cs.add(rgbToHex({
            r: Math.round(rgbs.reduce((s,c)=>s+c.r,0)/rgbs.length),
            g: Math.round(rgbs.reduce((s,c)=>s+c.g,0)/rgbs.length),
            b: Math.round(rgbs.reduce((s,c)=>s+c.b,0)/rgbs.length),
        }));
    }

    let best = null, bestScore = Infinity;
    for (const candidateHex of cs) {
        const fits = [];
        let worstDE = 0, totalDE = 0, valid = true;
        for (let ti = 0; ti < targets.length; ti++) {
            const fit = fixedPcts[ti] != null
                ? fitAtFixedPct(baseHex, targets[ti], candidateHex, fixedPcts[ti], space)
                : findBestPercent(baseHex, targets[ti], candidateHex, space);
            if (!fit) { valid = false; break; }
            fits.push(fit);
            if (fit.deltaE > worstDE) worstDE = fit.deltaE;
            totalDE += fit.deltaE;
        }
        if (!valid) continue;
        if (worstDE < bestScore) {
            bestScore = worstDE;
            best = {
                blendHex: candidateHex,
                percents: fits.map(f => f.percent),
                totalDeltaE: totalDE,
                stateResults: fits.map((f, ti) => ({
                    targetHex: targets[ti],
                    computed: f.computedHex,
                    deltaE: f.deltaE,
                    percent: f.percent,
                })),
                hoverPercent: fits[0]?.percent,
                activePercent: (fits[1] || fits[0])?.percent,
                hoverComputed: fits[0]?.computedHex,
                activeComputed: (fits[1] || fits[0])?.computedHex,
                hoverDeltaE: fits[0]?.deltaE,
                activeDeltaE: (fits[1] || fits[0])?.deltaE,
            };
        }
    }
    return best;
}

// ── Per-set blend colors with shared % per target index ──────────────────────
// Finds optimal shared percentages (one per target index), then for each set
// independently finds the best blend color at those fixed pcts.
function solvePerSetBlendSharedPct(sets, space, fixedPcts, fastMode) {
    space = space || 'oklab';
    fixedPcts = fixedPcts || [];
    const numTargets = Math.max(...sets.map(s => s.targets.length));

    // Light blend search: interpolation between analytical seeds (fast, for pct grid search)
    function bestBlendForSetLight(s, pcts) {
        const sols = [];
        for (let ti = 0; ti < pcts.length && ti < s.targets.length; ti++) {
            const sol = solveBlendColorAtPct(s.baseHex, s.targets[ti], pcts[ti], space);
            if (sol) sols.push(sol.blendHex);
        }
        if (sols.length === 0) return null;
        const candidateBlends = new Set();
        for (const h of sols) candidateBlends.add(h);
        if (sols.length >= 2) {
            for (let i = 0; i < sols.length; i++) {
                for (let j = i + 1; j < sols.length; j++) {
                    const rgbI = hexToRgb(sols[i]), rgbJ = hexToRgb(sols[j]);
                    for (let k = 0; k <= 20; k++) {
                        const t = k / 20;
                        candidateBlends.add(rgbToHex({
                            r: Math.max(0, Math.min(255, Math.round(rgbI.r*(1-t)+rgbJ.r*t))),
                            g: Math.max(0, Math.min(255, Math.round(rgbI.g*(1-t)+rgbJ.g*t))),
                            b: Math.max(0, Math.min(255, Math.round(rgbI.b*(1-t)+rgbJ.b*t))),
                        }));
                    }
                }
            }
        }
        return evalBlendCandidates(s, pcts, candidateBlends);
    }

    // Full blend search with generateBlendCandidates (for final refinement)
    function bestBlendForSetFull(s, pcts) {
        const sols = [];
        for (let ti = 0; ti < pcts.length && ti < s.targets.length; ti++) {
            const sol = solveBlendColorAtPct(s.baseHex, s.targets[ti], pcts[ti], space);
            if (sol) sols.push(sol.blendHex);
        }
        if (sols.length === 0) return null;
        const candidateBlends = new Set();
        if (sols.length === 1) {
            for (const c of generateBlendCandidates(sols[0], sols[0], fastMode)) candidateBlends.add(c);
        } else {
            for (let i = 0; i < sols.length; i++) {
                for (let j = i + 1; j < sols.length; j++) {
                    for (const c of generateBlendCandidates(sols[i], sols[j], fastMode)) candidateBlends.add(c);
                }
            }
            const rgbs = sols.map(h => hexToRgb(h));
            const centroid = rgbToHex({
                r: Math.round(rgbs.reduce((a,c)=>a+c.r,0)/rgbs.length),
                g: Math.round(rgbs.reduce((a,c)=>a+c.g,0)/rgbs.length),
                b: Math.round(rgbs.reduce((a,c)=>a+c.b,0)/rgbs.length),
            });
            candidateBlends.add(centroid);
        }
        return evalBlendCandidates(s, pcts, candidateBlends);
    }

    // Select blend by minimax (lowest worst-target deltaE) within each set
    function evalBlendCandidates(s, pcts, candidateBlends) {
        let best = null, bestWorstDE = Infinity;
        for (const cHex of candidateBlends) {
            let worstDE = 0, totalDE = 0;
            const stateResults = [];
            for (let ti = 0; ti < pcts.length && ti < s.targets.length; ti++) {
                const comp = colorMix(s.baseHex, cHex, pcts[ti], space);
                const dE = deltaE(comp, s.targets[ti]);
                totalDE += dE;
                if (dE > worstDE) worstDE = dE;
                stateResults.push({ targetHex: s.targets[ti], computed: comp, deltaE: dE, percent: pcts[ti] });
            }
            if (worstDE < bestWorstDE) {
                bestWorstDE = worstDE;
                best = {
                    blendHex: cHex,
                    stateResults,
                    totalDeltaE: totalDE,
                    hoverComputed: stateResults[0]?.computed,
                    hoverDeltaE: stateResults[0]?.deltaE || 0,
                    activeComputed: (stateResults[1] || stateResults[0])?.computed,
                    activeDeltaE: (stateResults[1] || stateResults[0])?.deltaE || 0,
                };
            }
        }
        return best;
    }

    const COARSE = [1, 7, 14, 21, 28, 36, 44, 53, 62, 71, 80, 89, 97, 100];

    function evalPctsLight(pcts) {
        let totalDE = 0, worstDE = 0, valid = true;
        const setResults = [];
        for (const s of sets) {
            const res = bestBlendForSetLight(s, pcts);
            if (!res) { valid = false; break; }
            totalDE += res.totalDeltaE;
            const setWorst = Math.max(...res.stateResults.map(r => r.deltaE));
            if (setWorst > worstDE) worstDE = setWorst;
            setResults.push(res);
        }
        return valid ? { totalDE, worstDE, setResults } : null;
    }

    function evalPctsFull(pcts) {
        let totalDE = 0, worstDE = 0, valid = true;
        const setResults = [];
        for (const s of sets) {
            const res = bestBlendForSetFull(s, pcts);
            if (!res) { valid = false; break; }
            totalDE += res.totalDeltaE;
            const setWorst = Math.max(...res.stateResults.map(r => r.deltaE));
            if (setWorst > worstDE) worstDE = setWorst;
            setResults.push(res);
        }
        return valid ? { totalDE, worstDE, setResults } : null;
    }

    if (numTargets <= 2) {
        // ── 2D grid search ──
        const ranges = [];
        for (let ti = 0; ti < numTargets; ti++) {
            ranges.push(fixedPcts[ti] != null ? [fixedPcts[ti]] : COARSE);
        }

        // Phase 1: coarse scan — use analytical deltaE as proxy (minimax across sets)
        const coarseScores = [];
        if (numTargets === 1) {
            for (const p0 of ranges[0]) {
                let worstDE = 0, valid = true;
                for (const s of sets) {
                    const target = s.targets[0] || s.targets[s.targets.length - 1];
                    const sol = solveBlendColorAtPct(s.baseHex, target, p0, space);
                    if (!sol) { valid = false; break; }
                    if (sol.deltaE > worstDE) worstDE = sol.deltaE;
                }
                if (valid) coarseScores.push({ pcts: [p0], score: worstDE });
            }
        } else {
            for (const p0 of ranges[0]) {
                for (const p1 of ranges[1]) {
                    let worstDE = 0, valid = true;
                    for (const s of sets) {
                        let setWorst = 0;
                        for (let ti = 0; ti < 2; ti++) {
                            const target = s.targets[ti] || s.targets[s.targets.length - 1];
                            const pct = ti === 0 ? p0 : p1;
                            const sol = solveBlendColorAtPct(s.baseHex, target, pct, space);
                            if (!sol) { valid = false; break; }
                            if (sol.deltaE > setWorst) setWorst = sol.deltaE;
                        }
                        if (!valid) break;
                        if (setWorst > worstDE) worstDE = setWorst;
                    }
                    if (valid) coarseScores.push({ pcts: [p0, p1], score: worstDE });
                }
            }
        }
        coarseScores.sort((a, b) => a.score - b.score);
        if (coarseScores.length === 0) return null;

        // Phase 2: expand top-30 coarse results ±6, evaluate with light blend, score by worstDE
        const pairsToEval = new Map();
        for (const { pcts } of coarseScores.slice(0, 30)) {
            if (numTargets === 1) {
                if (fixedPcts[0] != null) {
                    pairsToEval.set(pcts[0], [pcts[0]]);
                } else {
                    for (let d = -6; d <= 6; d++) {
                        const p = Math.max(1, Math.min(100, pcts[0] + d));
                        pairsToEval.set(p, [p]);
                    }
                }
            } else {
                const r0 = fixedPcts[0] != null ? [pcts[0]] : [];
                const r1 = fixedPcts[1] != null ? [pcts[1]] : [];
                if (fixedPcts[0] == null) for (let d = -6; d <= 6; d++) r0.push(Math.max(1, Math.min(100, pcts[0] + d)));
                if (fixedPcts[1] == null) for (let d = -6; d <= 6; d++) r1.push(Math.max(1, Math.min(100, pcts[1] + d)));
                for (const p0 of r0) for (const p1 of r1) pairsToEval.set(p0 * 1000 + p1, [p0, p1]);
            }
        }

        const phase2Results = [];
        for (const pcts of pairsToEval.values()) {
            const ev = evalPctsLight(pcts);
            if (ev) phase2Results.push({ pcts: [...pcts], worstDE: ev.worstDE, totalDE: ev.totalDE, setResults: ev.setResults });
        }
        phase2Results.sort((a, b) => a.worstDE - b.worstDE);
        if (phase2Results.length === 0) return null;

        // Phase 3: tight refinement ±2 around top-5 candidates, score by worstDE
        let best = null, bestScore = Infinity;
        for (const candidate of phase2Results.slice(0, 5)) {
            const tightPairs = new Map();
            if (numTargets === 1) {
                if (fixedPcts[0] != null) {
                    tightPairs.set(candidate.pcts[0], [candidate.pcts[0]]);
                } else {
                    for (let d = -2; d <= 2; d++) {
                        const p = Math.max(1, Math.min(100, candidate.pcts[0] + d));
                        tightPairs.set(p, [p]);
                    }
                }
            } else {
                const r0 = fixedPcts[0] != null ? [candidate.pcts[0]] : [];
                const r1 = fixedPcts[1] != null ? [candidate.pcts[1]] : [];
                if (fixedPcts[0] == null) for (let d = -2; d <= 2; d++) r0.push(Math.max(1, Math.min(100, candidate.pcts[0] + d)));
                if (fixedPcts[1] == null) for (let d = -2; d <= 2; d++) r1.push(Math.max(1, Math.min(100, candidate.pcts[1] + d)));
                for (const p0 of r0) for (const p1 of r1) tightPairs.set(p0 * 1000 + p1, [p0, p1]);
            }
            for (const pcts of tightPairs.values()) {
                const ev = evalPctsLight(pcts);
                if (ev && ev.worstDE < bestScore) {
                    bestScore = ev.worstDE;
                    best = { pcts: [...pcts], worstDE: ev.worstDE, totalDE: ev.totalDE, setResults: ev.setResults };
                }
            }
        }
        if (!best) best = phase2Results[0];

        // Phase 4: re-evaluate top pct combos with full blend search
        if (!fastMode) {
            const topPctCandidates = new Map();
            topPctCandidates.set(best.pcts.join(','), best.pcts);
            for (const r of phase2Results.slice(0, 5)) {
                topPctCandidates.set(r.pcts.join(','), r.pcts);
            }
            // Also try ±1 around winner
            if (numTargets === 1) {
                if (fixedPcts[0] == null) {
                    for (let d = -1; d <= 1; d++) {
                        const p = Math.max(1, Math.min(100, best.pcts[0] + d));
                        topPctCandidates.set([p].join(','), [p]);
                    }
                }
            } else {
                for (let d0 = -1; d0 <= 1; d0++) {
                    for (let d1 = -1; d1 <= 1; d1++) {
                        const p0 = fixedPcts[0] != null ? best.pcts[0] : Math.max(1, Math.min(100, best.pcts[0] + d0));
                        const p1 = fixedPcts[1] != null ? best.pcts[1] : Math.max(1, Math.min(100, best.pcts[1] + d1));
                        topPctCandidates.set([p0, p1].join(','), [p0, p1]);
                    }
                }
            }

            let fullBest = null, fullBestScore = Infinity;
            for (const pcts of topPctCandidates.values()) {
                const ev = evalPctsFull(pcts);
                if (ev && ev.worstDE < fullBestScore) {
                    fullBestScore = ev.worstDE;
                    fullBest = { pcts: [...pcts], totalDE: ev.totalDE, setResults: ev.setResults };
                }
            }
            if (fullBest) best = fullBest;
        }

        // Phase 5: hill-climb each set's blend color ±4 (independent per set)
        if (!fastMode && best) {
            let improved = true;
            while (improved) {
                improved = false;
                for (let si = 0; si < sets.length; si++) {
                    const s = sets[si];
                    const currentBlend = best.setResults[si].blendHex;
                    const rgb = hexToRgb(currentBlend);
                    let bestForSet = best.setResults[si];
                    let bestSetWorstDE = Math.max(...bestForSet.stateResults.map(r => r.deltaE));
                    for (let dr = -4; dr <= 4; dr++) {
                        for (let dg = -4; dg <= 4; dg++) {
                            for (let db = -4; db <= 4; db++) {
                                if (dr === 0 && dg === 0 && db === 0) continue;
                                const cHex = rgbToHex({
                                    r: Math.max(0, Math.min(255, rgb.r + dr)),
                                    g: Math.max(0, Math.min(255, rgb.g + dg)),
                                    b: Math.max(0, Math.min(255, rgb.b + db)),
                                });
                                let worstDE = 0, totalDE = 0;
                                const stateResults = [];
                                for (let ti = 0; ti < best.pcts.length && ti < s.targets.length; ti++) {
                                    const comp = colorMix(s.baseHex, cHex, best.pcts[ti], space);
                                    const dE = deltaE(comp, s.targets[ti]);
                                    totalDE += dE;
                                    if (dE > worstDE) worstDE = dE;
                                    stateResults.push({ targetHex: s.targets[ti], computed: comp, deltaE: dE, percent: best.pcts[ti] });
                                }
                                if (worstDE < bestSetWorstDE) {
                                    bestSetWorstDE = worstDE;
                                    bestForSet = {
                                        blendHex: cHex,
                                        stateResults,
                                        totalDeltaE: totalDE,
                                        hoverComputed: stateResults[0]?.computed,
                                        hoverDeltaE: stateResults[0]?.deltaE || 0,
                                        activeComputed: (stateResults[1] || stateResults[0])?.computed,
                                        activeDeltaE: (stateResults[1] || stateResults[0])?.deltaE || 0,
                                    };
                                    improved = true;
                                }
                            }
                        }
                    }
                    best.setResults[si] = bestForSet;
                }
            }
            best.totalDE = best.setResults.reduce((sum, s) => sum + s.totalDeltaE, 0);
        }

        return {
            percents: best.pcts,
            hoverPercent: best.pcts[0],
            activePercent: best.pcts[1] || best.pcts[0],
            totalDeltaE: best.totalDE,
            sets: best.setResults,
        };
    }

    // ── N≥3 targets: coordinate descent ──
    let currentPcts = [];
    for (let ti = 0; ti < numTargets; ti++) {
        if (fixedPcts[ti] != null) { currentPcts.push(fixedPcts[ti]); continue; }
        let bestPct = 50, bestScore = Infinity;
        for (const p of COARSE) {
            let totalDE = 0, valid = true;
            for (const s of sets) {
                const target = s.targets[ti] || s.targets[s.targets.length - 1];
                const sol = solveBlendColorAtPct(s.baseHex, target, p, space);
                if (!sol) { valid = false; break; }
                totalDE += sol.deltaE;
            }
            if (valid && totalDE < bestScore) { bestScore = totalDE; bestPct = p; }
        }
        currentPcts.push(bestPct);
    }

    for (let round = 0; round < (fastMode ? 1 : 3); round++) {
        for (let ti = 0; ti < numTargets; ti++) {
            if (fixedPcts[ti] != null) continue;
            let bestPct = currentPcts[ti], bestScore = Infinity;
            const pctSet = new Set(round === 0 ? COARSE : []);
            const lo = Math.max(1, currentPcts[ti] - (round === 0 ? 5 : 3));
            const hi = Math.min(100, currentPcts[ti] + (round === 0 ? 5 : 3));
            for (let p = lo; p <= hi; p++) pctSet.add(p);
            for (const p of pctSet) {
                const testPcts = [...currentPcts];
                testPcts[ti] = p;
                const ev = evalPctsLight(testPcts);
                if (ev && ev.totalDE < bestScore) { bestScore = ev.totalDE; bestPct = p; }
            }
            currentPcts[ti] = bestPct;
        }
    }

    // Final full blend search at winning pcts
    let finalDE = 0;
    const finalSetResults = [];
    let valid = true;
    for (const s of sets) {
        const res = fastMode ? bestBlendForSetLight(s, currentPcts) : bestBlendForSetFull(s, currentPcts);
        if (!res) { valid = false; break; }
        finalDE += res.totalDeltaE;
        finalSetResults.push(res);
    }
    if (!valid) return null;

    return {
        percents: currentPcts,
        hoverPercent: currentPcts[0],
        activePercent: currentPcts[1] || currentPcts[0],
        totalDeltaE: finalDE,
        sets: finalSetResults,
    };
}

function findBestColorSpacePerSetBlend(sets, forcedSpace, fixedPcts, deadline, fastMode) {
    const spaces = forcedSpace ? [forcedSpace] : (fastMode ? ['oklab'] : ['oklab', 'lab', 'srgb']);
    let best = null, bestScore = Infinity;
    for (const space of spaces) {
        if (deadline && Date.now() > deadline && best) break;
        try {
            const result = solvePerSetBlendSharedPct(sets, space, fixedPcts, fastMode);
            if (!result) continue;
            const worstDE = Math.max(...result.sets.map(s => Math.max(...s.stateResults.map(r => r.deltaE))));
            if (worstDE < bestScore) { bestScore = worstDE; best = { space, result }; }
        } catch(e) {}
    }
    return best;
}

// ── Fully independent: each set gets its own blend color + percentages ────────
function solveIndependent(sets, forcedSpace, fixedPcts, deadline, fastMode) {
    const setResults = [];
    for (const s of sets) {
        if (deadline && Date.now() > deadline && setResults.length > 0) break;
        const sol = findBestColorSpace(s.baseHex, s.targets, fixedPcts, forcedSpace, fastMode);
        if (!sol) return null;
        const r = sol.result;
        setResults.push({
            space: sol.space,
            blendHex: r.blendHex,
            percents: r.percents,
            stateResults: r.stateResults,
            hoverPercent: r.hoverPercent,
            activePercent: r.activePercent,
            hoverComputed: r.hoverComputed,
            hoverDeltaE: r.hoverDeltaE,
            activeComputed: r.activeComputed,
            activeDeltaE: r.activeDeltaE,
        });
    }
    return { sets: setResults };
}
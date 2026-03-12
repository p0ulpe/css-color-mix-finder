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
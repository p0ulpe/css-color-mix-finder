# blend-color-finder — Project context

## What this tool does

Given one or more "sets" of colors (base, hover target, active target), it finds a single **blend color** and two percentages (hover%, active%) such that:

```css
color-mix(in oklab, baseColor 100%, blendColor hoverPercent%)   ≈ hoverTarget
color-mix(in oklab, baseColor 100%, blendColor activePercent%)  ≈ activeTarget
```

This is useful when you want a single CSS variable (`--blend-color`) shared across multiple UI element sets.

## Stack

- Vanilla JS + HTML/CSS, no framework, no build step — open `src/index.html` directly in a browser
- Tests: Jest (`tests/`)

## Key files

| File | Role |
|------|------|
| `src/js/color-solver.js` | Main solver: candidate generation, coarse/fine search, hill-climbing |
| `src/js/color-math.js` | `colorMix()`, `deltaE()`, Lab/Oklab conversions, memoization caches |
| `src/js/solver-worker.js` | Web Worker entry point — runs the solver off the main thread |
| `src/js/app.js` | UI orchestration, delegates solve to Worker |
| `src/js/ui.js` | Result rendering |
| `src/js/history.js` | Search history (localStorage) |
| `src/css/styles.css` | Main styles |

## Algorithm overview

1. **Seed generation** — `solveBlendColor` analytically inverts `colorMix` for each set's hover/active targets to get candidate blend colors
2. **Candidate pool** — `generateBlendCandidates` builds a neighborhood of ~hundreds of RGB variants around each seed (±15 on R,G,B)
3. **Coarse scan** — rank all candidates using 14 coarse percent probes
4. **Fine scan** — evaluate top-80 candidates with fine ±8 search around best coarse probe
5. **Hill-climbing** — iterative refinement at radii ±10 → ±6 → ±3 around the winner; early exit if `worstDeltaE < 0.5`
6. **Color space** — repeated for oklab / lab / srgb when "auto", best result kept

## Performance

- **~8s with 3 sets** (down from 30-45s before optimization)
- Memoization caches in `color-math.js` eliminate repeated hex→Lab/Oklab conversions
- `solver-worker.js` keeps the UI responsive during computation

## Potential further optimizations

- Reduce `generateBlendCandidates` radius (±15 → ±10, step 5 → 4) to cut the initial pool size
- Parallelize color space evaluation with multiple Workers
